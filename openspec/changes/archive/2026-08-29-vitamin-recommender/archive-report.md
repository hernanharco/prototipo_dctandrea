# Archive Report — vitamin-recommender

**Status**: ARCHIVED — SDD cycle complete
**Archived at**: 2026-08-29
**Archived to**: `openspec/changes/archive/2026-08-29-vitamin-recommender/`

## Final State (authoritative — at close)

This report records the state of the change AT CLOSE, not at intermediate checkpoints. Where intermediate snapshots (`apply-progress`, `verify-report`) conflict, the highest-authority source wins and is cited below.

| Fact | Final value | Source |
|------|-------------|--------|
| Change chain | Fully applied and merged to `main` — 5 stacked-to-main PRs merged in order | Orchestrator launch prompt (explicit final-state handoff) |
| PR merge commits | ff69b1ec (PR1 backend foundation) → f3bccf44 (PR2 agent+routes) → c410d92f (PR3 frontend chat) → bee927c7 (PR4 CRM /admin) → 5edab408 (PR5 tests) | Orchestrator launch prompt |
| HEAD of `main` | 5edab408 | Orchestrator launch prompt |
| Re-consent correction | Included (commit 0ccebe36 in PR3): `register()` is upsert; `customerService.reConsent()` is no longer dead code; integration test `reconsent.integration.test.ts` (4 tests) | Orchestrator launch prompt |
| Test suite | 27/27 vitest passing — catalog 6, gemini-retry 5, guard 7, reconsent 4, assistant.integration 5 | Orchestrator launch prompt (final count) |
| Frontend build | `pnpm --dir frontend build` OK | Orchestrator launch prompt |
| TypeScript | tsc clean | Orchestrator launch prompt |
| Verify verdict | **PASS WITH WARNINGS** — 11/11 requirements, 18/18 scenarios, 0 CRITICAL, 0 blockers | verify-report + orchestrator final handoff (consistent) |
| Tasks | 21/21 complete | `tasks.md` + `verify-report.md` (consistent) |

### Reconciliation with intermediate snapshots

- `apply-progress` (Engram #1528, written 2026-08-29 16:53) already reported all 5 work units complete (PR1–PR5, stacked-to-main). Final state at close confirms this: full chain merged to `main` at HEAD 5edab408.
- `verify-report` (Engram #1544; `openspec/.../verify-report.md`, written 2026-08-29 18:07) reported PASS WITH WARNINGS with 27/27 tests. This matches the final test count carried forward. No later work changed test counts after verify.
- No contradiction exists between sources; the launch prompt and verify-report agree on every material fact. No unrankable conflict required recording.

## Change Summary

Replaced the simulated landing chat in the `prototipo_dctandrea` monorepo with a real **preventive vitamin recommender** (Nutrilite): a visitor describes a discomfort and the agent recommends Nutrilite products framed as prevention/lifestyle support (never diagnosis or cure), always deferring to medical consultation. Includes a legal boundary, persistent conversation memory, Gemini integration with resilience, a structured product catalog seeded from curated PDFs, a dev-only CRM `/admin` panel, and an append-only recommendation audit log with versioned informed consent.

## Capabilities Created (4 new specs → main)

| Domain | Requirements added | Spec synced to |
|--------|--------------------|----------------|
| vitamin-recommender-agent | 4 (Legal boundary; Purchase-context injection; Persistent conversation memory; Gemini integration resilience) | `openspec/specs/vitamin-recommender-agent/spec.md` |
| product-catalog | 2 (Structured product schema; Seed from PDFs) | `openspec/specs/product-catalog/spec.md` |
| customer-crm | 3 (Admin panel scope; Dev-only exposure guard; Recommendation visibility) | `openspec/specs/customer-crm/spec.md` |
| recommendation-audit-log | 2 (Auditable recommendation log; Informed consent capture) | `openspec/specs/recommendation-audit-log/spec.md` |

**Total**: 4 capabilities, 11 requirements, 18 scenarios. All 4 delta specs were full specs (no pre-existing main specs), so each was promoted verbatim to main via mechanical shell copy (empty `diff -r` readback per spec).

## Key Decisions (as documented in design.md)

- **ADR-1** Hono (`hono` + `@hono/node-server`) for the backend API.
- **ADR-2** Purchase-context injection server-side, NOT tool-calling.
- **ADR-3** Drizzle ORM + SQLite (`better-sqlite3`), portable schema.
- **ADR-4** Structured catalog + seed from curated PDFs (idempotent upsert on reference; incomplete rows flagged).
- **ADR-5** Prompt hard-limit + deterministic regex guard (defense in depth).
- **ADR-6** Registration gate (`POST /assistant/register`).
- **ADR-7** vitest for the test suite.
- **Re-consent as upsert** — `register()` re-consents in place, preserving customer id/history/audit; the stale `customerService.reConsent()` dead code was removed (commit 0ccebe36).
- **Append-only audit log** — recommendation log is INSERT+SELECT only at service and API layers; no UPDATE/DELETE route exposed; `/admin` recommendations GET-only.

## Open Findings for Future Iterations

- **WARNING (non-blocking)**: Catalog-context injection is derived ONLY from the customer's purchase history, not the full catalog (`backend/src/routes/assistant.ts:91-103`). Users with NO purchase history get an empty catalog block in the prompt and receive no product suggestions, which weakens the core recommender purpose. Does NOT breach legal/consent/audit boundaries. Recommend feeding the full catalog (`catalog.listAll()`) as product context while keeping purchases separate. Registered for a future iteration.
- **SUGGESTION 1**: No explicit automated test for the `/admin` dev-only guard asserting 403 when `NODE_ENV !== "development"` and 200 in development (currently only covered indirectly by the append-only DELETE test). Add a focused admin-guard test.
- **SUGGESTION 2**: `GEMINI_MODEL` default is `gemini-1.5-flash` (`gemini.ts:14`); confirm the model is still served by Google's v1beta API before release; update `DEFAULT_GEMINI_MODEL` if retired.

## Open Risks

- **`/admin` without auth is dev-only by design** (no authentication, conscious prototype decision). Basic auth is a **deploy blocker** before any non-dev/public deployment — LOPD/GDPR PII/health-data exposure risk. Documented in design.md Risks and customer-crm spec Purpose.

## Intentional Archive Notes

None — this is a clean archive. No partial archive, no stale-checkbox reconciliation, no CRITICAL issues. All gates passed:
- Task Completion Gate: `tasks.md` 21/21 checked (verified before sync).
- CRITICAL gate: verify-report has 0 CRITICAL findings.
- Native Review Receipt Gate: no review was discovered for this candidate (`reviewGate` structurally absent); archive proceeds under ordinary repository policy. No receipt topics were read because none exist.

## Engram Traceability — Observation IDs Read

| Artifact | Observation ID |
|----------|----------------|
| sdd/vitamin-recommender/explore | #1519 |
| sdd/vitamin-recommender/proposal | #1520 |
| sdd/vitamin-recommender/spec | #1521 |
| sdd/vitamin-recommender/design | #1522 |
| sdd/vitamin-recommender/tasks | #1526 |
| sdd/vitamin-recommender/apply-progress | #1528 |
| sdd/vitamin-recommender/verify-report | #1544 |
| delivery decision (5-PR chain) | #1527 |

Filesystem artifacts read: `proposal.md`, `design.md`, `exploration.md`, `tasks.md`, `verify-report.md`, `specs/{vitamin-recommender-agent,product-catalog,customer-crm,recommendation-audit-log}/spec.md`.

No review `transaction`/`ledger`/`receipt`/`gate-context` topics were read because no review gate was ever discovered for this candidate (structurally absent).

## Mechanical Copy Evidence

- Spec sync: `diff -r` empty (no differences) for all 4 domains → PASS.
- Archive move: `git mv` used; recursive snapshot vs archived tree `diff -r` empty (no differences) → PASS. archive-report.md is additive-only and excluded from the comparison.
- No application code modified. No commits created by this phase (filesystem moves are staged for the project flow).