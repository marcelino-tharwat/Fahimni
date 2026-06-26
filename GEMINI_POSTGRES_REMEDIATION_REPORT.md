# Gemini Client and PostgreSQL Remediation Report

## 1. Executive Summary

The failing `GeminiClient` HTTP 429 unit test was root-caused to **test mock
exhaustion** (the test supplied a single mocked 429 while the client retries; the
second attempt's `fetch` returned `undefined`). Fixing it surfaced a **genuine
production retry-classification defect**: 5xx retryability was decided by
regex-matching the error *message* for digits rather than the HTTP status. Both
were fixed; the targeted suite is now 23/23 and the full suite 170/170. A
PostgreSQL/Prisma audit found one real schema drift (the `promo_codes` table was
missing from both databases although the `PromoCode` model and code require it),
resolved with a forward-only additive migration. STORY-44/47/48 tables were
verified drift-free; the unique attempt constraint was proven to reject duplicates;
STORY-48 E2E passed twice. No database was reset and no development data was modified.

## 2. Initial Test Failure

- Command: `npx vitest run src/shared/services/geminiClient.test.ts --reporter=verbose`
- Test: `GeminiClient > generateContent > throws GeminiRateLimitError on HTTP 429`
- Expected: `GeminiRateLimitError`
- Received: `GeminiNetworkError: Cannot read properties of undefined (reading 'status')`
- Initial count: 23 tests, 22 passed, 1 failed (~3.3s due to real backoff).

## 3. Gemini Root Cause

**Combination of mock exhaustion (primary) and a production error-mapping defect
(secondary).**

- Mock exhaustion: the test used `mockResolvedValueOnce(429)`. The client
  (`MAX_RETRIES = 3`) retries; on attempt 2 the mock was exhausted so `fetch`
  resolved `undefined`, and `_fetchWithTimeout` read `response.status` on
  `undefined` → `TypeError` → wrapped as `GeminiNetworkError`. The final error was
  therefore `GeminiNetworkError`, not `GeminiRateLimitError`. (The 500 test passed
  *by accident* because that wrong error is also a `GeminiNetworkError`.)
- Production defect (found while writing the proper 500-exhaustion assertion):
  `isRetryable` used `/5\d{2}/.test(error.message)`. A 5xx whose JSON body carries
  a descriptive `error.message` with no digits (e.g. "Internal error") was treated
  as **non-retryable**, so a genuinely retryable 500 was not retried. Retryability
  must be driven by the HTTP status, not the message text.
- No timer-cleanup defect: the client clears its abort timeout in `finally`.

## 4. Gemini Fix Applied

Production:
- `src/shared/errors/geminiErrors.ts` — `GeminiNetworkError` now carries an optional
  `status?: number` (set for HTTP-origin errors; undefined for transport failures).
- `src/shared/services/geminiClient.ts` —
  - 5xx branch throws `new GeminiNetworkError(msg, response.status)`.
  - Retry policy is now status-driven:
    `error instanceof GeminiRateLimitError || (error instanceof GeminiNetworkError && error.status !== undefined && error.status >= 500)`
    (replacing the brittle `/5\d{2}/` message regex).

Test (`src/shared/services/geminiClient.test.ts`):
- The 429 and 500 classification tests now return the status for **every** retried
  attempt (`mockResolvedValue`) and assert the final typed error + exact attempt
  count (3). This tests the real "ultimately maps to X after exhaustion" contract.
- All four retry-involving tests use Vitest fake timers + `vi.runAllTimersAsync()`
  to eliminate real backoff; `afterEach(() => vi.useRealTimers())` prevents leakage.
- No assertion was weakened; `GeminiRateLimitError` is still the asserted 429 outcome.

## 5. Gemini Retry Contract

- Max retries: `MAX_RETRIES = 3` total attempts; backoff delays `[500, 1000, 2000] ms`.
- Retryable: HTTP 429 (`GeminiRateLimitError`), HTTP ≥500 (`GeminiNetworkError` with status).
- Non-retryable: 401/403 (`GeminiAuthError`), safety block (`GeminiContentBlockedError`),
  abort/timeout (`GeminiTimeoutError`), genuine transport failure (`GeminiNetworkError`
  without status).
- After exhaustion the final error retains its correct type (429 → `GeminiRateLimitError`,
  5xx → `GeminiNetworkError`).

## 6. Gemini Tests

`npx vitest run src/shared/services/geminiClient.test.ts` → **23 passed, 0 failed**,
~0.8s (no real backoff). No real Gemini call (global `fetch` stubbed).

## 7. PostgreSQL Environment

- PostgreSQL 16.14 (Debian) — Docker service `backend-postgres-1`, Up.
- Host port 15432 → container 5432.
- pgvector extension installed, version 0.8.3.
- Development DB `final_project`: reachable, migrations up to date.
- Test DB `final_project_test`: reachable, migrations up to date.

## 8. Prisma Migration Audit

- 33 → **34** migrations on disk after remediation; `migrate status` = "up to date"
  on both DBs.
- No failed/rolled-back migrations; no applied migration was edited.
- Checksum: no modified-applied-migration concerns.
- Finding: **no on-disk migration creates `promo_codes`** (lost in a merge) — the
  `PromoCode` model exists in the schema and `promo-code.service.ts` uses it, but
  the table was absent from both DBs.
- New migration created: `20260626100000_create_promo_codes_drift_fix` (forward-only,
  additive, idempotent) — creates `promo_codes` with the exact Prisma-canonical
  columns, unique `code` index, `usedByStudentId`/`createdById` indexes, and both
  FKs to `User` (SET NULL / RESTRICT).

## 9. Schema Verification

| Table | Column/Constraint | Expected | Actual (test DB) | Status |
|---|---|---|---|---|
| quizzes | questionCount/totalPoints | INT default 0 | present | ✅ |
| quizzes | status/chapterId/publishedAt | enum/text?/timestamp? | present | ✅ |
| questions | points | INT NOT NULL default 1 | integer, NOT NULL, default 1 | ✅ |
| quiz_attempts | status | AttemptStatus default IN_PROGRESS | `'IN_PROGRESS'::"AttemptStatus"` | ✅ |
| quiz_attempts | unique (quizId, studentId) | present | `quiz_attempts_quizId_studentId_key` | ✅ |
| quiz_attempts | FKs quizId, studentId | present | both present | ✅ |
| enums | QuizStatus/QuestionType/AttemptStatus | exact values | exact | ✅ |
| content_chunks | embedding | vector(3072) | vector(3072) | ✅ |
| promo_codes | table + FKs + indexes | per schema | created by new migration | ✅ |

## 10. Drift Analysis

Drift existed (confirmed via `prisma migrate diff --from-schema --to-config-datasource`,
not just `migrate status`):

1. **`promo_codes` missing** (both DBs) — real defect → **remediated** by the new
   forward-only migration. Re-diff after applying: resolved on both DBs.
2. Dev-only extra index `questions_quizId_idx` (present in dev, not in schema) —
   **harmless** leftover from an earlier (non-disk) migration; not a defect, no story
   impact; left in place (dropping it is unnecessary and out of scope).
3. Test-only `content_chunks.updatedAt` DB default `CURRENT_TIMESTAMP` (from the
   earlier idempotent `20260625071520` rewrite) — **harmless** (Prisma always sets
   `updatedAt`); no functional impact; left in place.

No drift remains on the STORY-44/47/48 tables.

## 11. STORY-48 Migration Review

`20260626000000_story48_attempt_and_points` uses `ADD COLUMN IF NOT EXISTS`. Audit
confirmed the guards did **not** conceal an incorrect definition: on the test DB
(where the columns were created by this migration) every column matches the schema
exactly — `questions.points` INT NOT NULL default 1, `quiz_attempts.status`
AttemptStatus default IN_PROGRESS, totalPoints/startedAt/completedAt correct, and
the unique `(quizId, studentId)` constraint is present. A real duplicate insert was
attempted in a rolled-back transaction and PostgreSQL rejected the second row:
`duplicate key value violates unique constraint "quiz_attempts_quizId_studentId_key"`.

## 12. pgvector Verification

- Extension: installed, v0.8.3.
- `content_chunks.embedding`: `vector(3072)`.
- Embedding model (active `.env`): `gemini-embedding-2` → 3072 dims (verified) — matches.
- Cosine search uses pgvector `<=>`; compatible. No stale `vector(768)` in runtime code.
- No ANN (ivfflat/hnsw) index on `embedding` (sequential scan ordered by `<=>`);
  acceptable at current scale; not added (no evidence of need).

## 13. Database Safety

- Dev schema changed: **yes** — one additive migration created an empty `promo_codes`
  table.
- Dev data changed: **no** — counts unchanged (users 4, stages 4, lessons 38,
  content_chunks 8, quiz_attempts 0).
- Reset/truncate/drop: **none** (only `prisma migrate deploy`).
- Test DB isolation: E2E redirects `DATABASE_URL` to `TEST_DATABASE_URL`
  (`final_project_test`) via a setup file that refuses non-local hosts; cleans only
  test-owned records.

Accurate statement: *The development schema received one additive migration
(creation of an empty `promo_codes` table), but the database was not reset,
truncated, or destructively modified, and no existing rows were changed.*

## 14. E2E Verification

`npm run test:e2e:story48` (isolated `final_project_test`):
- Run 1: **5 passed, 0 failed**.
- Run 2: **5 passed, 0 failed** (repeatable).

## 15. Final Commands and Results

| Command | Result |
|---|---|
| `npx prisma validate` | valid |
| `npx prisma migrate status` (dev & test) | up to date |
| `npx tsc --noEmit` | 0 errors |
| `npm run build` | success (after freeing disk space) |
| targeted Gemini test | 23 passed / 0 failed |
| `npx vitest run` (full) | **170 passed / 0 failed** (12 files) |
| STORY-48 E2E run 1 | 5 passed |
| STORY-48 E2E run 2 | 5 passed |

(Note: `npm run build` first failed with `ENOSPC: no space left on device` — the
host disk was 100% full; resolved by clearing regenerable caches/artifacts, then
the build succeeded.)

## 16. Files Changed

Gemini remediation:
- `src/shared/services/geminiClient.ts`
- `src/shared/errors/geminiErrors.ts`
- `src/shared/services/geminiClient.test.ts`

Drift remediation:
- `prisma/migrations/20260626100000_create_promo_codes_drift_fix/migration.sql` (new)

Report:
- `GEMINI_POSTGRES_REMEDIATION_REPORT.md` (this file)

(Other modified files shown by `git status` — schema.prisma, app.ts, attempts.*,
the 20260626000000 migration, vitest configs, reports — are from the prior
STORY-45/48 work, not this remediation.)

## 17. Remaining Risks

- **`.env.example` (tracked) currently contains real-looking secret values**
  (Gemini key, Cloudinary/Supabase keys). It was modified outside this task and was
  not reverted per instruction. It must be scrubbed before any commit/push. Nothing
  was committed here.
- Embedding-model **fallback default** in code is `text-embedding-004` (768-dim),
  which would mismatch `vector(3072)` *if* `GEMINI_EMBEDDING_MODEL` were unset. The
  active `.env` sets `gemini-embedding-2` (3072), so there is no active mismatch;
  left unchanged per the "don't change unless real mismatch" rule. Recommend aligning
  the fallback default with the 3072-dim model.
- Two harmless cosmetic drifts remain (dev `questions_quizId_idx`, test
  `content_chunks.updatedAt` default); neither affects correctness or any story.
- Host disk reached 100%; monitor free space.

## 18. Final Status

**Completed** — Gemini test passes (23/23), full suite passes (170/0), real schema
drift (`promo_codes`) resolved via a forward-only migration, the unique attempt
constraint is present and proven to reject duplicates, the E2E database is isolated
and passed twice, migration history is consistent, and no secrets were committed.
