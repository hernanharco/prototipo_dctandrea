import { describe, it, expect } from "vitest";
import { guardReply, hasBlockedPattern, BLOCKED_PATTERNS } from "../src/agent/guard.js";

describe("guard (deterministic legal post-process)", () => {
  it("blocks a diagnostic claim and defers to medical consultation", () => {
    const { reply, guardBlocked } = guardReply("El paciente padeces anemia y deberías tomar hierro.");
    expect(guardBlocked).toBe(true);
    expect(reply).toContain("consulta");
    expect(reply).toContain("médico");
    // The preventive template must not itself contain a blocked pattern.
    expect(hasBlockedPattern(reply)).toBe(false);
  });

  it("blocks a cure/treatment claim", () => {
    const { guardBlocked } = guardReply("Este producto cura la hipertensión.");
    expect(guardBlocked).toBe(true);
  });

  it("blocks a prescription claim", () => {
    expect(hasBlockedPattern("le prescribo este tratamiento")).toBe(true);
    expect(guardReply("le prescribo este tratamiento").guardBlocked).toBe(true);
  });

  it("keeps a preventive-framed reply (no diagnosis/cure) unblocked", () => {
    const reply =
      "Como apoyo a tu estilo de vida, Biotina C Plus [100305] puede complementar " +
      "una alimentación equilibrada. Consulta a tu médico si tienes dudas sobre tu salud.";
    const { reply: out, guardBlocked } = guardReply(reply);
    expect(guardBlocked).toBe(false);
    expect(out).toContain("100305");
  });

  it("appends the disclaimer when the reply omits any medical referral", () => {
    const { reply } = guardReply("Puedes considerar tomar [100930] como parte de tu rutina.");
    expect(reply).toContain("no constituye");
    expect(reply).toContain("profesional sanitario");
  });

  it("does not duplicate the disclaimer when already present", () => {
    const reply =
      "Puedes considerar tomar [100930]. Esto no constituye diagnóstico médico; consulta a un profesional sanitario.";
    const { reply: out } = guardReply(reply);
    const occurrences = out.split("no constituye").length - 1;
    expect(occurrences).toBe(1);
  });

  it("covers every configured blocked pattern", () => {
    // Every pattern listed in the design/spec must trip the guard.
    for (const pattern of BLOCKED_PATTERNS) {
      expect(hasBlockedPattern(`este mensaje ${pattern} algo`), `pattern "${pattern}"`).toBe(true);
    }
  });
});