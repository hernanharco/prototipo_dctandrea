import { Hono } from "hono";
import type { Db } from "../db/client.js";
import { createCatalogService } from "../services/catalogService.js";
import { createRecommendationService } from "../services/recommendationService.js";
import { createConversationService } from "../services/conversationService.js";
import { customers, conversations, purchases } from "../db/schema.js";
import { eq } from "drizzle-orm";

/**
 * Dev-only CRM routes under /admin.
 *
 * - 403 unless NODE_ENV === "development" (LOPD/GDPR guard — never expose PII
 *   or health/purchase data on a public host).
 * - `recommendations` is GET-only: the audit log is append-only, so no
 *   POST/PUT/DELETE is exposed here or anywhere (see design ADR + audit spec).
 * - Catalog edits never DELETE: products referenced by purchases or past
 *   recommendations must not be destructively removed (referential integrity).
 * - No real auth: basic auth is a documented MUST before any non-dev deploy.
 */
export function createAdminRouter(db: Db): Hono {
  const app = new Hono();

  // Dev-only guard: deny everything outside development.
  app.use("*", async (c, next) => {
    if (process.env.NODE_ENV !== "development") {
      return c.json({ error: "forbidden" }, 403);
    }
    return next();
  });

  const catalog = createCatalogService(db);
  const recommendations = createRecommendationService(db);
  const conversationsService = createConversationService(db);

  // --- Catalog (products): list, create, edit. No destructive delete. ---
  app.get("/catalog", (c) => c.json({ products: catalog.listAll() }));

  app.post("/catalog", async (c) => {
    const body = await c.req.json().catch(() => null);
    if (!body) return c.json({ error: "invalid body" }, 400);
    const required = [
      "reference",
      "name",
      "category",
      "size",
      "benefits",
      "dosage",
      "ingredients",
      "disclaimer",
    ];
    for (const field of required) {
      if (body[field] == null || String(body[field]).trim() === "") {
        return c.json({ error: `missing field: ${field}` }, 400);
      }
    }
    const price = Number(body.price);
    if (!Number.isFinite(price) || price < 0) {
      return c.json({ error: "price must be a non-negative number" }, 400);
    }
    const reference = String(body.reference).trim();
    if (catalog.lookup(reference).found) {
      return c.json({ error: "reference already exists" }, 409);
    }
    const product = catalog.create({
      reference,
      name: String(body.name),
      category: String(body.category),
      size: String(body.size),
      price,
      benefits: String(body.benefits),
      dosage: String(body.dosage),
      ingredients: String(body.ingredients),
      disclaimer: String(body.disclaimer),
    });
    return c.json({ product }, 201);
  });

  app.put("/catalog/:reference", async (c) => {
    const reference = c.req.param("reference");
    const body = await c.req.json().catch(() => null);
    if (!body) return c.json({ error: "invalid body" }, 400);

    const patch: Record<string, string | number> = {};
    const stringFields = [
      "name",
      "category",
      "size",
      "benefits",
      "dosage",
      "ingredients",
      "disclaimer",
    ] as const;
    for (const field of stringFields) {
      if (body[field] != null) patch[field] = String(body[field]);
    }
    if (body.price != null) {
      const price = Number(body.price);
      if (!Number.isFinite(price) || price < 0) {
        return c.json({ error: "price must be a non-negative number" }, 400);
      }
      patch.price = price;
    }
    if (Object.keys(patch).length === 0) {
      return c.json({ error: "nothing to update" }, 400);
    }

    const product = catalog.update(reference, patch);
    if (!product) return c.json({ error: "reference not found" }, 404);
    return c.json({ product });
  });

  // --- Customers: list (records come from the registration gate). ---
  app.get("/customers", (c) =>
    c.json({ customers: db.select().from(customers).all() }),
  );

  // --- Conversations: list + view messages. ---
  app.get("/conversations", (c) =>
    c.json({ conversations: db.select().from(conversations).all() }),
  );
  app.get("/conversations/:id/messages", (c) => {
    const id = Number(c.req.param("id"));
    if (!Number.isInteger(id)) return c.json({ error: "invalid id" }, 400);
    return c.json({ messages: conversationsService.loadMessages(id) });
  });

  // --- Purchases: list + create a demo purchase. ---
  app.get("/purchases", (c) =>
    c.json({ purchases: db.select().from(purchases).all() }),
  );
  app.post("/purchases", async (c) => {
    const body = await c.req.json().catch(() => null);
    if (!body) return c.json({ error: "invalid body" }, 400);
    const customerId = Number(body.customerId);
    const productReference = String(body.productReference ?? "").trim();
    const qty = Number(body.qty ?? 1);
    if (!Number.isInteger(customerId)) return c.json({ error: "invalid customerId" }, 400);
    if (!productReference) return c.json({ error: "missing productReference" }, 400);
    if (!Number.isInteger(qty) || qty < 1) return c.json({ error: "qty must be a positive integer" }, 400);

    const customer = db.select().from(customers).where(eq(customers.id, customerId)).get();
    if (!customer) return c.json({ error: "customer not found" }, 404);
    if (!catalog.lookup(productReference).found) {
      return c.json({ error: "product not found" }, 404);
    }
    const purchasedAt = body.purchasedAt
      ? String(body.purchasedAt)
      : new Date().toISOString();
    const purchase = db
      .insert(purchases)
      .values({ customerId, productReference, qty, purchasedAt })
      .returning()
      .get();
    return c.json({ purchase }, 201);
  });

  // --- Recommendations: GET-only (append-only audit log). No POST/PUT/DELETE. ---
  app.get("/recommendations", (c) =>
    c.json({ recommendations: recommendations.listAll() }),
  );

  return app;
}