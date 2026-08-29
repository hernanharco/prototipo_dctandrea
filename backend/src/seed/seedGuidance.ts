import { eq } from "drizzle-orm";
import { createDatabase } from "../db/client.js";
import { guidance } from "../db/schema.js";
import { migrate } from "../db/migrate.js";

export interface SeedGuidanceResult {
  inserted: number;
  updated: number;
}

/**
 * Example doctor-authored guidance, referencing the curated catalog products
 * (100305 Biotina C Plus, 100930 Multivitamínico Masticable).
 *
 * Idempotent: keyed on `title` — existing rows are refreshed (content, refs,
 * re-enabled), new rows inserted. Re-running never duplicates.
 */
const EXAMPLE_GUIDANCE = [
  {
    title: "Paquete Vitalidad",
    content:
      "Tomar la Biotina C Plus junto con el Multivitamínico Masticable puede apoyar la energía diaria y el cuidado de piel y cabello. Consulta siempre con tu médico antes de iniciar cualquier suplemento.",
    productReferences: ["100305", "100930"],
  },
  {
    title: "Absorción de vitamina C",
    content:
      "La vitamina C de la Biotina C Plus favorece la absorción de nutrientes; se recomienda tomarla con la comida principal del día.",
    productReferences: ["100305"],
  },
] as const;

export async function seedGuidance(db: ReturnType<typeof createDatabase>): Promise<SeedGuidanceResult> {
  await migrate(db);

  let inserted = 0;
  let updated = 0;

  for (const g of EXAMPLE_GUIDANCE) {
    const existing = db.select().from(guidance).where(eq(guidance.title, g.title)).get();
    const now = new Date().toISOString();
    if (existing) {
      await db
        .update(guidance)
        .set({
          content: g.content,
          productReferences: JSON.stringify(g.productReferences),
          enabled: 1,
          updatedAt: now,
        })
        .where(eq(guidance.id, existing.id));
      updated += 1;
    } else {
      await db.insert(guidance).values({
        title: g.title,
        content: g.content,
        productReferences: JSON.stringify(g.productReferences),
        enabled: 1,
        createdAt: now,
        updatedAt: now,
      });
      inserted += 1;
    }
  }

  return { inserted, updated };
}

// Allow `tsx src/seed/seedGuidance.ts` to run directly.
if (import.meta.url === `file://${process.argv[1]}`) {
  const db = createDatabase(process.env.SQLITE_PATH ?? "./data/dev.sqlite");
  seedGuidance(db)
    .then((res) => {
      console.log(`seed:guidance — inserted=${res.inserted} updated=${res.updated}`);
      db.$client.close();
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}