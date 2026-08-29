import { describe, it, expect, beforeAll } from "vitest";
import { createDatabase } from "../src/db/client.js";
import type { Db } from "../src/db/client.js";
import { migrate } from "../src/db/migrate.js";
import { seedGuidance } from "../src/seed/seedGuidance.js";
import { createGuidanceService } from "../src/services/guidanceService.js";

/**
 * guidanceService: doctor-authored knowledge CRUD over in-memory SQLite.
 *
 * Covers create/list/listEnabled/toggle/update/remove plus the seed
 * idempotency contract. Product references are persisted as a JSON string
 * array; `enabled` is a 0/1 integer (only enabled rows reach the agent).
 */
describe("guidanceService", () => {
  let db: Db;

  beforeAll(async () => {
    db = createDatabase(":memory:");
    await migrate(db);
    await seedGuidance(db);
  });

  it("seeds the two example guides with refs stored as a JSON string", () => {
    const svc = createGuidanceService(db);
    const all = svc.list();
    expect(all).toHaveLength(2);
    const vitalidad = all.find((g) => g.title === "Paquete Vitalidad");
    expect(vitalidad).toBeDefined();
    expect(vitalidad?.productReferences).toBe('["100305","100930"]');
    expect(vitalidad?.enabled).toBe(1);
    const absorcion = all.find((g) => g.title === "Absorción de vitamina C");
    expect(absorcion?.productReferences).toBe('["100305"]');
    expect(absorcion?.content).toContain("vitamina C");
  });

  it("listEnabled returns only enabled guides", () => {
    const svc = createGuidanceService(db);
    const disabled = svc.create({
      title: "Guía inactiva",
      content: "No debe inyectarse en el agente",
      productReferences: "[]",
      enabled: 0,
    });
    const enabled = svc.listEnabled();
    expect(enabled.some((g) => g.id === disabled.id)).toBe(false);
    expect(enabled.map((g) => g.title)).toContain("Paquete Vitalidad");
  });

  it("create persists a new guide with ISO-8601 timestamps and enabled=1 by default", () => {
    const svc = createGuidanceService(db);
    const row = svc.create({
      title: "Hidratación",
      content: "Mantener una hidratación adecuada a lo largo del día.",
      productReferences: '["100305"]',
    });
    expect(row.id).toBeGreaterThan(0);
    expect(row.enabled).toBe(1);
    expect(row.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(row.updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("update patches fields and refreshes updatedAt", () => {
    const svc = createGuidanceService(db);
    const row = svc.create({ title: "Original", content: "c", productReferences: "[]" });
    const patched = svc.update(row.id, {
      title: "Nuevo título",
      productReferences: '["100930"]',
    });
    expect(patched?.title).toBe("Nuevo título");
    expect(patched?.content).toBe("c"); // untouched field survives
    expect(patched?.productReferences).toBe('["100930"]');
    expect(patched?.updatedAt).not.toBe(row.updatedAt);
  });

  it("toggleEnabled flips enabled 0 ↔ 1", () => {
    const svc = createGuidanceService(db);
    const row = svc.create({ title: "Toggle me", content: "c", productReferences: "[]", enabled: 1 });
    expect(svc.toggleEnabled(row.id)?.enabled).toBe(0);
    expect(svc.toggleEnabled(row.id)?.enabled).toBe(1);
  });

  it("returns null when updating or toggling an absent id", () => {
    const svc = createGuidanceService(db);
    expect(svc.update(99999, { title: "x" })).toBeNull();
    expect(svc.toggleEnabled(99999)).toBeNull();
  });

  it("remove deletes the row and reports absence for unknown ids", () => {
    const svc = createGuidanceService(db);
    const row = svc.create({ title: "Borrame", content: "c", productReferences: "[]" });
    expect(svc.remove(row.id)).toBe(true);
    expect(svc.list().some((g) => g.id === row.id)).toBe(false);
    expect(svc.remove(99999)).toBe(false);
  });

  it("re-seed is idempotent: upserts by title, never duplicates", async () => {
    const svc = createGuidanceService(db);
    const before = svc.list().length;
    const res = await seedGuidance(db);
    expect(res.inserted).toBe(0);
    expect(svc.list().length).toBe(before);
    const titles = svc.list().map((g) => g.title);
    expect(new Set(titles).size).toBe(titles.length);
  });
});