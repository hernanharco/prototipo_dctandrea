# Design: Vitamin Recommender (Nutrilite)

## Technical Approach

Replace the simulated `ChatWidget` with a real preventive recommender: React chat → Vite dev proxy `/api/*` → server-to-server bridge → Hono API (`assistant/ask`, `assistant/history`) → Drizzle/SQLite → Gemini (REST v1beta). First use requires **registration + informed consent** in one gate (no registration/consent = no chat). Purchases injected server-side from `purchases`; a deterministic post-process guard enforces the legal boundary; every recommendation lands in an **append-only** `recommendations` audit log. CRM `/admin` is dev-only. Maps to proposal; satisfies all 4 delta specs.

## Architecture Decisions

| # | Decision | Options | Tradeoff | Choice |
|---|----------|---------|----------|--------|
| ADR-1 | Backend framework | Hono / Fastify / Express | Hono: TS-first, minimal, rider-defensa parity | **Hono** |
| ADR-2 | Purchase context | server-side injection / Gemini tool-calling | Injection: deterministic, auditable; tool-calling: latency + parse risk | **Injection** |
| ADR-3 | DB engine | Drizzle+SQLite→PG / Supabase | Drizzle: zero infra, portable schema | **Drizzle+SQLite**, portable |
| ADR-4 | Product data | structured `products` seed / RAG | Structured: exact SKUs/doses, no hallucination | **Structured + seed** |
| ADR-5 | Guard strategy | regex only / prompt only / regex+prompt | Regex brittle alone; prompt model-dependent; both = defense in depth | **Prompt hard-limit + regex guard** |
| ADR-6 | First-use identity | registration (name/email/phone/referrer) / anonymous customer | Registration: enables purchase injection + audit trail + Amway referral model | **Registration gate** |
| ADR-7 | Test runner | vitest in backend / none (per proposal) | Guard is legal-critical; "no runner" was a prototype default, now overridden | **Add vitest** (enmends proposal exception) |

## Component Architecture

```
backend/                          frontend/src/
  package.json  (deps: hono, drizzle-orm, better-sqlite3; dev: vitest, tsx)
  src/
    index.ts            (Hono bootstrap, CORS, x-api-key, env guard)
    db/schema.ts        (Drizzle tables)
    db/client.ts        (SQLite driver, NODE_ENV guard)
    db/migrate.ts
    services/catalogService.ts     (lookup by reference → not-found)
    services/customerService.ts    (register + consent versioning)
    services/recommendationService.ts  (append-only log)
    services/conversationService.ts
    agent/prompt.ts     (system prompt, hard limit, disclaimer, catalog refs)
    agent/gemini.ts     (REST v1beta, retry 2s/5s/10s, no-key fallback)
    agent/guard.ts      (deterministic post-process guard)
    routes/assistant.ts (ask/history)
    routes/register.ts  (POST /assistant/register: identity + consent)
    routes/admin.ts     (CRM — dev-only, no DELETE on recommendations)
    config/consent.ts   (CURRENT_CONSENT_VERSION constant + consent text)
    seed/seedProducts.ts, seed/curate-pdfs.ts, seed/seedPurchases.ts
  test/guard.test.ts, test/gemini-retry.test.ts, test/catalog.test.ts
```

Frontend: modify `ChatWidget.tsx` (registration+consent gate, then real client + memory via `assistant/history`); modify `vite.config.ts` (proxy `/api/*`); add `admin/*` pages via react-router (already a dep).

## Data Model (Drizzle, portable SQLite→PG)

`customers`: `id` pk, `name`, `email` uniq, `phone` uniq, `referrer_phone`, `consent_version`, `consent_timestamp`, `registered_at`, `created_at`. idx `referrer_phone` (Amway referral, no network logic yet).
`products`: `reference` pk, `name`, `category`, `size`, `price` real, `benefits`, `dosage`, `ingredients`, `disclaimer`. idx `category`.
`purchases`: `id` pk, `customer_id` fk, `product_reference` fk, `qty` int, `purchased_at`. idx `customer_id`.
`conversations`: `id` pk, `customer_id` fk, `created_at`. idx `customer_id`.
`messages`: `id` pk, `conversation_id` fk, `role`, `content`, `created_at`. idx `conversation_id`.
`recommendations`: `id` pk, `conversation_id` fk, `customer_id` fk, `symptom`, `product_references` (json), `rationale`, `consent_version`, `guard_blocked` bool, `created_at`. idx `customer_id`, `created_at`. **APPEND-ONLY**: no UPDATE/DELETE exposed; immutability enforced by service + API.

## Registration + Consent Flow (first use)

```
ChatWidget (open) → POST /assistant/register {name,email,phone,referrer_phone,consent_version}
   ▼ customerService.upsert()  (email/phone uniq)
   ├─ new/older version → persist consent_version+consent_timestamp, registered_at
   └─ store name/email/phone/referrer_phone (PII — see Risks)
   → 200 {customer_id}
   ▼ subsequent chat
POST /assistant/ask {customer_id, message} → consent_version check
   ├─ version < current → 401 CONSENT_REQUIRED {re-consent trigger} (no recommendation)
   └─ ok → proceed to agent flow
```

Registration is NOT login — no password/session; it is data capture + consent. Bridge passes `customer_id` server-to-server.

**Consent version source of truth**: `CURRENT_CONSENT_VERSION` is a versioned constant in backend config (`config/consent.ts`), bumped whenever the consent/legal text changes. Customers with `consent_version < CURRENT_CONSENT_VERSION` are re-consented before new recommendations; prior records are preserved. The chat UI fetches the current version (via `GET /assistant/consent`) to render the exact legal text it consents to.

## Agent Flow (chat)

```
assistant/ask → consent version ok → conversationService.load(messages)
   → purchases.load(customer_id) → catalogService refs (VALID refs only)
   → prompt(user msg + history + purchases + catalog) 
   → gemini.generate() (retry 429/503; no-key fallback)
   → guard.check(output) → block/rewrite if diagnostic/cure
   → recommendationService.append(...) → messages.save → 200 {reply, guard_blocked, refs}
```

**Product not-found contract**: agent receives only refs present in the injected catalog. If a requested ref is absent → `catalogService.lookup` returns not-found → agent replies it cannot recommend that product rather than inventing details. The system MUST NOT fabricate product data (spec MUST).

## Guard (deterministic post-process)

`guard.ts`: lowercase; reject diagnostic/cure patterns — "diagnos", "padeces", "tratamient", "cura", "curación", "enfermedad", "prescrib", "usted tiene", "dosis médica". Sources of truth: hard limit in `prompt.ts` + product disclaimers. On match: replace with preventive template + medical deferral, set `guard_blocked=true`, append to log. Non-blocking: append disclaimer if absent.

## API Surface

- `POST /assistant/register` `{name,email,phone,referrer_phone,consent_version}` → `200 {customer_id}`; `400` bad body/dup; `409` email/phone taken.
- `GET /assistant/consent` → `{version, text}` — current consent version + exact legal text (rendered by the chat UI before consent).
- `POST /assistant/ask` `{customer_id, conversation_id?, message}` → `200 {conversation_id, reply, guard_blocked, recommended_product_refs}`; `401 CONSENT_REQUIRED` (missing/older version); `503` Gemini exhausted. Product not-found is NOT a technical error: `catalogService.lookup` returns not-found internally and the agent replies in natural language that it cannot recommend that product (never invents details). No `404` is exposed to the chat client.
- `GET /assistant/history?conversation_id=&customer_id=` → `{messages}`.
- `GET/POST/PUT/DELETE /admin/*` (catalog, customers, purchases, conversations) — **403 unless `NODE_ENV=development`**. `recommendations`: **GET only** (append-only audit; no POST/PUT/DELETE).
- Auth: header `x-api-key` (bridge). CORS: dev proxy avoids CORS; backend allows localhost only.

## Seed Strategy

`curate-pdfs.ts` parses `~/Documentos/amway/*.pdf` (PriceList + fichas) → intermediate JSON → human curation validates `reference,name,price,disclaimer` → `seedProducts.ts` upserts on `reference` pk (idempotent; incomplete rows flagged, not inserted). `seedPurchases.ts` associates demo purchases to registered seed customers (`customer_id`).

## Testing Strategy

| Layer | What | Approach |
|-------|------|----------|
| Unit | guard.ts | **vitest**: diagnostic phrases blocked, prevention kept, disclaimer appended |
| Unit | gemini retry | vitest: mock 429/503→backoff→success/fallback |
| Unit | catalog lookup | vitest: valid ref → data; absent ref → not-found (no invention) |
| Integration | register+ask | vitest in-memory SQLite: registration, consent version downgrade → re-consent, purchase injection, history continuity, append-only log (DELETE rejected) |
| Build | frontend | `pnpm --dir frontend build` |

vitest added to backend as a justified exception to the proposal's "no test runner" — the guard is the legal-critical component.

## Threat Matrix

N/A — no git/PR routing, shell, subprocess, VCS automation, executable classification, or process-integration boundary; this is a web API + DB + LLM client.

## Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| PII (name/email/phone) + purchase/health data exposed via no-auth CRM | **HIGH (LOPD/GDPR)** | Guard `NODE_ENV=development` (403 outside dev); consent text declares data use; **basic auth is a deploy blocker**; never expose `/admin` on a public host in the prototype |
| Medical liability if agent appears to diagnose/cure | Med | Prompt hard-limit + regex guard + consent versioning + append-only audit log; real-user testing |
| PDF seed curation effort | Med | Idempotent upsert on `reference`; incomplete rows flagged, not inserted |
| SQLite↔Postgres drift | Low | Drizzle portable schema; Postgres deferred |
| Gemini unavailability | Low | Retry/backoff 503/429; graceful fallback without key |

## Migration / Rollout

No migration. Backend greenfield; `ChatWidget` behind feature flag (revert to simulated). SQLite dev file; Postgres deferred (schema portable).

## Open Questions

- [ ] None blocking — registration flow, consent versioning, not-found contract, and vitest are all resolved.

## Key Learnings

1. The append-only audit log must be enforced at both service and API layers (no UPDATE/DELETE routes on `recommendations`).
2. Consent is version-gated, not presence-gated: a stale `consent_version` triggers re-consent while preserving prior records.
3. The product not-found contract prevents agent hallucination by injecting only valid catalog refs.
4. vitest on the backend overrides the proposal's "no test runner" as a justified exception for the legal-critical guard.
5. Registration (name/email/phone/referrer_phone) is data capture + consent, not login — no password or session.