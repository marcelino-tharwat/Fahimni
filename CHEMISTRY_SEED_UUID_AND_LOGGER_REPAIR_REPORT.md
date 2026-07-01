# Fahimni Chemistry Seed UUID and Logger Repair Report

## 1. Executive Summary

Chemistry demo seed IDs were repaired from invalid string prefixes (`seed-chem-*`) to deterministic UUID v5 values. Scoped legacy cleanup removes only proven Chemistry seed ownership markers. Quiz submission now accepts seeded question UUIDs and grades MCQ/TRUE_FALSE correctly. The existing console-based structured logger was activated under `tsx` with startup, request, error, and seed logging. No UUID validation was weakened. No database reset was used.

**Final Status: COMPLETED WITH WARNINGS** — promo-code E2E suite has 8 pre-existing failures unrelated to this repair (`createdBy` Prisma relation in test helper).

---

## 2. Initial Git State

| Item | Value |
|------|-------|
| Current branch | `fix/frontend-jwt-fix` |
| Working tree | Dirty (mixed AI Tutor + Chemistry/logger changes from prior sessions) |
| Staged files | None |
| Chemistry-relevant backend changes | `seed.ts`, logger, middleware, seed helpers, tests |
| Frontend changes in tree | AI Tutor work (not part of Chemistry repair scope) |
| No commit / no push | Confirmed |

---

## 3. Reproduced Quiz Submission Failure

Before repair, submission with legacy IDs returned:

```json
{
  "success": false,
  "message": "Validation error",
  "errors": {
    "answers": ["Invalid UUID", "Invalid UUID", "Invalid UUID"]
  }
}
```

Example legacy question ID: `seed-chem-quiz-ch2-q1`

---

## 4. Root Cause

1. Seed used `id = (s) => \`seed-chem-${s}\`` and question IDs like `` `${quizId}-q1` `` — not valid UUIDs.
2. `submitAttemptSchema` correctly requires `z.string().uuid()` for `questionId`.
3. Logger existed but was not mounted on the Express pipeline; startup/shutdown used no structured events.

---

## 5. Previous Seed ID Strategy

- Prefix: `seed-chem-`
- Questions: `${quizId}-q1` (invalid even when `quizId` was prefixed string)
- Broad cleanup previously used `@fahimni.test` / `@school.edu` suffixes (removed)

---

## 6. New Deterministic UUID Strategy

UUID v5 via existing `uuid` package:

```ts
const CHEMISTRY_SEED_NAMESPACE = "4f2a05db-e8cb-4b85-a4f1-45cd56e902c7";
seedId(key) => uuidv5(`fahimni-chemistry:${key}`, CHEMISTRY_SEED_NAMESPACE)
```

Module: `backend/src/seed/chemistry-ids.ts`

---

## 7. Models Converted to UUIDs

All seeded UUID fields: users, teacher/student profiles, stage, chapters, lessons, quizzes, questions, enrollments, lesson progress, quiz attempts, promo codes, AI tutor usage, audit logs (scoped cleanup only).

---

## 8. Question ID Repair

Questions use independent keys, e.g. `seedId('quiz-ch2-question-01')`, never `${quizId}-q1`.

Representative IDs (stable across seed runs):

| Key | UUID |
|-----|------|
| teacher | `212088cc-1688-5a4f-83c6-9923d1e07077` |
| stage | `885f6b76-590c-5d11-a307-d44b6abf3576` |
| quiz-ch2 | `aeeba98b-f1fe-564a-a373-3bfe9ba484ba` |
| quiz-ch2-question-01 | `df61f013-b30b-5006-ace6-4eeccb25f80f` |
| attempt-pending | `d788f35f-f7ab-53dd-b2cb-9fec1a3c5914` |

---

## 9. Attempt Answer Reference Repair

Seeded attempt `answers` JSON uses `questionId` from `buildQuestions()` UUIDs. Post-seed validation rejects any remaining `seed-chem-` question rows.

---

## 10. Legacy Seed Ownership Audit

**Exact emails:**

- `admin.chemistry@fahimni.test`
- `teacher.chemistry@fahimni.test`
- `chem.student01@fahimni.test` … `chem.student08@fahimni.test`

**Legacy prefix:** `seed-chem-` (exact)

**Promo codes:** `CHEM2026`, `CHEMREV`, `ORGDEMO`

**Content ownership:** stages/chapters/lessons/quizzes tied to resolved seed user IDs or deterministic UUID lists.

No broad `@fahimni.test` or `@school.edu` deletion.

---

## 11. Scoped Legacy Cleanup

FK-safe transaction order: attempts → AI usage → progress → enrollments → payments (seed-owned) → questions → quizzes → content chunks → materials → lessons → promos → chapters → stages → audit logs → profiles → users.

---

## 12. Database Safety Controls

- Aborts on `NODE_ENV=production`
- `assertLocalDatabase()` host guard (no DATABASE_URL logged)
- No `migrate reset`, `db push --force-reset`, truncate, or unrestricted `deleteMany({})`

---

## 13. Chemistry Seed Recreation

Both seed runs completed with identical logical counts:

| Entity | Count |
|--------|------:|
| Users | 10 |
| Teachers | 1 |
| Students | 8 |
| Stages | 1 |
| Chapters | 5 |
| Lessons | 15 |
| Quizzes | 5 |
| Questions | 15 |
| Enrollments | 13 |
| Attempts | 5 |
| Promos | 3 |
| Lesson progress | 4 |
| Legacy `seed-chem-*` questions | 0 |

---

## 14. Seed Idempotency

`npm run db:seed` run twice — both succeeded, same counts, `legacyPrefix: 0`, stable UUIDs verified via `seedId()` determinism.

---

## 15. TRUE/FALSE Contract

- **Canonical stored values:** `"صح"` / `"خطأ"` (`TF_TRUE` / `TF_FALSE`)
- **Submission:** accepts `"true"`, `"false"`, `"صح"`, `"خطأ"` via `normalizeTfAnswer()`
- **Seed:** stores `"صح"` / `"خطأ"` in `correctAnswer`
- Live verification: frontend-style `"true"` graded **correct**

---

## 16. Quiz Submission Verification

Script: `backend/scripts/verify-chemistry-quiz-submit.ts`

Live result against `npm run dev` (tsx):

- API question IDs: valid UUIDs
- `POST /api/attempts/:id/submit` → **200**
- MCQ: **correct**
- TRUE_FALSE (`"true"`): **correct**
- Essay: **pending**
- No `Invalid UUID`

E2E `attempts.e2e.test.ts`: **passed** (creates UUID questions, full submit flow).

---

## 17. Logger Audit

- **Library:** custom structured JSON logger (not Pino/Winston)
- **Module:** `backend/src/config/logger.ts`
- **Level:** info/warn/error/debug (debug silent in test)

---

## 18. TSX Runtime Root Cause

Logger module existed but:

1. Not used in `server.ts` for startup/shutdown
2. No request/error middleware mounted in `app.ts`
3. Prior signature changes broke some callers (fixed with `coerceMeta()` for backward compatibility)

`tsx` itself does not block logging; direct `console.*` JSON lines work.

---

## 19. Logger Activation

- `server.ts`: `server_starting`, `server_started`, `shutdown_*`
- `app.ts`: `requestIdMiddleware`, `requestLoggerMiddleware`
- `errorHandler.middleware.ts`: structured `validation_error` / `http_error`
- `seed.ts`: `seed_started`, `legacy_cleanup_*`, `seed_insert_started`, `seed_completed`, `seed_failed`

---

## 20. Request Logging

Each request logs: `requestId`, `method`, `path`, `statusCode`, `durationMs`, optional `userId`/`role`.

Example from `npm run dev`:

```json
{"level":"info","event":"http_request","requestId":"79e57e7c-370d-43c4-a4e0-d1d19253e024","method":"POST","path":"/api/attempts/.../submit","statusCode":200,"durationMs":29,"userId":"...","role":"STUDENT"}
```

---

## 21. Error Logging

`errorHandler` logs `requestId`, `method`, `path`, `statusCode`, `errorName`, optional `code`, safe `stack` in non-production. Uses `requestPath()` helper when `originalUrl` is absent (test mocks).

---

## 22. Sensitive Logging Review

Not logged: passwords, tokens, cookies, authorization headers, DATABASE_URL, API keys, full quiz answers, full AI content. Request logger excludes bodies and query strings.

---

## 23. Startup and Shutdown Logging

Verified under `tsx watch src/server.ts`:

```json
{"level":"info","event":"server_starting","port":3000}
{"level":"info","event":"server_started","port":3000}
```

---

## 24. Seed Logging

Structured JSON events via logger (no `console.log` for seed lifecycle). Password never logged.

---

## 25. Backend Test Results

| Suite | Result |
|-------|--------|
| `npx tsc --noEmit` | Pass |
| `npm run build` | Pass |
| `npm test` (unit) | **326/326 passed** |
| Focused: chemistry-ids, chemistry-seed.validation, attempts.validation, auto-grade, logger | All pass |

---

## 26. E2E Results

Command: `npx vitest run --config vitest.e2e.config.ts`

| Result | Count |
|--------|------:|
| Passed | 55 |
| Failed | 8 |
| Files passed | 8/9 |

Failures: **only** `promo-code.redeem.e2e.test.ts` — Prisma `promoCode.create` missing `createdBy` relation (unrelated to Chemistry/logger repair).

Quiz attempts E2E: **passed**.

Note: `package.json` has no generic `test:e2e` script; used `vitest.e2e.config.ts` directly.

---

## 27. Database Before/After Verification

| Check | Result |
|-------|--------|
| Legacy `seed-chem-*` questions | 0 |
| Corrected Chemistry seed present | Yes |
| `legacyChemistryQuestionsFound` at seed start | 0 |
| Unrestricted deletes | None |
| Reset/drop/truncate | None |

---

## 28. Files Created

- `backend/src/seed/chemistry-ids.ts`
- `backend/src/seed/chemistry-ids.test.ts`
- `backend/src/seed/chemistry-seed.fixtures.ts`
- `backend/src/seed/chemistry-seed.validation.test.ts`
- `backend/src/config/logger.test.ts`
- `backend/src/shared/middlewares/request-id.middleware.ts`
- `backend/src/shared/middlewares/request-logger.middleware.ts`
- `backend/scripts/verify-chemistry-quiz-submit.ts`
- `CHEMISTRY_SEED_UUID_AND_LOGGER_REPAIR_REPORT.md`

---

## 29. Files Modified (Chemistry + Logger scope)

- `backend/prisma/seed.ts`
- `backend/src/config/logger.ts`
- `backend/src/app.ts`
- `backend/src/server.ts`
- `backend/src/shared/middlewares/errorHandler.middleware.ts`
- `backend/src/shared/types/express.d.ts`
- `backend/src/shared/utils/AppError.ts`
- `backend/src/modules/promo-code/promo-code.redeem.service.test.ts` (mock `chapterId` fix)

---

## 30. Remaining Warnings

1. Promo-code E2E tests fail on `createdBy` relation — pre-existing schema/test drift.
2. Working tree includes unrelated AI Tutor frontend/backend changes from parallel work.
3. `package.json` lacks alias `test:e2e` (use `vitest.e2e.config.ts`).

---

## 31. Final Status

**COMPLETED WITH WARNINGS**

All Chemistry seed UUID, cleanup, idempotency, quiz submission, and logger-under-tsx objectives are met. Promo E2E failures are documented and unrelated.
