import type { Product } from "../db/schema.js";

/**
 * Agent prompt module.
 *
 * The system prompt enforces the LEGAL HARD LIMIT: the assistant is a
 * preventive/lifestyle recommender only. It MUST NOT diagnose, prescribe,
 * treat, or promise cures, and it MUST defer to a medical professional. The
 * catalog references injected here are valid rows from the database — the
 * agent only ever talks about products that actually exist (never invents).
 */

export interface CatalogContext {
  products: Product[];
}

export interface PurchaseContext {
  /** Product references the customer actually purchased, in insertion order. */
  refs: string[];
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

const HARD_LIMIT = `ERES UN ASISTENTE PREVENTIVO DE NUTRILITE™. LÍMITE DURO E INVIOLABLE:

1. SOLO PREVENCIÓN Y ESTILO DE VIDA. Tu función es ofrecer orientación general de
   prevención y apoyo al estilo de vida con productos Nutrilite™. NUNCA diagnostiques,
   trates, prescribas, cures ni prometas curación de ninguna enfermedad, síntoma o
   condición de salud.
2. NUNCA digas qué enfermedad "padece" o "tiene" el usuario. NUNCA uses palabras como
   "diagnóstico", "tratamiento", "cura", "curación" ni "prescripción" referidas a su salud.
3. DERIVA SIEMPRE A CONSULTA MÉDICA. Ante cualquier síntoma, dolor o sospecha de
   enfermedad, recomienda consultar a un médico o profesional sanitario.
4. PRODUCTOS EXISTENTES SOLO. Solo puedes mencionar los productos del catálogo que se
   te inyectan a continuación. Si el usuario pide un producto que NO está en la lista,
   responde que no puedes recomendarlo porque no está en tu catálogo actual. NUNCA
   inventes productos, referencias, dosis, precios ni beneficios.
5. DATOS DE COMPRAS. Usa el historial de compras del usuario (si existe) para
   personalizar sugerencias preventivas, pero nunca lo cites de forma alarmante.
6. IDIOMA. Responde SIEMPRE en español, de forma clara y empática.
7. FORMATO. Cita las referencias de los productos que recomiendas entre corchetes,
   p. ej. [100305].`;

function catalogBlock(ctx: CatalogContext): string {
  if (ctx.products.length === 0) {
    return "CATÁLOGO DISPONIBLE: (vacío en este momento — no recomiendes ningún producto).";
  }
  const lines = ctx.products.map(
    (p) =>
      `- [${p.reference}] ${p.name} — ${p.category}. Dosis: ${p.dosage}. Beneficios: ${p.benefits}. ${p.disclaimer}`,
  );
  return `CATÁLOGO DISPONIBLE (referencias válidas):\n${lines.join("\n")}`;
}

function purchasesBlock(purchases: PurchaseContext | null): string {
  if (!purchases || purchases.refs.length === 0) {
    return "HISTORIAL DE COMPRAS DEL USUARIO: (sin compras registradas).";
  }
  return `HISTORIAL DE COMPRAS DEL USUARIO (referencias compradas, para personalizar sugerencias preventivas): ${purchases.refs.join(", ")}`;
}

/**
 * Builds the full system prompt, injecting only valid catalog rows and the
 * user's purchase history (server-side injection — never tool-calling).
 */
export function buildSystemPrompt(ctx: CatalogContext, purchases: PurchaseContext | null): string {
  return [
    HARD_LIMIT,
    "",
    "CONTEXTO DE ESTA CONVERSACIÓN:",
    purchasesBlock(purchases),
    "",
    catalogBlock(ctx),
  ].join("\n");
}

/**
 * Builds the concatenated chat history to send to Gemini so the model keeps
 * continuity across turns. The most recent user message is appended last.
 */
export function buildHistoryMessages(history: ChatMessage[], userMessage: string): ChatMessage[] {
  const tail = history.slice(-10);
  return [...tail, { role: "user", content: userMessage }];
}

/** Scans a reply for catalog references written as `[REF]` and returns them. */
export function extractProductRefs(reply: string): string[] {
  const matches = reply.match(/\[(\d{4,6})\]/g) ?? [];
  return [...new Set(matches.map((m) => m.replace(/[\[\]]/g, "")))];
}