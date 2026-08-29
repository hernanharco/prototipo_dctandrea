import { Hono } from "hono";
import type { Db } from "../db/client.js";
import { createCatalogService } from "../services/catalogService.js";
import { createRecommendationService } from "../services/recommendationService.js";
import { customers, conversations, purchases } from "../db/schema.js";

/**
 * Dev-only CRM routes under /admin.
 *
 * - 403 unless NODE_ENV === "development" (LOPD/GDPR guard — never expose PII
 *   or health/purchase data on a public host).
 * - `recommendations` is GET-only: the audit log is append-only, so no
 *   POST/PUT/DELETE is exposed here or anywhere (see design ADR + audit spec).
 * - No real auth: basic auth is a documented MUST before any non-dev deploy.
 */
export function createAdminRouter(db: Db): Hono {
  const app = new Hono();

  // Dev-only guard: deny everything outside development.
  app.use("*", async (c, next) => {
    if (process.env.NODE_ENV !== "development") {
      return c.json({ error: "forbidden" }, 403);
    }
    return next();
  });

  const catalog = createCatalogService(db);
  const recommendations = createRecommendationService(db);

  app.get("/catalog", (c) => c.json({ products: catalog.listAll() }));
  app.get("/customers", (c) => c.json({ customers: db.select().from(customers).all() }));
  app.get("/conversations", (c) => c.json({ conversations: db.select().from(conversations).all() }));
  app.get("/purchases", (c) => c.json({ purchases: db.select().from(purchases).all() }));
  // Recommendations: GET-only (append-only audit log). No POST/PUT/DELETE.
  app.get("/recommendations", (c) => c.json({ recommendations: recommendations.listAll() }));

  return app;
}