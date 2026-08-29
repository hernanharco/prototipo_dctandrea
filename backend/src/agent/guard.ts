/**
 * Deterministic post-process guard (defense-in-depth after the prompt hard
 * limit). It is the legal boundary: it rejects/rewrites any reply that asserts
 * diagnosis, treatment, or cure claims.
 *
 * Non-destructive policy:
 * - If a blocked pattern is found → the reply is REPLACED with a preventive
 *   template that defers to medical consultation; `guard_blocked = true`.
 * - Regardless of blocking, if the disclaimer is absent it is appended.
 *
 * The guard never raises — it rewrites. This keeps the audit log populated with
 * every reply, including blocked ones, so the doctor can review them.
 */

export const BLOCKED_PATTERNS = [
  "diagnos",
  "padeces",
  "tratamient",
  "cura",
  "curación",
  "enfermedad",
  "prescrib",
  "usted tiene",
  "dosis médica",
];

export const PREVENTION_TEMPLATE =
  "Entiendo tu preocupación por tu bienestar y me alegra que estés buscando " +
  "cuidarte. Como apoyo preventivo y de estilo de vida, algunas opciones de " +
  "Nutrilite™ pueden ser útiles dentro de una alimentación equilibrada. " +
  "Sin embargo, para cualquier síntoma, dolor o sospecha de una condición de " +
  "salud, es imprescindible que consultes a tu médico o a un profesional " +
  "sanitario: este asistente no valora ni sustituye la consulta médica.";

export const DISCLAIMER =
  "Este mensaje es orientación general de prevención y no constituye " +
  "diagnóstico, tratamiento ni prescripción médica. Ante cualquier duda sobre " +
  "tu salud, consulta siempre a un profesional sanitario.";

export interface GuardResult {
  /** The (possibly rewritten) reply. */
  reply: string;
  /** True when the guard replaced the reply because it violated the boundary. */
  guardBlocked: boolean;
}

/** Case-insensitive search for any blocked diagnostic/cure pattern. */
export function hasBlockedPattern(text: string): boolean {
  const lower = text.toLowerCase();
  return BLOCKED_PATTERNS.some((p) => lower.includes(p));
}

/**
 * Runs the deterministic guard over the assistant reply.
 * Returns a safe reply and whether the boundary was violated.
 */
export function guardReply(rawReply: string): GuardResult {
  const text = rawReply ?? "";
  const blocked = hasBlockedPattern(text);
  let reply = blocked ? PREVENTION_TEMPLATE : text;
  if (!reply.includes("consulta") && !reply.includes("médico")) {
    reply = `${reply.trim()}\n\n${DISCLAIMER}`;
  }
  return { reply, guardBlocked: blocked };
}