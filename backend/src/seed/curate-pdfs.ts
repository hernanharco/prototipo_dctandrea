import { execFileSync } from "node:child_process";
import { readdirSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import os from "node:os";

/**
 * Base PDF curation scaffold for the Nutrilite catalog.
 *
 * Parses the source PDFs in ~/Documentos/amway/ (PriceList + product fichas)
 * via `pdftotext` and emits an intermediate JSON of candidate products with the
 * fields that can be extracted reliably (reference, name, size, price).
 *
 * It does NOT fabricate fields: benefits/dosage/ingredients/disclaimer are left
 * for human curation (they require reading the detail pages). Output lands in
 * backend/data/curated-intermediate.json so a human can complete and merge it
 * into seed/curatedProducts.ts. The script only ever emits what it parsed.
 */
export interface ParsedPdfProduct {
  source: string;
  reference?: string;
  name?: string;
  size?: string;
  price?: number;
}

const SOURCE_DIR = join(os.homedir(), "Documentos", "amway");
const OUT_FILE = join(process.cwd(), "data", "curated-intermediate.json");

function extractText(pdfPath: string): string {
  try {
    return execFileSync("pdftotext", ["-layout", pdfPath, "-"], { encoding: "utf8", maxBuffer: 10 * 1024 * 1024 });
  } catch {
    return "";
  }
}

/** Pull the reference code (a 5–6 digit number near "Referencia"/"Artículo"). */
function parseReference(text: string): string | undefined {
  const m = text.match(/Referencia\s+(\d{5,6})/) ?? text.match(/Artículo\s+#\s*(\d{5,6})/);
  return m?.[1];
}

/** First € price in the page is the product price. */
function parsePrice(text: string): number | undefined {
  const m = text.match(/(\d{1,3}(?:[.,]\d{2})?)\s*€/);
  if (!m?.[1]) return undefined;
  return Number.parseFloat(m[1].replace(",", "."));
}

function parseSize(text: string): string | undefined {
  const m = text.match(/Tamaño:\s*([^\n]+)/);
  return m?.[1]?.trim();
}

function parseName(text: string): string | undefined {
  const m = text.match(/Nutrilite(?:™)?[^\n]*/i);
  return m?.[0]?.trim();
}

/** Parse every PDF in the source dir into candidate products. */
export function curatePdfs(): ParsedPdfProduct[] {
  const pdfs = readdirSync(SOURCE_DIR).filter((f) => f.toLowerCase().endsWith(".pdf"));
  const out: ParsedPdfProduct[] = [];
  for (const file of pdfs) {
    const text = extractText(join(SOURCE_DIR, file));
    if (!text) continue;
    const ref = parseReference(text);
    const price = parsePrice(text);
    // Skip pages with no usable signal (cart/no-product captures).
    if (!ref && !price && !text.includes("Nutrilite")) continue;
    out.push({
      source: file,
      reference: ref,
      name: parseName(text),
      size: parseSize(text),
      price,
    });
  }
  return out;
}

// Allow `tsx src/seed/curate-pdfs.ts` to run directly.
if (import.meta.url === `file://${process.argv[1]}`) {
  const parsed = curatePdfs();
  mkdirSync(join(process.cwd(), "data"), { recursive: true });
  writeFileSync(OUT_FILE, JSON.stringify(parsed, null, 2));
  console.log(`curate-pdfs: parsed ${parsed.length} candidates -> ${OUT_FILE}`);
  for (const p of parsed) {
    console.log(`  ${p.reference ?? "?"} | ${p.name ?? "?"} | ${p.size ?? "?"} | ${p.price ?? "?"} (${p.source})`);
  }
  console.log("Note: benefits/dosage/ingredients/disclaimer require human curation from the detail pages.");
}