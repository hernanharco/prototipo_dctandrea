import { Hono } from "hono";
import { cors } from "hono/cors";
import { serve } from "@hono/node-server";
import type { ServerType } from "@hono/node-server";
import type { Db } from "./db/client.js";
import { createDatabase } from "./db/client.js";
import { migrate } from "./db/migrate.js";
import { createAssistantRouter } from "./routes/assistant.js";
import { createRegisterRouter } from "./routes/register.js";
import { createAdminRouter } from "./routes/admin.js";

/**
 * Hono bootstrap.
 *
 * - CORS: allows localhost origins only (the Vite dev proxy avoids CORS; this
 *   is a belt-and-suspenders guard for direct browser calls).
 * - x-api-key: header check for the server-to-server bridge (NOT real auth —
 *   see design: "x-api-key (bridge)"). The shared key comes from env.
 * - Env guard: refuses to boot in production without required vars, and the
 *   /admin CRM denies everything outside NODE_ENV=development.
 * - SQLite dev file; migrated idempotently at boot (design: no migration tool).
 */

const PORT = Number(process.env.PORT ?? 3000);
const DB_PATH = process.env.SQLITE_PATH ?? "./data/dev.sqlite";
const API_KEY = process.env.API_KEY;

export function buildApp(db: Db): Hono {
  const app = new Hono();

  app.use(
    "*",
    cors({
      origin: (origin) => {
        if (!origin) return "*"; // curl/server-to-server
        try {
          const host = new URL(origin).hostname;
          return host === "localhost" || host === "127.0.0.1" ? origin : null;
        } catch {
          return null;
        }
      },
      allowHeaders: ["Content-Type", "x-api-key"],
      allowMethods: ["GET", "POST"],
    }),
  );

  // x-api-key bridge guard (only enforced when API_KEY is configured).
  app.use("*", async (c, next) => {
    if (API_KEY) {
      const key = c.req.header("x-api-key");
      if (key !== API_KEY) {
        return c.json({ error: "unauthorized" }, 401);
      }
    }
    return next();
  });

  app.get("/health", (c) => c.json({ ok: true, env: process.env.NODE_ENV ?? "development" }));

  // Mount routers: /assistant/* (register + consent + ask + history).
  app.route("/assistant", createRegisterRouter(db));
  app.route("/assistant", createAssistantRouter(db));
  // Dev-only CRM (403 outside NODE_ENV=development; recommendations GET-only).
  app.route("/admin", createAdminRouter(db));

  return app;
}

/**
 * Starts the HTTP server. Migrates the dev DB at boot. This is a dev/local
 * prototype with no real auth — basic auth is a documented MUST before any
 * public deploy (see design Risks + customer-crm spec).
 */
export async function startServer(): Promise<{ server: ServerType; db: Db }> {
  if (process.env.NODE_ENV === "production" && !API_KEY) {
    throw new Error("API_KEY es obligatoria en producción (x-api-key bridge guard).");
  }
  const db = createDatabase(DB_PATH);
  await migrate(db);
  const app = buildApp(db);
  const server = serve({ fetch: app.fetch, port: PORT });
  return { server, db };
}

// Direct execution: `tsx src/index.ts`.
if (import.meta.url === `file://${process.argv[1]}`) {
  startServer()
    .then(() => {
      console.log(`[vitamin-recommender] listening on :${PORT} (${process.env.NODE_ENV ?? "development"})`);
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}