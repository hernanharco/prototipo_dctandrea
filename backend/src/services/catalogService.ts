import { eq } from "drizzle-orm";
import type { Db } from "../db/client.js";
import { products } from "../db/schema.js";
import type { Product } from "../db/schema.js";

/**
 * Result of a product lookup. Distinguishes a present product from an absent
 * one so callers never have to guess — the product not-found contract.
 */
export type CatalogLookupResult =
  | { found: true; product: Product }
  | { found: false };

export interface CatalogService {
  /** Look up a product by its exact catalog reference. */
  lookup(reference: string): CatalogLookupResult;
  /** List all catalog products (used by seed validation / CRM). */
  listAll(): Product[];
}

/**
 * Catalog service backed by the products table. It only ever returns rows that
 * exist in the database — it NEVER invents product data. An absent reference
 * yields `{ found: false }` and the caller (agent) replies it cannot recommend
 * that product rather than fabricating details (spec MUST).
 */
export function createCatalogService(db: Db): CatalogService {
  return {
    lookup(reference: string): CatalogLookupResult {
      if (!reference || reference.trim().length === 0) {
        return { found: false };
      }
      const row = db
        .select()
        .from(products)
        .where(eq(products.reference, reference))
        .get();
      return row ? { found: true, product: row } : { found: false };
    },

    listAll(): Product[] {
      return db.select().from(products).all();
    },
  };
}