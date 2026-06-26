# STORY-48 Implementation Report

## 1. Executive Summary

Implemented the Quiz Submission feature (STORY-48) on the existing Express +
Prisma + PostgreSQL backend, completed the missing STORY-47 behavior it depends
on, and applied the minimal STORY-44 schema compatibility changes. Every required
endpoint is verified by a **real HTTP + PostgreSQL end-to-end test** (no mocks of
routes/controllers/services/Prisma/auth) running against an **isolated local test
database** (`final_project_test`). The E2E ran green twice. The E2E surfaced and I
fixed a real correct-answer leak in the STORY-47 chapter-quizzes endpoint.

## 2. Architecture Found

Express 5 + TypeScript + Prisma 7 + PostgreSQL (Docker, host port 15432) + Zod +
Vitest. API prefix `/api`; auth `/api/v1/auth`. Auth is an HttpOnly `access_token`
cookie (Bearer also accepted). Roles: teacher = `OPERATION`, student = `STUDENT`.
Errors via `AppError(message, status)` + global handler; responses via
`okResponse(message, data)`. Ownership chain: `Chapter → Stage.teacherId`.

## 3. STORY-44 Status

Reused existing `Quiz`, `Question`, `QuizAttempt` models. Compatibility gaps fixed
additively (no duplicate models):
- `Question.points`, `Quiz.questionCount`, `Quiz.totalPoints` — existed in the dev
  DB (earlier branch) but were **absent from `schema.prisma`** and from a fresh DB;
  now declared and created.
- `QuizAttempt` was missing `status`, `totalPoints`, `startedAt`, `completedAt`,
  the `AttemptStatus` enum, and the one-attempt constraint — all added.

## 4. STORY-47 Status

Present but incomplete; completed only the missing/incorrect behavior:
- `assignQuiz`: added **chapter ownership** verification (`Chapter→Stage→teacherId`,
  active only) and **rejects reassigning a PUBLISHED quiz** (409). (Was missing
  chapter ownership → cross-teacher assignment was possible.)
- `publishQuiz`: now **requires an assigned chapter** (400 if none), returns **409**
  on duplicate publish (was 403), and publishes via an **atomic conditional
  `updateMany`** (only a still-DRAFT row), also backfilling `questionCount`/`totalPoints`.
- `getChapterQuizzes`: **fixed correct-answer leak** — the shared DTO re-added
  `correctAnswer: null`; now the field is omitted entirely for students.
- Immutability (add/update/delete/reorder questions) was already enforced via
  `assertQuizDraft` (→403); verified by E2E.

## 5. Schema and Migration Changes

New additive, idempotent migration
`prisma/migrations/20260626000000_story48_attempt_and_points/migration.sql`:
- `CREATE TYPE "AttemptStatus"` (guarded).
- `ADD COLUMN IF NOT EXISTS`: `quizzes.questionCount/totalPoints`, `questions.points`,
  `quiz_attempts.totalPoints/status/startedAt/completedAt` (+ backfill `startedAt`).
- `UNIQUE (quizId, studentId)` on `quiz_attempts` (guarded).
- Indexes: `quiz_attempts(studentId)`, `quiz_attempts(quizId)`, `quizzes(chapterId,status)`.

Applied via `prisma migrate deploy` to both the dev DB (columns pre-existed → skipped)
and the fresh test DB (columns created). No resets, no edits to applied migrations,
no data loss.

## 6. Endpoints Implemented

| Method | Route | Role |
|---|---|---|
| GET | `/api/quizzes/assigned` | STUDENT |
| POST | `/api/quizzes/:id/attempt` | STUDENT |
| POST | `/api/attempts/:attemptId/submit` | STUDENT |
| POST | `/api/attempts/:attemptId/grade-essays` | OPERATION |
| POST | `/api/quizzes/:id/assign` (STORY-47, completed) | OPERATION |
| PATCH | `/api/quizzes/:id/publish` (STORY-47, completed) | OPERATION |
| GET | `/api/chapters/:chapterId/quizzes` (STORY-47, hardened) | STUDENT/OPERATION |

## 7. Assigned Quiz Logic

Returns PUBLISHED quizzes whose chapter the authenticated student is **actively
enrolled** in (`status ACTIVE`, chapter not deleted). Student id from auth only.
Excludes drafts, unenrolled/unassigned quizzes, and `correctAnswer`. Includes
per-quiz `attemptStatus` (`NOT_STARTED|IN_PROGRESS|COMPLETED|GRADED`) computed with
a single batched attempts query (no N+1).

## 8. Attempt Creation

Validates quiz exists + PUBLISHED + has chapter + chapter active + student actively
enrolled + ≥1 question + no existing attempt. Creates one `QuizAttempt`
(`IN_PROGRESS`, empty answers, `totalPoints` = Σ question points). Returns safe
questions (id, type, content, options, points, sortOrder) — no `correctAnswer`.
Concurrency: the DB unique constraint makes a simultaneous second start fail with
**409** (one attempt only).

## 9. Submission Validation

Strict Zod schema: non-empty `answers`, UUID `questionId`, no duplicates, trimmed
non-blank `answer`, max length, **unknown fields rejected** (blocks client-supplied
score/result/awardedPoints/studentId/etc.). Service enforces **exact set equality**
with the quiz's question IDs (no missing/extra) → partial = 400, nothing persisted.
Per-type format checks: MCQ answer must be an option; TF must normalize; essay non-empty.

## 10. Auto-Grading

Pure `auto-grade.ts` (no input mutation, ordered by `sortOrder`): MCQ exact
normalized match → full points else 0; TRUE_FALSE normalized (Arabic + English
tokens) → full points else 0; ESSAY → `pending`, `awardedPoints = null`. Computes
score, totalPoints, percentage (2-dp rounding), pendingEssayCount, isFinal.

## 11. Essay Grading

`POST /attempts/:attemptId/grade-essays` (owning teacher only). Requires attempt
`COMPLETED`; **all** pending essays must be graded; non-essay / unknown targets and
`awardedPoints > question.points` rejected (400); already-graded → 409. Atomic
conditional `updateMany` (only a `COMPLETED` row); preserves MCQ/TF results, updates
essays, recomputes final score/percentage, sets `GRADED`.

## 12. Attempt State Transitions

- MCQ/TF-only quiz: `IN_PROGRESS → GRADED` on submit (`isFinal`, completedAt set).
- Quiz with essays: `IN_PROGRESS → COMPLETED` on submit (provisional score,
  pendingEssayCount > 0), then `COMPLETED → GRADED` after teacher grades all essays.

## 13. Duplicate and Race Protection

- One attempt per (quiz, student): DB unique constraint → 409 on duplicate/concurrent start.
- Submit: conditional `updateMany WHERE status = IN_PROGRESS` → exactly one succeeds,
  the other gets 409; answers/score never overwritten.
- Grade: conditional `updateMany WHERE status = COMPLETED` → single transition; re-grade 409.
- Publish: conditional `updateMany WHERE status = DRAFT` → 409 duplicate publish.
Verified by two concurrency E2E tests (`Promise.all` start×2 and submit×2).

## 14. Published Quiz Immutability

All question write paths (add/update/delete/reorder) and `update`/`delete`/`assign`
go through `assertQuizDraft`/status checks → **403** once PUBLISHED. E2E asserts
update, delete, and add all return 403 on a published quiz.

## 15. Security and Ownership

Teacher/student ids always from the authenticated request (never the body).
Cross-teacher assign and cross-teacher essay grading rejected (403/404). Students
never receive `correctAnswer` (assigned, chapter-quizzes, start, submit, grade
responses all verified leak-free). Attempts are owner-scoped (other student → 403).
No Prisma errors/stack traces leaked.

## 16. Unit and Service Tests

- `auto-grade.test.ts` — 20 tests (MCQ/TF correct+incorrect, Arabic+English TF
  normalization, invalid TF/MCQ rejected, essay pending, points/total/percentage,
  rounding, no input mutation, order preserved, finalize after grading).
- `attempts.validation.test.ts` — 16 tests (submit + grade-essays: required,
  non-empty, dup IDs, blank/over-long, unknown-field rejection, numeric points).
- Service/repository/controller behavior is verified end-to-end through the **real
  HTTP + real Prisma** E2E (stronger than mocked service tests; no mocks).
- Default suite: **169 passed, 1 failed** — the one failure is a **pre-existing**
  `geminiClient` 429-retry test, unrelated to STORY-48 (fails on a clean baseline).

## 17. Real E2E Test

`src/modules/quizzes/attempts.e2e.test.ts` boots the actual Express app
(`createApp().listen(0)`) and sends real HTTP requests through real routing, auth,
role guards, validation, controllers, services, repositories, Prisma, and cookies.
Fixtures created via Prisma with unique per-run identifiers; per-role cookies; no
Gemini/RAG; no Postman. Scenarios (all asserted): role logins; cross-teacher assign
reject; assign; publish + publishedAt + duplicate-publish 409; published-question
update/delete/add immutability (403); chapter quizzes (no correctAnswer); assigned
quizzes for enrolled vs unenrolled (no correctAnswer); start (201/IN_PROGRESS/safe
questions) + duplicate-start 409 + single-attempt invariant; partial submit 400 +
no persistence; full submit (MCQ correct, TF incorrect, essay pending, score 1/7,
14.29%, completedAt, no correctAnswer); duplicate submit 409 + unchanged score;
unauthorized grading (student 403, other teacher 403/404); excessive points 400;
teacher grade → GRADED, score 5/7, 71.43%, no pending; re-grade 409; DB integrity
(exactly one attempt, GRADED, result states `[correct, graded, incorrect]`);
unauthenticated 401 + wrong-role 403 + unenrolled 403; start×2 and submit×2 concurrency.

## 18. E2E Database Isolation

`TEST_DATABASE_URL` → `final_project_test` on the local Docker Postgres. A setup
file (`src/test/e2e-setup.ts`) redirects `DATABASE_URL` to the test DB and **refuses
non-local hosts**. Migrations applied via `prisma migrate deploy`. The default
`vitest.config.ts` excludes `*.e2e.test.ts`; E2E runs via `vitest.e2e.config.ts`
(`npm run test:e2e:story48`). The normal dev DB is never reset or used by the E2E;
the test cleans only its own records (child-first, quiz cascade).

## 19. Commands and Results

| Command | Result |
|---|---|
| `npx prisma validate` | valid |
| `npx prisma migrate status` | up to date |
| `npx prisma generate` | ok |
| `npx tsc --noEmit` | 0 errors |
| `npm run build` | success (exit 0) |
| `npx vitest run` | 169 passed, 1 failed (pre-existing gemini 429) |
| `npm run test:e2e:story48` (run 1) | 5 passed |
| `npm run test:e2e:story48` (run 2) | 5 passed |

## 20. Files Created and Modified

Created: `auto-grade.ts`, `auto-grade.test.ts`, `attempts.service.ts`,
`attempts.controller.ts`, `attempts.routes.ts`, `attempts.validation.ts`,
`attempts.validation.test.ts`, `attempts.e2e.test.ts`, `src/test/e2e-setup.ts`,
`vitest.e2e.config.ts`, migration `20260626000000_story48_attempt_and_points/`,
`STORY-48_IMPLEMENTATION_REPORT.md`.
Modified: `prisma/schema.prisma`, `quizzes.service.ts` (assign/publish/getChapterQuizzes),
`quizzes.routes.ts`, `app.ts`, `package.json`, `vitest.config.ts`.

## 21. Remaining Risks

- Pre-existing `geminiClient` 429-retry unit test fails on the baseline (unrelated;
  left untouched per scope).
- Pre-existing schema/DB drift on the dev DB (orphan generation-fields migration not
  on disk) is tolerated by the idempotent migration; fresh DBs are built correctly.

## 22. Final Status

**Completed** — all dependent endpoints pass the real HTTP+DB E2E (twice); unit and
validation tests pass; no correct-answer leakage; no duplicate attempts/submissions;
essay grading works; published questions are immutable; typecheck and build pass.
