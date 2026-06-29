# STORY-66 Teacher Student Engagement Stats API Report

## 1. Executive Summary

Implemented `GET /api/dashboard/teacher/students` — a teacher-scoped, paginated,
searchable, sortable student-engagement endpoint — by extending the existing
dashboard module. The feature did not exist. The aggregation runs entirely in
PostgreSQL (two bounded CTE queries, no N+1, no join fan-out, no in-memory
pagination/search). Verified with a real-Postgres E2E (run twice) and a 120-student
performance test: **median ~10 ms** (target < 1000 ms). No existing code was
rebuilt; no schema migration was required.

## 2. Initial Implementation Discovery

**NOT IMPLEMENTED.** Backend-wide search for the route and every metric name
returned zero matches; the dashboard module only had STORY-29
(`GET /api/dashboard/teacher/stats`).

## 3. Baseline Health

- Branch `develop`; working tree clean except pre-existing `Frontend/package-lock.json` + `backend/package-lock.json` modifications (present at session start, not mine).
- **Environment recovery:** Docker was down and `.env` pointed at `localhost:5432` while compose maps `15432`, with no `TEST_DATABASE_URL`. Per your choice I started Docker; I corrected `.env` locally (port → 15432, added `TEST_DATABASE_URL`). DB then reachable; `prisma validate` ok; dev DB up to date (39 migrations); test DB has the full schema.
- `tsc --noEmit` clean. Pre-existing failures (unrelated, not introduced by me): `quiz-generation.service.test.ts > calls Gemini with a 20s timeout configuration`; and `attempts.e2e.test.ts` 2 STORY-48 tests (duplicate-attempt path). My changes touch only the dashboard module.

## 4. Sprints Dependency Audit

Read STORY-29 (840), STORY-50 (1458), STORY-66 (1947) in `sprints.md`.
- **Reused from STORY-29:** the dashboard module + teacher-scoping ownership chain (`Stage.teacherId → Chapter → Lesson/Quiz`; `Enrollment → Chapter → Stage`) and the `COUNT(DISTINCT)` raw-SQL convention from `dashboard.service.ts`.
- **Reused from STORY-50:** the `Enrollment` model (`studentId, chapterId, enrolledAt, status`) and the active-enrollment rule (`status = 'ACTIVE'`, non-deleted chapter/stage). Note: the real schema uses `enrolledAt` + `EnrollmentStatus` (not the `enrolledMonth/enrolledYear/startedAt` the prose mentions); I used the real fields.
- **Already implemented for STORY-66:** nothing.
- **Missing (built here):** the entire endpoint.
- **Dependency gap:** `User` has **no `lastLoginAt`**. Rather than add a field / change auth, I reused `refresh_tokens.createdAt` (auth creates a RefreshToken on login). No migration, no login-behavior change.

## 5. Existing Architecture Reused

Express routing + `authenticateMiddleware`/`authorizeMiddleware("OPERATION")`, the
shared Prisma client, `okResponse` envelope, `asyncHandler`, Zod validation, and
the `*.types.ts` DTO convention. No second Prisma client, router, or dashboard
service layer was created.

## 6. Canonical Route

`GET /api/dashboard/teacher/students` (mounted once on the existing
`dashboard.routes.ts` at `/api/dashboard`). No duplicate/alias route.

## 7. Teacher Ownership and Student Scope

Teacher id comes only from `req.user.id`. Students are scoped through
`Enrollment → Chapter (deletedAt null) → Stage (teacherId, deletedAt null)` with
`status = 'ACTIVE'`. A student is returned **once** (GROUP BY studentId), even
across multiple teacher chapters. A student enrolled with multiple teachers
appears for each teacher but with **only that teacher's** scoped metrics.

## 8. Metric Definitions

- **studentId / studentName / studentPhone:** `User.id` / `User.fullName` / `User.mobile`.
- **status:** `active` if the **most-recent** ACTIVE teacher-scoped `Enrollment.enrolledAt` ≥ `now − 30 days` (inclusive), else `inactive`. Cutoff computed server-side (client timezone cannot shift it).
- **enrolledChapterCount:** `COUNT(DISTINCT chapterId)` of teacher-owned, non-deleted chapters with an ACTIVE enrollment.
- **totalLessonsWatched:** `COUNT(DISTINCT lessonId)` where `LessonProgress.completed = true` for teacher-scoped, non-deleted lessons. ("watched" follows the only existing consumer, `content.controller`, which treats `completed = true` as done; there is no separate view-event table.)
- **averageQuizScore:** `AVG(score / totalPoints × 100)` over **GRADED** attempts on teacher-owned quizzes (`Quiz → Chapter → Stage.teacherId`), `totalPoints > 0`, `score` non-null. Excludes IN_PROGRESS/COMPLETED-pending/other-teacher attempts. Rounded to 2 decimals; **null** when no graded attempts.
- **lastActivityAt:** `GREATEST(MAX(refresh_tokens.createdAt) [login, user-global], MAX(quiz_attempts.updatedAt) [teacher-scoped], MAX(lesson_progress.updatedAt) [teacher-scoped])`. `GREATEST` ignores NULLs; returns **null** only when all three are absent. Login is global by nature; quiz/lesson activity is teacher-scoped (documented).
- **enrollmentMonths:** completed whole calendar months (UTC) since the **earliest** ACTIVE teacher-scoped enrollment; partial month = 0; never negative.

## 9. Query Validation

`student-engagement.validation.ts` (Zod): `page` (coerced int ≥ 1, default 1),
`limit` (coerced int 1–100, default **20**), `search` (trimmed, ≤ 100 chars),
`sortBy` ∈ {name,lastActivity,averageQuizScore} default name, `sortOrder` ∈
{asc,desc} default asc. Unknown keys stripped. Validated in the controller via
`safeParse` (Express 5 `req.query` is a read-only getter).

## 10. Search Behavior

Case-insensitive DB search: `u."fullName" ILIKE $pattern ESCAPE '\'`. Input is
trimmed, length-bounded, and LIKE metacharacters (`\ % _`) are escaped so they
match literally. Parameterized — no raw interpolation. Runs inside the teacher
scope; never loads all rows to filter in JS.

## 11. Sorting and Null Ordering

Allowlisted ORDER BY (never client text): name → `u."fullName"`, lastActivity →
the GREATEST expression alias, averageQuizScore → the rounded-avg alias. Direction
asc/desc. `NULLS LAST` for lastActivity and averageQuizScore in both directions.
Deterministic tie-break: `u."id" ASC`.

## 12. Pagination

Response envelope `data: { students, pagination: { page, pageSize, total, totalPages } }`.
Default page size 20 (bounded max 100). `LIMIT/OFFSET` applied in SQL; `total`
from a separate `COUNT` over the same scoped CTE (so out-of-range pages still
report correct totals).

## 13. Query Architecture

- **Query count: exactly 2** (page query + count query), run in parallel.
- **N+1: none.** Per-student metrics are pre-aggregated in CTEs (`ts`, `lp`, `qa`, `lg`), each `GROUP BY studentId`, then LEFT JOINed — no row multiplication, averages computed before joining.
- Only required columns selected; no lesson bodies, quiz questions, answers, or embeddings loaded.

## 14. Index and Migration Review

**No migration.** Existing indexes cover the access paths: `enrollments(studentId)`/`(chapterId)`, `stages(teacherId,…)`, `lesson_progress @@unique(studentId,lessonId)`, `quiz_attempts(studentId)`/`(quizId)`, `chapters(stageId)`. The 120-student run (~10 ms) shows no index is needed; adding one was not justified by evidence.

## 15. Authorization and Data Isolation

`authenticate` → `authorize("OPERATION")`. Unauthenticated → 401; non-teacher → 403; teacher → only their students. E2E proves teacher 2 cannot see teacher-1-only students and a cross-teacher student shows each teacher only their own scoped metrics.

## 16. Unit Tests

19 DB-free tests, all pass: validation contract (10) and pure helpers
`computeStatus`/`completedMonths` (9) including the 30-day inclusive boundary,
timezone-independence, and month-boundary/future-date behavior.

## 17. PostgreSQL E2E

`student-engagement.e2e.test.ts` — real app/auth/role/validation/service/Prisma
against `TEST_DATABASE_URL`. **8 tests, run twice**, both green. Covers scoping +
dedup + cross-teacher isolation, all metric values for a known student
(chapters=1, watched=2, avg=90, status, months, lastActivity=newest), active/
inactive + null-activity, 20/page pagination with a stable non-overlapping page 2,
the three sorts (name asc==reverse(desc); averageQuizScore & lastActivity nulls-last),
teacher-2 isolation, auth 401/403, and invalid-sort 400.

## 18. Performance Verification

- Fixture: **120 enrolled students** (multi-chapter, lesson progress, graded attempts, login tokens, ~15% null-activity), real Postgres.
- Page 1, `sortBy=lastActivity desc`, 7 runs after warm-up: **min 8.5 ms, median ~8.7–10.4 ms, max 14.6 ms** across runs.
- Query count: 2. **< 1000 ms target met with a wide margin.** Honest note: this is a local Docker measurement, not a production SLA; production latency depends on data volume and hardware, but the bounded 2-query design scales well.

## 19. Non-Regression Results

- Full unit/integration: 313 tests, 312 pass — only the pre-existing quiz-gen 20s-timeout failure.
- Full E2E: 56 pass — only the pre-existing `attempts.e2e` 2 STORY-48 failures. My engagement E2E (8) + perf (1) pass.
- STORY-29 dashboard test, enrollment, auth, quiz scoring unchanged. No enrollment/progress/grading/login behavior altered.

## 20. Commands and Results

```
prisma validate / migrate status ... valid / up to date
tsc --noEmit / npm run build ....... clean
vitest run (dashboard unit) ........ 19 passed
vitest run (full) .................. 312 passed, 1 pre-existing fail
vitest e2e (engagement) x2 ......... 8 passed each
vitest e2e (perf, 120 students) .... 1 passed (median ~10ms)
vitest e2e (full) .................. 56 passed, 2 pre-existing attempts.e2e fails
```

## 21. Files Created

- `src/modules/dashboard/student-engagement.service.ts`
- `src/modules/dashboard/student-engagement.validation.ts`
- `src/modules/dashboard/student-engagement.validation.test.ts`
- `src/modules/dashboard/student-engagement.helpers.test.ts`
- `src/modules/dashboard/student-engagement.e2e.test.ts`
- `src/modules/dashboard/student-engagement.perf.e2e.test.ts`
- `STORY-66_TEACHER_STUDENT_ENGAGEMENT_REPORT.md`

## 22. Files Modified

- `src/modules/dashboard/dashboard.types.ts` (+ StudentEngagement DTOs)
- `src/modules/dashboard/dashboard.controller.ts` (+ getTeacherStudents)
- `src/modules/dashboard/dashboard.routes.ts` (+ GET /teacher/students)
- (local, gitignored) `backend/.env` — port 5432→15432 to match docker-compose + added `TEST_DATABASE_URL`. No secret values added; placeholders preserved.

## 23. Remaining Risks

- **Last-login proxy:** `refresh_tokens.createdAt` reflects login/refresh events (no dedicated `lastLoginAt`). Adequate and migration-free; a future explicit field would be more precise.
- **Sort collation:** name ordering uses Postgres collation (deterministic, DB-side). The frontend should not assume a specific locale order.
- **Perf number is local Docker**, not a production SLA.
- Pre-existing unrelated failures remain (quiz-gen 20s unit; attempts.e2e 2) — out of scope.
- `.env` was repaired locally (real secrets like a Gemini key may still be placeholders from a prior recovery; unrelated to STORY-66).

## 24. Final Status

**Completed.** No cross-teacher leakage; students deduplicated; only graded
attempts in the average; search + pagination + sorting in the database; exactly 2
queries (no N+1); verified with 120 students at ~10 ms (< 1 s); build/typecheck
green; existing enrollment/progress/dashboard behavior preserved.
