import { describe, it, expect, beforeAll } from "vitest";
import { createDatabase } from "../src/db/client.js";
import { migrate } from "../src/db/migrate.js";
import { seedProducts } from "../src/seed/seedProducts.js";
import { createCatalogService } from "../src/services/catalogService.js";
import type { Db } from "../src/db/client.js";

describe("catalogService", () => {
  let db: Db;

  beforeAll(async () => {
    db = createDatabase(":memory:");
    await migrate(db);
    await seedProducts(db);
  });

  it("returns full product data for a valid reference (no invention — transcribed from PDFs)", () => {
    const catalog = createCatalogService(db);
    const result = catalog.lookup("100305");
    expect(result.found).toBe(true);
    if (result.found) {
      expect(result.product.name).toBe("Nutrilite™ Biotina C Plus");
      expect(result.product.category).toBe("Complementos alimenticios — Cabello y piel");
      expect(result.product.size).toBe("90 comprimidos");
      expect(result.product.price).toBe(24.04);
      expect(result.product.dosage).toContain("2 comprimidos al día");
      expect(result.product.disclaimer.length).toBeGreaterThan(10);
    }
  });

  it("returns the masticable multivitamin with its structured fields", () => {
    const catalog = createCatalogService(db);
    const result = catalog.lookup("100930");
    expect(result.found).toBe(true);
    if (result.found) {
      expect(result.product.name).toContain("Masticable");
      expect(result.product.ingredients).toContain("Vitamina D");
      expect(result.product.benefits.length).toBeGreaterThan(10);
    }
  });

  it("returns not-found for an absent reference and never invents details", () => {
    const catalog = createCatalogService(db);
    const result = catalog.lookup("999999");
    expect(result.found).toBe(false);
  });

  it("returns not-found for an empty or blank reference", () => {
    const catalog = createCatalogService(db);
    expect(catalog.lookup("").found).toBe(false);
    expect(catalog.lookup("   ").found).toBe(false);
  });

  it("does not expose flagged-incomplete products (Double X still requires human curation)", () => {
    const catalog = createCatalogService(db);
    expect(catalog.lookup("121576").found).toBe(false);
  });

  it("lists all curated catalog products without duplicates after re-seed", async () => {
    await seedProducts(db); // idempotent re-run
    const catalog = createCatalogService(db);
    const all = catalog.listAll();
    const refs = all.map((p) => p.reference);
    expect(new Set(refs).size).toBe(all.length); // no duplicates
    expect(refs).toContain("100305");
    expect(refs).toContain("100930");
  });
});