import { eq } from "drizzle-orm";
import type { Db } from "../db/client.js";
import { guidance } from "../db/schema.js";
import type { Guidance, NewGuidance } from "../db/schema.js";

/**
 * Doctor-authored guidance service (knowledge base), backed by the `guidance`
 * table. Unlike the append-only `recommendations` audit log, guidance is
 * EDITABLE knowledge: create/update/toggle/remove are all exposed here and in
 * the admin routes.
 *
 * `product_references` is persisted as a JSON string array of catalog refs;
 * callers that need the parsed array parse it themselves (see assistant.ts).
 */
export interface GuidanceService {
  /** All guidance rows (admin CRM list). */
  list(): Guidance[];
  /** Only enabled rows — the ones injected into the agent prompt. */
  listEnabled(): Guidance[];
  /** Create a guidance entry. Timestamps are ISO-8601 text. */
  create(input: NewGuidance): Guidance;
  /** Partial update by id; refreshes `updatedAt`. Returns null when absent. */
  update(id: number, patch: Partial<NewGuidance>): Guidance | null;
  /** Flip `enabled` 0 ↔ 1. Returns null when the id is absent. */
  toggleEnabled(id: number): Guidance | null;
  /** Delete a guidance entry. Returns whether a row was removed. */
  remove(id: number): boolean;
}

export function createGuidanceService(db: Db): GuidanceService {
  return {
    list(): Guidance[] {
      return db.select().from(guidance).all();
    },

    listEnabled(): Guidance[] {
      return db.select().from(guidance).where(eq(guidance.enabled, 1)).all();
    },

    create(input: NewGuidance): Guidance {
      const now = new Date().toISOString();
      return db
        .insert(guidance)
        .values({ ...input, createdAt: now, updatedAt: now })
        .returning()
        .get();
    },

    update(id: number, patch: Partial<NewGuidance>): Guidance | null {
      const row = db
        .update(guidance)
        .set({ ...patch, updatedAt: new Date().toISOString() })
        .where(eq(guidance.id, id))
        .returning()
        .get();
      return row ?? null;
    },

    toggleEnabled(id: number): Guidance | null {
      const current = db.select().from(guidance).where(eq(guidance.id, id)).get();
      if (!current) return null;
      const row = db
        .update(guidance)
        .set({
          enabled: current.enabled === 1 ? 0 : 1,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(guidance.id, id))
        .returning()
        .get();
      return row ?? null;
    },

    remove(id: number): boolean {
      const result = db.delete(guidance).where(eq(guidance.id, id)).run();
      return result.changes > 0;
    },
  };
}