import { Hono } from "hono";
import type { Db } from "../db/client.js";
import { createCustomerService } from "../services/customerService.js";
import { createConversationService } from "../services/conversationService.js";
import { createRecommendationService } from "../services/recommendationService.js";
import { createCatalogService } from "../services/catalogService.js";
import { createGeminiClient } from "../agent/gemini.js";
import { buildSystemPrompt, buildHistoryMessages, extractProductRefs } from "../agent/prompt.js";
import { guardReply } from "../agent/guard.js";
import { getCurrentConsent } from "../config/consent.js";
import type { Product } from "../db/schema.js";

/**
 * Assistant routes: consent, ask (chat), history.
 *
 * - GET  /assistant/consent → {version, text} (rendered by the chat UI).
 * - POST /assistant/ask     → consent version-gated; server-side purchase
 *   injection; Gemini → deterministic guard → append-only audit log.
 * - GET  /assistant/history → prior messages for memory.
 *
 * Product not-found is internal, never a 404 to the client: only valid catalog
 * refs are injected, so the agent never invents details.
 */
export function createAssistantRouter(db: Db): Hono {
  const app = new Hono();
  const customers = createCustomerService(db);
  const conversations = createConversationService(db);
  const recommendations = createRecommendationService(db);
  const catalog = createCatalogService(db);
  const gemini = createGeminiClient();

  app.get("/consent", (c) => {
    return c.json(getCurrentConsent());
  });

  app.get("/history", (c) => {
    const conversationId = Number(c.req.query("conversation_id"));
    const customerId = Number(c.req.query("customer_id"));
    if (!Number.isInteger(conversationId) || !Number.isInteger(customerId)) {
      return c.json({ error: "conversation_id y customer_id son requeridos" }, 400);
    }
    if (!customers.getById(customerId)) {
      return c.json({ error: "customer no encontrado" }, 404);
    }
    if (!conversations.belongsToCustomer(conversationId, customerId)) {
      return c.json({ error: "conversación no pertenece al customer" }, 403);
    }
    return c.json({ messages: conversations.loadHistory(conversationId) });
  });

  app.post("/ask", async (c) => {
    let body: Record<string, unknown>;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: "cuerpo inválido" }, 400);
    }

    const customerId = Number(body.customer_id);
    const message = typeof body.message === "string" ? body.message.trim() : "";
    const suppliedConversationId = body.conversation_id != null ? Number(body.conversation_id) : null;

    if (!Number.isInteger(customerId) || !message) {
      return c.json({ error: "customer_id y message son requeridos" }, 400);
    }
    const customer = customers.getById(customerId);
    if (!customer) {
      return c.json({ error: "customer no encontrado" }, 404);
    }

    // Consent is VERSION-GATED: stale consent → re-consent required, no recommendation.
    if (!customers.hasCurrentConsent(customerId)) {
      return c.json(
        { error: "CONSENT_REQUIRED", consent: getCurrentConsent() },
        401,
      );
    }

    // Resolve conversation (create if absent, or validate ownership).
    let conversationId: number;
    if (suppliedConversationId != null) {
      if (!conversations.belongsToCustomer(suppliedConversationId, customerId)) {
        return c.json({ error: "conversación no pertenece al customer" }, 403);
      }
      conversationId = suppliedConversationId;
    } else {
      conversationId = conversations.createConversation(customerId).id;
    }

    // Server-side purchase-context injection (not tool-calling).
    const purchaseRefs = conversations.loadPurchases(customerId);
    const validProducts = purchaseRefs
      .map((ref) => catalog.lookup(ref))
      .filter((r): r is { found: true; product: Product } => r.found)
      .map((r) => r.product);

    // Persist user message, build history, run the agent.
    conversations.saveMessage(conversationId, "user", message);
    const history = conversations.loadHistory(conversationId);
    const systemPrompt = buildSystemPrompt(
      { products: validProducts },
      { refs: purchaseRefs },
    );

    let rawReply: string;
    try {
      rawReply = await gemini.generate({
        systemPrompt,
        messages: buildHistoryMessages(history, message),
      });
    } catch (err) {
      return c.json({ error: "GEMINI_UNAVAILABLE", message: "Motor de recomendación no disponible" }, 503);
    }

    // Deterministic legal guard.
    const guarded = guardReply(rawReply);

    // Append-only audit log entry.
    const refs = extractProductRefs(guarded.reply).filter((r) => catalog.lookup(r).found);
    recommendations.append({
      conversationId,
      customerId,
      symptom: message,
      productReferences: refs,
      rationale: guarded.reply,
      consentVersion: customer.consentVersion,
      guardBlocked: guarded.guardBlocked,
    });

    conversations.saveMessage(conversationId, "assistant", guarded.reply);

    return c.json({
      conversation_id: conversationId,
      reply: guarded.reply,
      guard_blocked: guarded.guardBlocked,
      recommended_product_refs: refs,
    });
  });

  return app;
}