import { createDatabase } from "./client.js";

const DDL = `
CREATE TABLE IF NOT EXISTS customers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  referrer_phone TEXT,
  consent_version INTEGER NOT NULL,
  consent_timestamp TEXT NOT NULL,
  registered_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS customers_email_unique ON customers (email);
CREATE UNIQUE INDEX IF NOT EXISTS customers_phone_unique ON customers (phone);
CREATE INDEX IF NOT EXISTS customers_referrer_phone_idx ON customers (referrer_phone);

CREATE TABLE IF NOT EXISTS products (
  reference TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  size TEXT NOT NULL,
  price REAL NOT NULL,
  benefits TEXT NOT NULL,
  dosage TEXT NOT NULL,
  ingredients TEXT NOT NULL,
  disclaimer TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS products_category_idx ON products (category);

CREATE TABLE IF NOT EXISTS purchases (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id INTEGER NOT NULL REFERENCES customers(id),
  product_reference TEXT NOT NULL REFERENCES products(reference),
  qty INTEGER NOT NULL DEFAULT 1,
  purchased_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS purchases_customer_id_idx ON purchases (customer_id);

CREATE TABLE IF NOT EXISTS conversations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id INTEGER NOT NULL REFERENCES customers(id),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS conversations_customer_id_idx ON conversations (customer_id);

CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  conversation_id INTEGER NOT NULL REFERENCES conversations(id),
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS messages_conversation_id_idx ON messages (conversation_id);

CREATE TABLE IF NOT EXISTS recommendations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  conversation_id INTEGER NOT NULL REFERENCES conversations(id),
  customer_id INTEGER NOT NULL REFERENCES customers(id),
  symptom TEXT NOT NULL,
  product_references TEXT NOT NULL,
  rationale TEXT NOT NULL,
  consent_version INTEGER NOT NULL,
  guard_blocked INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS recommendations_customer_id_idx ON recommendations (customer_id);
CREATE INDEX IF NOT EXISTS recommendations_created_at_idx ON recommendations (created_at);

CREATE TABLE IF NOT EXISTS guidance (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  product_references TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS guidance_enabled_idx ON guidance (enabled);
`;

/**
 * Creates the SQLite tables. Idempotent (`IF NOT EXISTS`), never drops or
 * alters existing tables — matches the design's "No migration" dev strategy.
 * The DDL mirrors the portable Drizzle schema in src/db/schema.ts.
 */
export async function migrate(db: ReturnType<typeof createDatabase>): Promise<void> {
  db.$client.exec(DDL);
}

/** Convenience: create the default dev database at ./data/dev.sqlite. */
export async function migrateDefault(): Promise<void> {
  const db = createDatabase(process.env.SQLITE_PATH ?? "./data/dev.sqlite");
  await migrate(db);
  db.$client.close();
}

// Allow `tsx src/db/migrate.ts` to run directly.
if (import.meta.url === `file://${process.argv[1]}`) {
  migrateDefault()
    .then(() => console.log("migrate: tables ready"))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}