# STORY-64 AI Tutor API Endpoint Report

## 1. Executive Summary

Added the authenticated `POST /api/tutor/ask` endpoint on top of the existing
STORY-63 `AiTutorService`. The endpoint validates the question (Zod, 10–500
chars after trim, strict body), requires an authenticated **student**, enforces
an **active-enrollment** precondition (401), enforces an **atomic per-student
daily quota** (429), reuses `AiTutorService.ask` under a **sub-20s budget**, maps
the result to the **public** shape (no `relevanceScore`), and logs a structured
audit event.

STORY-63 was **reused, not rebuilt**. The only change to the service is an
additive optional per-call timeout budget on `ask()` (defaults preserved for all
other callers). No second AiTutorService / Gemini / embedding / RAG / Prisma /
auth / rate-limit system was created. No frontend, no streaming, no conversation
memory. One small additive migration (`ai_tutor_usage`) backs the daily limit.

Status: **Completed** (with one pre-existing, unrelated failure noted in §18).

## 2. Baseline Health

- Branch: `feature/story-63-ai-tutor-service` (STORY-63 committed at `2508b5c`).
- `npx prisma validate`: valid. `npx prisma migrate status`: up to date (pre-change).
- pg `final_project` reachable; pgvector 0.8.3; embedding `vector(3072)`.
- `npx tsc --noEmit`: clean.
- Unit/integration baseline: **247 tests, 246 passed, 1 pre-existing failure**
  (`quiz-generation.service.test.ts > calls Gemini with a 20s timeout configuration`
  — expects 20s but quiz-gen code default is 55s; predates this work, unrelated).
- E2E baseline: `attempts.e2e.test.ts` had **2 pre-existing failures** (proven in
  §18 by stashing all STORY-64 changes and re-running).

## 3. STORY-63 Dependency Audit

`sprints.md` read at `c:/Users/kerol/Downloads/Fahimni/sprints.md`, STORY-63
(lines 1860–1885) and STORY-64 (1889–1914).

- Service path reused: `src/modules/ai/tutor/ai-tutor.service.ts` → singleton `aiTutorService`.
- Signature (before): `ask(question: string, studentId: string): Promise<TutorAnswer>`.
- Result type: `{ answer: string; citations: Array<{ lessonId, lessonTitle, chapterName, relevanceScore }> }`.
- Not-found behavior: returns localized message + `[]` without calling Gemini.
- Access control: enrollment-scoped lessons (`enrollments.some({ studentId, status: ACTIVE })`).
- Timeouts: total 25s / retrieval 15s / generation 10s (instance defaults).
- Errors: `TutorValidationError` (400), `TutorTimeoutError` (504), `TutorSafetyBlockedError` (422), `TutorUnavailableError` (503) — all extend `AppError`.
- Module registration: singleton-export convention (no `*.module.ts` exists).
- Tests reused/passing: service (29), parser (8), prompt (11), STORY-63 integration e2e (6).

Dependency gap for STORY-64: the service had a fixed 25s budget (> the 20s
endpoint target) and `ask` took no per-call budget. Smallest safe fix: an
**additive optional 3rd param** `options?: TutorAskOptions` on `ask()`. Defaults
unchanged ⇒ no other consumer affected. Covered by 2 new regression tests.

## 4. Existing Backend Architecture Reused

| Concern | Existing implementation | Reused? | STORY-64 change |
| --- | --- | --: | --- |
| Routing/mount | `app.use("/api/...")` in `app.ts` | Yes | + `app.use("/api/tutor", tutorRouter)` |
| Auth | `authenticateMiddleware` | Yes | attached to route |
| Role | `authorizeMiddleware("STUDENT")` | Yes | attached to route |
| Validation | `validateRequest(zodSchema)` | Yes | new DTO schema |
| Error envelope | `errorHandler` + `AppError` (+ `reason`) | Yes | 2 new AppError subclasses |
| Response envelope | `okResponse(message, data)` | Yes | used |
| Logger | `logger.info/warn(message, meta)` | Yes | structured event |
| Enrollment | `EnrollmentService` | Yes | + `hasActiveEnrollment()` |
| AI Tutor | `aiTutorService` | Yes | + per-call budget option |
| Config | `env.ts` (Zod) | Yes | + `AI_TUTOR_DAILY_QUERY_LIMIT` |

The global IP `rateLimiter` (express-rate-limit, in-memory, 100/15min) is **not**
a per-student daily limit, so it cannot satisfy the requirement; it remains
untouched and still applies to the route.

## 5. Canonical Route

`POST /api/tutor/ask` (new router mounted at `/api/tutor`). No `/api/ai/tutor/ask`
alias was created. No existing route was renamed.

## 6. DTO Validation

`src/modules/ai/tutor/dto/ask-question.dto.ts` — `z.object({ question }).strict()`:
string → `.trim()` → `.min(10)` / `.max(500)`. Strict mode rejects unknown fields
including `studentId/userId/chapterId/lessonId/conversationId/history/systemPrompt`.
Rejects null, non-string, arrays/objects, missing, whitespace-only. Student
identity comes only from the authenticated token. Invalid input → `ZodError` →
existing 400 envelope. 12 unit tests cover all cases.

## 7. Authentication and Student Authorization

`authenticateMiddleware` (401 when missing/invalid token) then
`authorizeMiddleware("STUDENT")` (403 for any non-student). `studentId` is read
from `req.user.id` (verified token), never the body. No permission broadening.

## 8. Enrollment Precondition

`EnrollmentService.hasActiveEnrollment(studentId)` — bounded existence check using
the canonical rule (`status: "ACTIVE"`, `chapter.deletedAt: null`). When false the
controller throws `TutorNotEnrolledError` (**401**, per the Story) before any
quota claim or tutor/Gemini work. Tested at unit and E2E level (and proven the
tutor is not called).

## 9. Daily Query Limit

- **Configured limit:** `AI_TUTOR_DAILY_QUERY_LIMIT` (env, Zod `int().positive()`, default **20**). Added to `.env.example` (non-secret).
- **Storage:** new additive table `ai_tutor_usage(studentId, usageDate, count, @@unique([studentId, usageDate]))` (migration `20260628131838_add_ai_tutor_usage`). Chosen because no usage/Redis/quota storage existed and `AuditLog` cannot enforce an atomic limit.
- **Counting policy:** an accepted query is counted when processing begins (claimed before calling the tutor). Successful answers **and** localized not-found responses count. Pre-tutor rejections (bad DTO, unauthenticated, wrong role, no enrollment) do **not** count. Transient/reversible tutor failures (`TutorTimeoutError`, `TutorUnavailableError`) are **refunded**; deterministic content rejections (safety block) are not.
- **Concurrency:** single atomic statement — `INSERT … ON CONFLICT(studentId,usageDate) DO UPDATE SET count = count + 1 WHERE count < limit RETURNING count`. The unique constraint serializes concurrent requests; at the final slot exactly one succeeds (others get no row → 429). Proven by an E2E concurrency test.
- **Daily reset/timezone:** keyed by **UTC** calendar day (`usageDate`, `YYYY-MM-DD`); a new UTC day starts a fresh row. Documented as UTC (no project timezone config exists).

## 10. Controller Integration

`tutor.controller.ts` — thin: read identity → enrollment guard → atomic claim →
`aiTutorService.ask(question, studentId, endpointBudget)` → public mapping →
structured log → `okResponse`. No embedding/SQL/prompt/citation/enrollment-SQL
logic in the controller. Dependencies are injectable for unit testing; the route
wires the real singletons.

## 11. Public Response Mapping

The service result is mapped at the controller boundary to
`{ answer, citations: [{ lessonId, lessonTitle, chapterName }] }`. `relevanceScore`
and all internal fields (chunk ids/text, embeddings, prompt, raw model output)
are never exposed. The STORY-63 service return type is unchanged.

## 12. Response-Time Budget

The endpoint passes a per-call budget to `ask()`: **total 18s, retrieval 11s,
generation 7s** (`11 + 7 = 18 < 20`). This overrides only this call; STORY-63
instance defaults (25/15/10) remain for every other consumer. The service's
`Promise.race` deadline rejects at 18s with a safe mapped error (no late
response, no fake fallback). Proven by deterministic timeout tests (service-level
per-call timeout test + total-timeout test). Real Gemini latency is bounded by
the 7s generation cap; deterministic E2E (mocked provider) completes well under
the budget — see §17 for the honest latency caveat.

## 13. Logging

Structured `logger.info("ai_tutor_question_answered", {...})` on success with:
`studentId`, `question` (normalized, required by AC), `answerPreview`,
`timestamp`, `durationMs`, `citationCount`, `resultType` (`answered` | `not_found`).
Failures log `logger.warn("ai_tutor_question_failed", { studentId, questionLength,
failureType, durationMs, timestamp })`. Answer preview length: **160** chars,
whitespace-collapsed, sliced by code point (`[...str]`) so Arabic characters are
never split. No tokens/cookies/prompts/chunks/embeddings/keys are logged.

## 14. Localization and Error Contract

Localized Arabic messages for validation, no-enrollment, daily-limit, not-found
(both AR/EN via the service), and safe timeout/provider errors. Errors flow
through the existing `errorHandler` (surfaces safe `reason`). Status map: no auth
401, non-student 403, no enrollment **401**, question <10 / >500 / unknown fields
400, daily limit **429**, no content → 200 not-found, provider/search timeout 504,
provider unavailable 503, unexpected 500. Infrastructure errors are never turned
into not-found.

## 15. Unit and Controller Tests

28 new tests (all passing):
- DTO (`ask-question.dto.test.ts`) — 12.
- Controller (`tutor.controller.test.ts`) — 10 (enrollment 401 + tutor-not-called, 429 + tutor-not-called, claim with authed id, public mapping w/o relevanceScore, sub-20s budget passed, not-found preserved, refund on transient, no-refund on safety, success logging fields, missing-user 401).
- Usage service (`tutor-usage.service.test.ts`) — 4 (UTC date, claim true/false, refund).
- Service per-call budget (added to `ai-tutor.service.test.ts`) — 2 (per-call total timeout wins; per-call gemini timeout forwarded).

## 16. Real E2E Test

`src/modules/ai/tutor/tutor.e2e.test.ts` — real Express app, real auth/role,
real DTO, real controller, real enrollment + `ai_tutor_usage` persistence, real
Prisma against `TEST_DATABASE_URL`. Only the Gemini boundary is mocked
(`embedContent` + `generateContent` spies); the STORY-63 pipeline runs for real
up to that boundary. **12 tests, passing, run twice** (repeatable). Covers:
valid answer with public-only citations, no inaccessible-lesson citation, 401
no-enrollment, 401 no-auth, 403 wrong-role, 400 too-short/too-long/unknown-field,
429 after the daily allowance, independent per-student quotas, atomic
final-slot concurrency (one 200 + one 429), and session independence (no memory).

## 17. Performance Verification

- Enrollment check: one bounded `findFirst` (id-only). Daily claim: one atomic SQL statement. One `AiTutorService.ask` call → one Gemini call. Public mapping is trivial. Logging is a single synchronous structured call after the response data is ready.
- Deterministic timeout proof: service per-call total-timeout test rejects at the injected budget; controller test asserts `totalTimeoutMs < 20_000`.
- Honest caveat: deterministic tests mock Gemini (near-zero latency), so they prove the wiring/deadline, **not** real latency. Real end-to-end latency is bounded by the 7s generation + 11s retrieval caps (hard 18s deadline). Under real provider load a single answer should stay < 20s, but quota/latency spikes could approach the cap; the deadline guarantees the request is aborted before 20s rather than returning late.

## 18. Non-Regression Results

- Full unit/integration suite: **275 tests, 274 passed, 1 failed** — the failure is the **identical pre-existing** quiz-gen 20s-timeout test (unchanged). 247 → +28 new tests, all green.
- E2E suite: tutor (12), STORY-63 ai-tutor (6), promo-code (8) pass. `attempts.e2e` has **2 failures** — **pre-existing**: proven by stashing all STORY-64 tracked changes and re-running `attempts.e2e` in isolation → the same 2 failures occur. They are in the quiz-attempt code path (`expected 201 to be 409` on a duplicate attempt start), which STORY-64 does not touch.
- `tsc --noEmit` and `npm run build`: clean. Verified unchanged: STORY-63 service result, Gemini model/timeout defaults for other callers, quiz-generation, enrollment rules, role permissions, auth contracts, existing routes.

## 19. Database/Migration Changes

One additive, forward-only migration `20260628131838_add_ai_tutor_usage` creating
`ai_tutor_usage` with a unique index on `(studentId, usageDate)` and a FK to
`User` (cascade). Applied to dev (`final_project`) and the isolated test DB
(`migrate deploy`). No applied migration was edited; no reset/drop/truncate. The
tracked generated Prisma client (`src/generated/prisma/*`) was regenerated to
include the new model (required, since the client is committed in this repo). No
conversation/history table.

## 20. Commands and Results

```
npx prisma validate ........................ valid
npx prisma migrate dev --name add_ai_tutor_usage ... created + applied (dev)
DATABASE_URL=$TEST_DATABASE_URL prisma migrate deploy ... applied (test db)
npx tsc --noEmit ........................... clean
npm run build (tsc) ........................ clean
vitest run (tutor unit dir) ................ 63 passed
vitest run (full unit/integration) ......... 274 passed, 1 pre-existing fail
vitest run --config e2e (tutor.e2e) ........ 12 passed (x2 runs)
vitest run --config e2e (ai-tutor.e2e) ..... 6 passed
vitest run --config e2e (attempts.e2e) ..... 2 PRE-EXISTING failures (unrelated, proven by stash)
```

## 21. Files Created

- `src/modules/ai/tutor/tutor.controller.ts`
- `src/modules/ai/tutor/tutor.routes.ts`
- `src/modules/ai/tutor/tutor-usage.service.ts`
- `src/modules/ai/tutor/dto/ask-question.dto.ts`
- `src/modules/ai/tutor/tutor.controller.test.ts`
- `src/modules/ai/tutor/tutor-usage.service.test.ts`
- `src/modules/ai/tutor/dto/ask-question.dto.test.ts`
- `src/modules/ai/tutor/tutor.e2e.test.ts`
- `prisma/migrations/20260628131838_add_ai_tutor_usage/migration.sql`
- `STORY-64_AI_TUTOR_ENDPOINT_REPORT.md`

## 22. Files Modified

- `src/app.ts` — import + mount `/api/tutor`.
- `src/config/env.ts` — `AI_TUTOR_DAILY_QUERY_LIMIT`.
- `.env.example` — non-secret default for the limit.
- `prisma/schema.prisma` — `AiTutorUsage` model + `User.aiTutorUsage` relation.
- `src/modules/ai/tutor/ai-tutor.service.ts` — additive `TutorAskOptions` + per-call budget threading (defaults preserved).
- `src/modules/ai/tutor/ai-tutor.errors.ts` — `TutorNotEnrolledError` (401), `TutorDailyLimitError` (429).
- `src/modules/ai/tutor/ai-tutor.service.test.ts` — +2 per-call budget tests.
- `src/modules/enrollment/enrollment.service.ts` — `hasActiveEnrollment`.
- `src/generated/prisma/*` — regenerated for the new model (tracked client).

## 23. Remaining Risks

- Daily limit is keyed by UTC, not a localized timezone (none configured); document/adjust if a product timezone is later introduced.
- Deterministic tests mock Gemini latency; real provider latency is bounded by the 18s deadline but not measured here (see §17).
- Pre-existing failures remain out of scope: quiz-gen 20s-timeout unit test and `attempts.e2e` 2 tests (both proven independent of STORY-64).
- Refund-on-transient-failure can, in rare crash windows between claim and refund, leave a consumed slot; this is the safe (fail-closed) direction and never over-grants quota.

## 24. Final Status

**Completed.**

No-enrollment students cannot invoke the tutor (401 before any tutor work); the
daily limit is atomic/race-safe; the endpoint deadline is < 20s without changing
STORY-63 defaults; public citations exclude `relevanceScore`; logging excludes
secrets/prompts/chunks; the full backend suite shows no new failures; STORY-63
and quiz behavior are unchanged.
