# Tasks: Vitamin Recommender (Nutrilite)

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~1600–2000 |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR1 backend foundation → PR2 agent+routes → PR3 frontend chat → PR4 CRM → PR5 tests |
| Delivery strategy | ask-on-risk |
| Chain strategy | stacked-to-main |

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|------|------|-----------|----------------------|-----------------|-------------------|
| 1 | Backend foundation: schema, db client, config/consent, catalogService, seed | PR 1 | `pnpm --dir backend exec vitest run test/catalog.test.ts` | `pnpm --dir backend dev` + `GET /assistant/consent` | Remove `backend/src/db|config|services|catalog` + seed; no consumer yet |
| 2 | Agent (prompt/gemini/guard) + routes register/assistant/admin + index bootstrap | PR 2 | `vitest run test/guard.test.ts test/gemini-retry.test.ts` | `curl -X POST /assistant/register` then `/assistant/ask` (no key fallback) | Revert agent+routes files; guard tests still pass on PR1 |
| 3 | Frontend ChatWidget gate + vite proxy + memory | PR 3 | `pnpm --dir frontend build` | Manual chat in dev browser against PR2 backend | ChatWidget behind feature flag → restore simulated client |
| 4 | CRM /admin pages (dev-only, recommendations read-only) | PR 4 | `pnpm --dir frontend build` | Dev browser `/admin`; assert 403 outside `NODE_ENV=development` | Remove admin routes/pages; no shared code touched |
| 5 | vitest backend suite + integration register+ask | PR 5 | `pnpm --dir backend exec vitest run` | In-memory SQLite integration | Tests only; zero prod code |

## Phase 1: Backend Foundation

- [x] 1.1 Create `backend/package.json` (deps: hono, drizzle-orm, better-sqlite3; dev: vitest, tsx)
- [x] 1.2 Create `backend/src/db/schema.ts` (customers, products, purchases, conversations, messages, recommendations; append-only log)
- [x] 1.3 Create `backend/src/db/client.ts` (SQLite driver + NODE_ENV guard) and `db/migrate.ts`
- [x] 1.4 Create `backend/src/config/consent.ts` (`CURRENT_CONSENT_VERSION` + exact consent text)
- [x] 1.5 Create `backend/src/services/catalogService.ts` (`lookup(reference)` → not-found; valid refs only, never invent)
- [x] 1.6 Create `backend/src/seed/curate-pdfs.ts` → `seedProducts.ts` (idempotent upsert on reference; flag incomplete rows) + `seedPurchases.ts`

## Phase 2: Agent Core

- [x] 2.1 Create `backend/src/agent/prompt.ts` (system prompt, hard limit, disclaimer, injected catalog refs)
- [x] 2.2 Create `backend/src/agent/gemini.ts` (REST v1beta; retry 429/503 2s/5s/10s; graceful no-key fallback)
- [x] 2.3 Create `backend/src/agent/guard.ts` (deterministic diagnostic/cure patterns; block/rewrite + deferral; `guard_blocked`)
- [x] 2.4 Create `backend/src/services/recommendationService.ts` (append-only; no UPDATE/DELETE exposed)
- [x] 2.5 Create `backend/src/services/conversationService.ts` (load/save messages; conversationService.load)

## Phase 3: API Routes + Registration/Consent

- [x] 3.1 Create `backend/src/routes/register.ts` (`POST /assistant/register` → 200 {customer_id}; 400 dup; 409 email/phone taken)
- [x] 3.2 Create `backend/src/routes/assistant.ts` (`GET /assistant/consent`; `POST /assistant/ask` → 401 CONSENT_REQUIRED on stale version; `GET /assistant/history`)
- [x] 3.3 Create `backend/src/routes/admin.ts` (dev-only; 403 outside `NODE_ENV=development`; recommendations GET-only)
- [x] 3.4 Create `backend/src/index.ts` (Hono bootstrap, CORS localhost, `x-api-key` header, env guard)

## Phase 4: Frontend Chat (end-to-end slice)

- [ ] 4.1 Modify `frontend/src/app/components/ChatWidget.tsx` (registration+consent gate → real client + memory via `/assistant/history`; render consent text from `GET /assistant/consent`)
- [ ] 4.2 Modify `frontend/vite.config.ts` (proxy `/api/*` → backend)

## Phase 5: CRM /admin Pages (dev-only)

- [ ] 5.1 Add `/admin` routes + pages via react-router (catalog, customers, purchases, conversations)
- [ ] 5.2 Wire admin UI to `/admin/*` endpoints; recommendations read-only (no POST/PUT/DELETE)

## Phase 6: Testing + Build

- [x] 6.1 `backend/test/guard.test.ts` (diagnostic phrases blocked, prevention kept, disclaimer appended)
- [x] 6.2 `backend/test/gemini-retry.test.ts` (mock 429/503 → backoff → success/fallback)
- [ ] 6.3 `backend/test/catalog.test.ts` (valid ref → data; absent ref → not-found, no invention)
- [ ] 6.4 `backend/test/integration register+ask` (in-memory SQLite: register, consent downgrade → re-consent, purchase injection, history continuity, append-only DELETE rejected)
- [ ] 6.5 Verify `pnpm --dir frontend build` passes

## Rollback

No migration; SQLite dev file; ChatWidget revertible to simulated via feature flag. If `/admin` accidentally ships on a public host → basic auth required (deploy blocker).