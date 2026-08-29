import { sql } from "drizzle-orm";
import type { Db } from "../db/client.js";
import { recommendations } from "../db/schema.js";
import type { Recommendation } from "../db/schema.js";

/**
 * Append-only recommendation audit log.
 *
 * This service exposes INSERT and SELECT only. There is intentionally NO
 * UPDATE and NO DELETE — immutability is enforced at both the service and API
 * layers (see routes/admin.ts, which is GET-only for recommendations). Each
 * entry records the symptom, referenced products (valid catalog refs), the
 * rationale, the consent version at the time, and whether the guard blocked it.
 */

export interface AppendRecommendationInput {
  conversationId: number;
  customerId: number;
  symptom: string;
  productReferences: string[];
  rationale: string;
  consentVersion: number;
  guardBlocked: boolean;
}

export interface RecommendationService {
  /** Appends a recommendation to the audit log. Returns the stored row. */
  append(input: AppendRecommendationInput): Recommendation;
  /** Lists recommendations for a customer (newest first). Read-only. */
  listByCustomer(customerId: number): Recommendation[];
  /** Lists the full audit log (admin, GET-only). */
  listAll(): Recommendation[];
}

export function createRecommendationService(db: Db): RecommendationService {
  return {
    append(input: AppendRecommendationInput): Recommendation {
      return db
        .insert(recommendations)
        .values({
          conversationId: input.conversationId,
          customerId: input.customerId,
          symptom: input.symptom,
          productReferences: JSON.stringify(input.productReferences),
          rationale: input.rationale,
          consentVersion: input.consentVersion,
          guardBlocked: input.guardBlocked,
        })
        .returning()
        .get();
    },

    listByCustomer(customerId: number): Recommendation[] {
      return db
        .select()
        .from(recommendations)
        .where(sql`${recommendations.customerId} = ${customerId}`)
        .orderBy(sql`${recommendations.createdAt} DESC`)
        .all();
    },

    listAll(): Recommendation[] {
      return db.select().from(recommendations).orderBy(sql`${recommendations.createdAt} DESC`).all();
    },
  };
}