# Proposal: Vitamin Recommender (Nutrilite)

## Intent

Replace the simulated landing chat with a real **preventive vitamin recommender**: the visitor describes a discomfort and the agent recommends Nutrilite products for prevention (never diagnosis/cure), always deferring to medical consultation. The doctor needs a **legal protection layer** (disclaimers, informed consent, auditable recommendation log) and a **CRM** to manage catalog, customers, purchases, and conversations. This is the first end-to-end change: frontend chat → bridge → backend agent + DB → Gemini.

## Scope

### In Scope
- Backend service (Hono + TS + Drizzle + SQLite) with agent, DB, and API (`assistant/ask`, `assistant/history`).
- Nutrilite structured catalog seeded from PDFs (`products`), source of truth.
- Real chat in `ChatWidget.tsx` with persistent user memory and informed-consent first-use gate.
- Legal layer: hard limit in system prompt + deterministic post-process guard + consent log + `recommendations` audit table.
- Basic `/admin` CRM (catalog, customers, purchases, conversations, recommendation log), no auth — dev only.

### Out of Scope
- Authentication/authorization (CRM auth deferred; basic auth before any Internet exposure).
- Payment gateway, real booking (Booking.tsx stays simulated), production deployment.
- RAG as source of truth (only optional enrichment later), no test runner.

## Capabilities

### New Capabilities
- `vitamin-recommender-agent`: LLM agent with memory, purchase-context injection, legal boundaries (prompt limit + guard), Gemini integration.
- `product-catalog`: structured Nutrilite catalog (products, prices, dosage, disclaimers) as source of truth.
- `customer-crm`: admin panel for catalog/customers/purchases/conversations/recommendations; dev-only, no auth.
- `recommendation-audit-log`: auditable `recommendations` log + informed-consent versioning (legal trail).

### Modified Capabilities
None (no existing specs).

## Approach

Frontend `ChatWidget.tsx` → Vite dev proxy `/api/*` → server-to-server bridge → backend Hono API → Gemini (REST v1beta, `GEMINI_MODEL`/`GEMINI_API_KEY`). User purchases injected server-side from `purchases` (not tool-calling). Data model: `customers`, `products`, `purchases`, `conversations`+`messages`, `recommendations`. Reuses rider-defensa pattern: retry/backoff on 503/429, graceful degradation without key, `x-api-key`. Schema portable SQLite→Postgres via Drizzle.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `backend/` | New | Hono agent service, DB, API, seed script |
| `frontend/src/app/components/ChatWidget.tsx` | Modified | Real chat client + consent + memory |
| `frontend/vite.config.ts` | Modified | Dev proxy for `/api/*` |
| `frontend/src/app/*/admin*` | New | CRM panel `/admin` |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| PII/health data exposed via no-auth CRM | Med | Dev-only route; basic auth flagged as blocker before deploy |
| Medical liability if agent appears to diagnose/cure | Med | Guard + consent + audit log; real-user testing |
| PDF seed curation effort | Med | Manual curation script; catalog is small/tabular |
| SQLite↔Postgres drift | Low | Keep schema Drizzle-portable |

## Assumptions
- Stack: Hono, SQLite→Postgres (or Supabase, team-known), Gemini, structured catalog.
- CRM without auth is an accepted dev-only tradeoff (documented LOPD/GDPR risk).

## Open Questions
- Hono vs Express preference.
- SQLite→Postgres vs Supabase direct.
- CRM dev-no-auth acceptance for prototype.

## Rollback Plan
Keep `ChatWidget.tsx` behind a feature flag; revert to simulated timeout response. Drop backend tables/API without touching frontend. CRM: remove `/admin` route. No destructive DB migration until confirmed.

## Dependencies
- Gemini API key; `~/Documentos/amway/*.pdf` for seed; Vite dev proxy.

## Success Criteria
- [ ] Real chat returns Nutrilite recommendations with consent gate on first use.
- [ ] Agent never diagnoses/cures; guard + log record every recommendation.
- [ ] CRM lists catalog/customers/purchases/conversations/log.
- [ ] `pnpm --dir frontend build` passes.

## First Slice
Backend agent (Hono + SQLite + Gemini) + catalog seed + ChatWidget wiring with consent — the chat works end-to-end before CRM is added.