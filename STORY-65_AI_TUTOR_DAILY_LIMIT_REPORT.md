# STORY-65 AI Tutor Daily Query Limit Report

## 1. Executive Summary

Completed the per-student daily AI-tutor cap by making it **teacher-configurable**
and adding the full STORY-65 contract on top of the durable limiter already built
in STORY-64. STORY-64 had introduced the `ai_tutor_usage` table, the atomic
claim/refund, and a 429 — but the cap came from an env constant and there was no
metadata, exact messages, usage endpoint, or teacher control. STORY-65 adds:

- `TeacherProfile.aiTutorDailyQueryLimit` (default 20) editable via the existing teacher-settings endpoint.
- Per-student **effective cap resolution** (MAX of the student's active-enrollment teachers' caps, platform-default fallback).
- A 429 body with `{ limit, remaining, resetsAt }` + `Retry-After`, and the exact bilingual messages.
- `GET /api/tutor/usage-today` (read-only `{ used, limit, remaining, resetsAt }`).
- Server-calendar `resetsAt` (next UTC midnight).

STORY-63 and STORY-64 were **reused, not rebuilt**. No second tutor route, no
second limiter, no second Prisma/auth/settings system, no frontend, no streaming,
no conversation memory. One additive migration (a single column).

Status: **Completed** (two unrelated **pre-existing** failures documented in §19).

## 2. Baseline Health

- Branch: `feature/story-64-ai-tutor-endpoint` (STORY-64 committed).
- `prisma validate`: valid. `migrate status`: up to date (38 migrations pre-change).
- pg reachable; pgvector 0.8.3; embedding `vector(3072)`.
- `tsc --noEmit`: clean. Unit/integration baseline: 275 tests, 274 pass, **1 pre-existing** quiz-gen 20s-timeout failure.
- E2E baseline: `attempts.e2e` had **2 pre-existing** failures (proven independent during STORY-64 via stash).

## 3. Sprints Dependency Audit

`sprints.md` read at `c:/Users/kerol/Downloads/Fahimni/sprints.md` — STORY-63
(1860–1885), STORY-64 (1889–1914), STORY-65 (1918+).

### Reused from STORY-63
`AiTutorService.ask` (RAG retrieval, Gemini, citations, not-found, timeouts) —
unchanged.

### Reused from STORY-64 (the existing limiter — completed, not duplicated)
- `ai_tutor_usage` table + `@@unique([studentId, usageDate])`.
- `TutorUsageService.tryClaim` (atomic insert/conditional-increment) + `refund`.
- `POST /api/tutor/ask` controller, enrollment guard, structured logging, sub-20s budget.
- `AI_TUTOR_DAILY_QUERY_LIMIT` env (now the platform-default fallback).

STORY-64's provisional "env-constant cap" was the temporary limiter; STORY-65
migrated it to a teacher-configured cap with the smallest change (resolve the cap
per student; the atomic claim/storage are unchanged).

### Added by STORY-65
Teacher cap field + settings wiring; effective-cap resolution; `resetsAt`;
read-only `getToday`; `GET /usage-today`; 429 metadata + exact messages + locale.

## 4. Existing Architecture Reused

| Concern | Existing | Reused? | STORY-65 change |
| --- | --- | --: | --- |
| Tutor route/controller | `tutor.routes.ts` / `tutor.controller.ts` | Yes | + usage-today route; cap resolution + 429 metadata |
| Usage storage + atomic claim | `ai_tutor_usage` / `TutorUsageService` | Yes | + resolveEffectiveLimit / resetsAt / getToday |
| Teacher settings | `TeacherProfile` + `teacher.*` | Yes | + `aiTutorDailyQueryLimit` field/DTO/response |
| Auth / role | `authenticate` / `authorize("STUDENT")` | Yes | reused on usage-today |
| Enrollment | `EnrollmentService.hasActiveEnrollment` | Yes | reused |
| Localization | `resolveLocale(Accept-Language)` | Yes | reused for the 429 message |
| Error/response envelope | `AppError` / `okResponse` / `errorHandler` | Yes | 429 built inline w/ metadata |

## 5. Effective Cap Ownership Model

- **Stored** on `TeacherProfile.aiTutorDailyQueryLimit` (per teacher). Default 20.
- **Resolution:** the per-student counter is global (one `ai_tutor_usage` row per student/day). For a student, the effective cap = **MAX** of `aiTutorDailyQueryLimit` across the teachers whose chapters the student is **ACTIVE**-enrolled in (non-deleted chapter/stage), falling back to the platform default (`AI_TUTOR_DAILY_QUERY_LIMIT`, 20) if none.
- **Multiple-teacher behavior:** MAX is chosen so a stricter teacher never blocks a student from another teacher's paid content. **Documented consequence:** with a single shared global counter, a strict teacher's individual cost ceiling is not separately enforced when the student also has a more generous teacher. The common single-teacher case is exact. A future per-teacher usage counter would remove this trade-off.
- **Ownership safety:** a teacher edits only their **own** `TeacherProfile` (settings update uses `req.user.id`); no teacher can change another teacher's setting or access another teacher's students.

## 6. Database Model and Migration

- Reused `ai_tutor_usage` (STORY-64) unchanged.
- Added one column: `teacher_profiles.aiTutorDailyQueryLimit INTEGER NOT NULL DEFAULT 20`.
- Migration `20260628134939_add_teacher_ai_tutor_limit` (additive, forward-only). Existing teacher rows get the default 20 via the column DEFAULT — no data loss, no destructive change. Applied to dev (`final_project`) and the isolated test DB (`migrate deploy`). No applied migration edited; no reset/drop/truncate. Older DBs upgrade via `npx prisma migrate deploy`.

## 7. Server Date and Reset Behavior

- Usage day = **UTC** calendar date (`usageDate` `@db.Date`), matching STORY-64. Documented as UTC (no application timezone is configured in the repo).
- New day ⇒ new date-keyed row ⇒ usage logically resets to 0; the previous day's row is preserved (audit). No cron needed; not a rolling 24h window; client-supplied dates are never trusted (server computes the date).
- `resetsAt` = start of the next UTC day, ISO-8601 (e.g. `2026-06-29T00:00:00.000Z`).

## 8. Atomic Query Claim

Single statement (unchanged from STORY-64):
`INSERT … ON CONFLICT(studentId,usageDate) DO UPDATE SET count = count + 1 WHERE count < $limit RETURNING count`. First request inserts (count 1); subsequent increment only while `count < limit`; at the limit the conditional update matches nothing → no row → denied. STORY-65 passes the **resolved** cap as `$limit`.

## 9. Concurrency Protection

The unique `(studentId, usageDate)` constraint serializes concurrent conflicting
writes; the conditional `WHERE count < limit` guarantees at the final slot
exactly one request increments and the other is denied — `count` never reaches
`limit + 1`. Verified by a unit-level design test and a real two-concurrent-request
E2E (`[200, 429]`, final DB count == cap). No unique-constraint error leaks to the client.

## 10. STORY-64 Integration

The controller flow is unchanged except: (a) the cap is now resolved per student
via `usageService.resolveEffectiveLimit` instead of the env constant, and (b) the
quota-exceeded branch returns a 429 **with metadata** instead of throwing a bare
error. No second Gemini call, no duplicate enrollment/usage check, citation shape
unchanged (no `relevanceScore`), STORY-63 timeouts untouched, logging fields
unchanged.

## 11. 429 Error Contract

`429` with body `{ success:false, statusCode:429, message, reason:"DAILY_LIMIT_EXCEEDED", limit, remaining:0, resetsAt }` and a `Retry-After` header (seconds to `resetsAt`). Message localized via `resolveLocale(Accept-Language)`:
- ar: `لقد تجاوزت الحد اليومي للأسئلة. يرجى المحاولة غداً.`
- en: `You've exceeded your daily question limit.`
No DB IDs, other students' usage, internal settings, or raw SQL/Prisma errors are exposed.

## 12. Usage-Today Endpoint

`GET /api/tutor/usage-today` (auth + STUDENT). Read-only: never creates a row or
increments. Returns `{ used, limit, remaining, resetsAt }` where
`remaining = max(limit - used, 0)`; `used` is 0 when no row exists. `limit` is the
student's effective cap. Only the authenticated student's own usage is returned.

## 13. Teacher Settings

Extended the existing `PUT /api/teachers/profile` (update) and
`GET /api/teachers/profile` (read) with `aiTutorDailyQueryLimit`. Validation:
integer, min 1 (zero is **not** "unlimited"), max **1000** (newly introduced,
documented conservative bound), rejects floats/NaN/non-numbers/negatives. A teacher
updates only their own profile (`req.user.id`); students have no `TeacherProfile`
→ update is refused. Lowering the cap below today's used count ⇒ `remaining 0` and
new requests rejected, **without** altering the historical used count; raising it
restores allowance immediately. Usage is never reset by a settings change.

## 14. Counting Policy

A request consumes exactly one slot when it passes all preconditions (auth →
student role → DTO validation → active enrollment) and the atomic claim succeeds,
i.e. **before** `AiTutorService.ask`. Therefore unauthenticated, wrong-role,
invalid-DTO, and no-enrollment requests never consume quota; a successful grounded
**not-found** answer **does** count (it used the tutor flow). Transient/reversible
tutor failures (`TutorTimeoutError`, `TutorUnavailableError`) are **refunded**;
deterministic content rejections (safety block) are not. No request is counted
twice; the service never increments.

## 15. Localization

Reused `resolveLocale(Accept-Language)` (no new framework). The 429 message is
bilingual; teacher-settings validation messages follow the existing English
convention of that module; not-found answer localization is handled by STORY-63.

## 16. Focused Tests

13 new unit tests (all pass): usage service +6 (`resetsAt`, `resolveEffectiveLimit`
MAX + fallback, `getToday` empty/over-limit), teacher validation +7
(integer/min/max/float/non-number/zero/negative). Controller test updated for the
new flow (resolved limit, 429 metadata, usage-today). Full unit/integration suite:
**288 tests, 287 pass** (the 1 failure is the pre-existing quiz-gen 20s test).

## 17. PostgreSQL E2E

`src/modules/ai/tutor/tutor-usage.e2e.test.ts` — real app/auth/role/DTO/enrollment/
guard/usage-persistence/teacher-settings against `TEST_DATABASE_URL`; Gemini
mocked at the boundary; usage/concurrency **not** mocked. **10 tests, run twice**,
both green. Covers: teacher read/update cap; invalid-cap 400; student-cannot-update;
usage tracking + usage-today + 429 metadata + provider-not-called-on-reject; exact
AR/EN 429 by Accept-Language; independent per-student quotas; no quota for
no-enrollment/invalid/no-auth; cap lower-below-used blocks (no reset) + raise
restores; final-slot concurrency (`[200,429]`, count==cap); calendar-date reset with
previous day preserved.

## 18. Date-Boundary Verification

The reset test seeds a prior-day usage row and asserts today's snapshot reads
`used 0` (new date row) while the previous day's row remains `count 2` — proving a
calendar-day reset, not a rolling 24h window, and that client input cannot alter
the usage day (server computes it). `resetsAt` unit tests assert next-UTC-midnight.

## 19. Non-Regression Results

- Full unit/integration: 288 tests, 287 pass; only the pre-existing quiz-gen 20s-timeout test fails (unchanged).
- E2E: STORY-65 (10), STORY-64 tutor (12), STORY-63 ai-tutor (6), promo-code (8) all pass. `attempts.e2e` has the same **2 pre-existing** failures (quiz-attempt `409` path; proven independent of STORY-64/65 — STORY-65 does not touch quiz attempts).
- Unchanged: AI answer generation, citations (no `relevanceScore`), tutor timeouts, not-found behavior, content access, quiz generation, role permissions, unrelated teacher-settings fields, auth contracts.

## 20. Commands and Results

```
prisma validate ............ valid
prisma migrate dev --name add_teacher_ai_tutor_limit ... created + applied (dev)
prisma migrate deploy (test db) ... applied
tsc --noEmit / npm run build ... clean
vitest run (tutor + teacher unit) ... 76 passed
vitest run (full) .......... 287 passed, 1 pre-existing fail
vitest e2e (tutor-usage.e2e) x2 ... 10 passed each
vitest e2e (full) .......... STORY-63/64/65 + promo-code pass; attempts.e2e 2 pre-existing fails
```

## 21. Files Created

- `src/modules/ai/tutor/tutor.constants.ts` (shared cap bounds)
- `src/modules/ai/tutor/tutor.i18n.ts` (429 messages + resolveLocale re-use)
- `src/modules/ai/tutor/tutor-usage.e2e.test.ts`
- `src/modules/teacher/teacher.validation.test.ts`
- `prisma/migrations/20260628134939_add_teacher_ai_tutor_limit/migration.sql`
- `STORY-65_AI_TUTOR_DAILY_LIMIT_REPORT.md`

## 22. Files Modified

- `prisma/schema.prisma` — `TeacherProfile.aiTutorDailyQueryLimit`.
- `src/modules/ai/tutor/tutor-usage.service.ts` — `resolveEffectiveLimit`, `resetsAt`, `getToday`, `UsageSnapshot`.
- `src/modules/ai/tutor/tutor.controller.ts` — resolve cap, 429 metadata, `usageToday`.
- `src/modules/ai/tutor/tutor.routes.ts` — `GET /usage-today`.
- `src/modules/teacher/{teacher.types,teacher.validation,teacher.service}.ts` — cap field/DTO/response/update.
- `src/modules/ai/tutor/{tutor.controller,tutor-usage.service}.test.ts` — updated/added tests.
- `src/generated/prisma/*` — regenerated for the new column (tracked client).

## 23. Remaining Risks

- Multi-teacher MAX cap is a documented trade-off (a strict teacher's ceiling isn't separately enforced when a more generous teacher also enrolls the student) — inherent to a single global per-student counter.
- Daily reset is UTC (no app timezone configured); revisit if a localized timezone is introduced.
- Refund-on-transient-failure is fail-closed: a crash between claim and refund consumes a slot but never over-grants.
- Pre-existing, unrelated failures remain out of scope (quiz-gen 20s unit test; `attempts.e2e` 2 tests).

## 24. Final Status

**Completed.** Usage cannot exceed the cap under concurrency; the count resets by
server calendar date (not a rolling window); rejected precondition requests don't
consume quota; a student cannot read another student's usage; teachers can edit
only their own cap; STORY-63/64 were not rebuilt; the build passes and schema is
consistent.
