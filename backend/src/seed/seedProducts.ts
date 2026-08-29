import { eq } from "drizzle-orm";
import { createDatabase } from "../db/client.js";
import { products } from "../db/schema.js";
import { migrate } from "../db/migrate.js";
import { readyProducts, flaggedIncomplete } from "./curatedProducts.js";

export interface SeedProductsResult {
  upserted: number;
  inserted: number;
  updated: number;
  flagged: Array<{ reference: string; reason: string }>;
}

/**
 * Idempotently upserts the curated catalog into the products table.
 *
 * Keyed on `reference` (pk): existing rows are updated, new rows inserted —
 * re-running never duplicates (product-catalog spec, "Re-seed idempotency").
 * Incomplete curated rows (missing required fields) are FLAGGED and NOT
 * inserted (spec: "records without required fields are rejected or flagged").
 */
export async function seedProducts(db: ReturnType<typeof createDatabase>): Promise<SeedProductsResult> {
  await migrate(db);

  let inserted = 0;
  let updated = 0;
  const flagged = flaggedIncomplete().map((p) => ({
    reference: p.reference,
    reason: "incomplete curated fields (benefits/dosage/ingredients/disclaimer)",
  }));

  for (const product of readyProducts()) {
    const existing = db
      .select()
      .from(products)
      .where(eq(products.reference, product.reference))
      .get();
    if (existing) {
      await db
        .update(products)
        .set(product)
        .where(eq(products.reference, product.reference));
      updated += 1;
    } else {
      await db.insert(products).values(product);
      inserted += 1;
    }
  }

  return { upserted: inserted + updated, inserted, updated, flagged };
}

// Allow `tsx src/seed/seedProducts.ts` to run directly.
if (import.meta.url === `file://${process.argv[1]}`) {
  const db = createDatabase(process.env.SQLITE_PATH ?? "./data/dev.sqlite");
  seedProducts(db)
    .then((res) => {
      console.log(`seed:products — inserted=${res.inserted} updated=${res.updated} flagged=${res.flagged.length}`);
      for (const f of res.flagged) console.log(`  flagged (not inserted): ${f.reference} — ${f.reason}`);
      db.$client.close();
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}