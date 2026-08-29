import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import * as schema from "./schema.js";

/**
 * SQLite client factory.
 *
 * - `:memory:` keeps the instance in RAM (used by tests and by ephemeral
 *   runtimes). The in-memory DB is per-connection; every caller that needs the
 *   same instance must reuse the same `sqlite` handle.
 * - Any other path creates a file-backed DB, creating parent directories as
 *   needed.
 *
 * Production guard: this is a dev/local SQLite prototype. A file path is
 * always allowed here; enforcing NODE_ENV for a remote Postgres deployment is
 * handled at the API bootstrap layer (index.ts), not inside the client.
 */
export function createDatabase(dbPath: string): ReturnType<typeof drizzle<typeof schema>> {
  if (dbPath !== ":memory:") {
    mkdirSync(dirname(dbPath), { recursive: true });
  }
  const sqlite = new Database(dbPath);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  return drizzle(sqlite, { schema });
}

export type Db = ReturnType<typeof createDatabase>;