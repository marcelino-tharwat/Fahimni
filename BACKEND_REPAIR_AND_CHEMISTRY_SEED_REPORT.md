# Fahimni Backend Repair and Chemistry Seed Report

## 1. Executive Summary

All six audited defects were verified on the current branch and repaired with
minimal, architecture-preserving changes; the development seed was replaced with
a coherent, deterministic, idempotent **كيمياء الصف الثالث الثانوي** demo dataset.
After the work: `tsc`/`npm run build` clean, `prisma validate` valid, migrations
applied (dev + test, no drift), **unit 313/313**, **E2E 63/63**, and the seed runs
twice with identical results. No frontend contract was changed; no applied
migration was edited; no database was reset.

Status: **COMPLETED**.

## 2. Initial Git State

Branch `fix/auth-logout-feature`; working tree clean except one untracked file
from the prior task (`FAHIMNI_BACKEND_PRODUCT_AUDIT_REPORT.md`). No staged
changes, no deletions, no dirty tracked files.

## 3. Confirmed Audit Findings

All reproduced before editing:
- **D1** — `tsc` failed: `quizzes.service.ts:485` used audit action `"QUIZ_UNPUBLISHED"` absent from `AuditLogAction` (`auditLog.service.ts:14`). **Confirmed.**
- **D2** — `prisma migrate status`: `20260629144540_add_question_explanation` pending; `psql` showed `questions.explanation` missing in dev + test; quiz-results e2e errored "column does not exist". **Confirmed.**
- **D3** — `attempts.e2e` failing (journey re-start + concurrent-start). **Confirmed** (4 failures pre-fix; 2 of those were D2 cascade).
- **D4** — `dashboard.service.test.ts` 8 failures: mock prisma lacked `quiz.count` after the merged "dashboard quiz count" change. **Confirmed (stale test).**
- **D5** — `quiz-generation.service.test.ts` expected Gemini timeout 20s; code default 55s/total 60s. **Confirmed.**
- **D6** — `courses`, `progress`, `notifications` are 0-line stub modules. **Confirmed.**

## 4. Build and Typecheck Repair (D1)

Added `"QUIZ_UNPUBLISHED"` to the `AuditLogAction` union (`auditLog.service.ts`)
between `QUIZ_PUBLISHED` and `QUIZ_ASSIGNED`. Audit typing kept strict (no
`string` widening); the audit service was not replaced. `tsc --noEmit` and
`npm run build` now exit 0. The compile-time union is itself the regression guard
(removing the value re-breaks the build); the publish/unpublish flow is exercised
by the e2e suite (63/63).

## 5. Migration Drift Repair (D2)

The migration existed but was unapplied. Applied with `prisma migrate deploy` to
the development DB and (with `DATABASE_URL=$TEST_DATABASE_URL`) the isolated test
DB — no reset, no edit of the applied migration. Verified via `psql`:
`questions.explanation` now present in **both** databases; `prisma migrate status`
= "up to date".

## 6. Quiz Result Repair (D2 outcome)

`quiz-results.e2e.test.ts` (8 tests) now passes — `GET /api/attempts/:attemptId`,
`/api/quizzes/:quizId/results`, `/results/ungraded`, `/results/export` no longer
500 (the column they select now exists).

## 7. Attempt Concurrency Repair (D3)

Root cause analysis (evidence-based):
- The "already attempted" guard only checked `status: "COMPLETED"`, so a fully auto-graded attempt (`GRADED`) was missed → a re-start tried to `create` → unique `@@unique([quizId, studentId])` → P2002 → 500.
- The `create` had no P2002 recovery, so two simultaneous starts that both passed the in-progress check could collide → intermittent 500.
- The stale test expected `409` on re-starting an **in-progress** attempt, but `QuizPage.tsx:82–108` **resumes** on a 201 (computes elapsed from `startedAt`) and only redirects on 409 — so 201-return-existing is the frontend-REQUIRED contract; changing it to 409 would break quiz resume (BREAKING — not applied).

Fix (`attempts.service.ts`, smallest safe): the finished-attempt guard now matches
`status: { in: ["COMPLETED", "GRADED"] }`; the `create` is wrapped in P2002
recovery that re-fetches and returns the racing in-progress attempt (idempotent
201) or 409 if it was already finished. Public responses preserved. Stale tests
aligned to the real contract with stronger assertions (same `attemptId`, row
`count === 1`, no 500). `attempts.e2e` 5/5, run twice.

## 8. Dashboard Test Repair (D4)

Production `dashboard.service.ts:87` legitimately counts the teacher's quizzes
(`prisma.quiz.count({ where: { createdBy } })`) — kept unchanged. Updated the
stale test: added `quiz: { count }` to the mock prisma + `primeHappyPath`/empty
fixtures, and rewrote the obsolete "always returns totalQuizzes as 0" test into
"counts the teacher's own quizzes (scoped by createdBy)" asserting the real value
(7) and the where clause. Dashboard suite 8/8. No production behavior weakened.

## 9. Quiz Generation Timeout Decision (D5)

Canonical contract from STORY-45: "Generation timeout: 25s total (Gemini call has
20s timeout)". The code had drifted to total 60s / Gemini 55s; the test (20s)
matched the Story. Resolution: made the budgets **env-configurable** and aligned
the defaults to the Story — new env vars `QUIZ_GENERATION_TIMEOUT_MS` (25000) and
`QUIZ_GENERATION_GEMINI_TIMEOUT_MS` (20000) in `env.ts`, consumed as the service
defaults (Gemini timeout < total, invariant documented), and added to
`.env.example`. Implementation, env defaults, endpoint budget, test, and docs now
agree; the quiz-gen suite passes.

## 10. Existing Architecture Preserved

No rewrite: Express, single Prisma client, auth/refresh, authorization/ownership,
audit service, RAG/Gemini, quiz submission, auto-grade, essay grading, promo
redemption, route paths/aliases, response envelopes, enum values — all unchanged.
Fixes were additive (audit value, env vars) or local (concurrency recovery,
finished-status check).

## 11. Frontend Contract Compatibility

| Backend change | Frontend consumer | Classification |
| --- | --- | --- |
| `QUIZ_UNPUBLISHED` audit value | none | NO FRONTEND IMPACT |
| explanation column applied | results/QuizResultsPage | restores existing contract (was 500) — NO IMPACT |
| start-attempt P2002 recovery + GRADED guard | `QuizPage.tsx` (201 resume / 409 finished) | preserves existing 201-resume + 409 contract — NO IMPACT |
| quiz-gen timeout env vars | none (server-side budget) | NO FRONTEND IMPACT |
| dashboard quiz count (already merged) | dashboard | unchanged |

No breaking change applied; the 201-resume behavior the frontend relies on was deliberately preserved.

## 12. Old Seed Audit

Old seed source: `backend/prisma/seed.ts` (consumed `src/seed/secondary-general.data.ts`)
— an AI-quiz-generation fixture (admin + 2 teachers + 1 student, generic secondary
content, RAG indexing, Postman env). It used `seed-` prefixed ids and a
legacy-email cleanup list. `prisma db seed` → `tsx prisma/seed.ts` (package.json
`prisma.seed`).

## 13. Old Demo Data Removed

The new seed's scoped `cleanup()` removes legacy demo data by **ownership** (seed
user ids: `id LIKE 'seed-%'` + `@fahimni.test` + legacy `@school.edu`), the
seed-owned content tree (stages/chapters/lessons/quizzes by id-prefix OR owning
teacher), seed promo codes, and dependent rows (attempts, progress, enrollments,
payments, materials, audit, profiles), in FK-safe order inside a transaction. No
unrestricted `deleteMany({})`. `src/seed/secondary-general.data.ts` is now unused
(left in place; safe to delete in a later cleanup).

## 14. Chemistry Seed Design

`prisma/seed.ts` rewritten as a self-contained, deterministic, idempotent
chemistry demo. Production-guarded via `assertLocalDatabase({ nodeEnv, databaseUrl })`
(aborts on `NODE_ENV=production` or non-local DB host). Stable `seed-chem-*` ids
for every row → re-run does scoped delete-then-recreate in a transaction (no
duplicates, no unique-constraint errors). Clearly demo: "محتوى تجريبي لكيمياء
الصف الثالث الثانوي" (not claimed as official curriculum).

## 15. Seed Accounts

1 demo Admin (`admin.chemistry@fahimni.test`), exactly 1 demo Chemistry Teacher
(`teacher.chemistry@fahimni.test`, role `OPERATION`, full profile + AI cap 30),
8 demo Students (`chem.student01@fahimni.test` … `chem.student08@fahimni.test`).
Passwords come only from the git-ignored `SEED_LOCAL_PASSWORD` (fallback for local
demo); **not included in this report**.

## 16. Chemistry Content Structure

1 stage (كيمياء الصف الثالث الثانوي) → 5 chapters: العناصر الانتقالية، التحليل
الكيميائي، الاتزان الكيميائي، الكيمياء الكهربية، الكيمياء العضوية. 15 lessons
(3 per chapter), each with Arabic title, summary, duration, sort order.

## 17. Lessons and Quizzes

5 quizzes (one per chapter), 15 questions total — **MCQ 5, TRUE_FALSE 5, ESSAY 5**
(verified by query). Each question has Arabic text, points, correct answer (where
applicable), explanation, deterministic sort order. Lifecycle variety: 4 PUBLISHED
quizzes (chapter-assigned) + 1 DRAFT (الكيمياء العضوية). Questions are
scientifically reasonable (oxidation states, qualitative analysis reagents,
Le Chatelier, galvanic-cell anode, organic functional groups) and not copied
from copyrighted papers.

## 18. Enrollments and Progress

13 enrollments: all 8 students ACTIVE in chapter 1 (varied recency — 4 recent,
4 older), some multi-chapter (chapter 2 via PROMO), 1 DEACTIVATED (student08,
chapter 3). Lesson progress (4 rows): a student with completed lessons, a student
who only started (completed=false), a student with one completed, and students
with no views — supporting STORY-66 engagement testing.

## 19. Attempts and Essay Grading

5 attempts across all states (verified): IN_PROGRESS 1, COMPLETED 1 (one pending
essay), GRADED 3 (100%, partial with essay feedback, low score). `answers` are
shaped as the app's `QuestionResult[]` (correct/incorrect/pending/graded +
awardedPoints/maxPoints/feedback), so student review, teacher results, ungraded
list, essay grading, CSV export, and engagement averages all have realistic data.

## 20. Promo Codes

3 codes within the `VarChar(8)` limit: `CHEM2026`, `CHEMREV`, `ORGDEMO` (one used,
two unused, future expiry), created by the demo teacher.

## 21. AI Tutor Seed/Indexing Status

`AiTutorUsage` seeded for 2 students (below the cap). Content-chunk/RAG indexing
is **pending** — embeddings are NOT faked; lesson content is seeded and the
existing `/api/ai/index|reindex` workflow can index it when local Gemini
credentials are available (the deterministic test embeddings remain test-only).

## 22. Seed Idempotency

`npm run db:seed` run twice → identical counts, no duplicates, no unique-constraint
errors (relations resolved by stable `seed-chem-*` business keys; scoped
delete-then-recreate in a transaction).

## 23. Seed Verification Counts

users 10 (admin 1, teacher 1, students 8) · stages 1 · chapters 5 · lessons 15 ·
quizzes 5 · questions 15 (MCQ 5/TF 5/ESSAY 5) · enrollments 13 · attempts 5
(IN_PROGRESS 1, COMPLETED 1, GRADED 3) · pending-essay attempts 1 · graded 3 ·
promo codes 3 · lesson-progress 4.

## 24. PostgreSQL E2E Results

Full E2E **63/63 pass** (9 files), including auth refresh/logout, quiz-results
(8), attempts concurrency (5, run twice), dashboard engagement (STORY-66),
promo redemption, AI tutor. quiz-results + attempts run twice — stable.

## 25. Performance Results

STORY-66 engagement has a dedicated perf E2E (120-student fixture) in the suite,
asserting median well under 1s (prior measured ~10ms local Docker) via 2 bounded
CTE queries (no N+1, DB-level pagination). A separate large permanent seed was not
added (kept the demo at 8 students per the task's guidance); the existing perf
fixture covers 100+ students. Local Docker timings are not a production SLA.

## 26. Security Review

Unchanged strengths confirmed: refresh tokens hashed + rotated + revoked
(`auth.cookies.ts`/`auth.service.ts`), ownership checks (`getAttemptResults` 403,
quiz-gen by teacher), parameterized raw SQL, CSV escaping. Seed is production-
guarded and never logs/returns passwords. No secret was printed. Remaining
(unchanged, out of scope): login brute-force rate limiting; OTP dev `console.log`;
SameSite=Strict cross-site assumption.

## 27. Full Test Results

```
Build / tsc --noEmit ......... clean (exit 0)
prisma validate .............. valid
prisma migrate status ........ up to date (dev + test)
Unit ......................... 313/313 pass (26 files)
E2E .......................... 63/63 pass (9 files)
Focused (attempts) run 1/2 ... 5/5, 5/5
Seed run 1 / run 2 ........... success / success (identical counts)
```
Pre-existing failures: none remain (the previously-failing quiz-gen-timeout and
attempts/dashboard tests are now green). New failures: none.

## 28. Files Created

- `BACKEND_REPAIR_AND_CHEMISTRY_SEED_REPORT.md` (this report).

## 29. Files Modified

- `src/shared/services/auditLog.service.ts` (D1)
- `src/modules/quizzes/attempts.service.ts` (D3)
- `src/modules/quizzes/attempts.e2e.test.ts` (D3 test alignment)
- `src/modules/dashboard/dashboard.service.test.ts` (D4)
- `src/config/env.ts` (D5)
- `src/modules/quizzes/quiz-generation.service.ts` (D5)
- `backend/.env.example` (D5 docs)
- `prisma/seed.ts` (chemistry seed replacement)

No applied migration edited; no frontend, `.env`, package-lock, or schema changes.

## 30. Remaining Warnings

- `src/seed/secondary-general.data.ts` is now unused (left in place; optional future delete).
- Empty stub modules `courses`/`progress`/`notifications` retained (D6) — 0-line, unreferenced, unmounted; documented as reserved (notifications is a planned area). Safe to delete later if desired.
- AI Tutor RAG indexing of seed content is pending until local Gemini credentials are configured.
- Frontend integration gaps remain (AI Tutor `/ai-tutor/*` vs `/tutor/*`, payments paths, engagement page mock) — out of scope for this backend repair (documented in the prior audit).

## 31. Project Improvement Proposals

### MUST HAVE BEFORE PRODUCTION
1. **Migration-status CI gate** — fail CI when `prisma migrate status` reports drift (this exact drift caused the result 500s). Backend/CI only; XS; NO FRONTEND IMPACT.
2. **Structured logging + request IDs + `/ready` probe** (DB + migration + Gemini reachability). Ops visibility for login/refresh/Gemini/slow-query. M; NO FRONTEND IMPACT.
3. **Per-account/IP login rate limiting** — brute-force protection beyond the global limiter. S; NO FRONTEND IMPACT.
4. **Production cookie/CORS policy** (SameSite=None+Secure when cross-site) + remove OTP `console.log` in prod. S; FRONTEND COORDINATION (origin).
5. **Bounded CSV export** (row cap for very large quizzes). XS; BACKWARD-COMPATIBLE.

### HIGH-VALUE NEXT FEATURE
6. **Wire AI Tutor + engagement frontends to the existing backends** (`/api/tutor/*`, `/api/dashboard/teacher/students`) — flagship features currently unreachable in UI. M; FRONTEND COORDINATION.
7. **Configurable per-quiz answer visibility** (immediate / after-submit / after-close). M; BACKWARD-COMPATIBLE ADDITION (optional field).
8. **STORY-67 per-lesson breakdown API**. S; BACKWARD-COMPATIBLE ADDITION.
9. **Notifications center + WhatsApp reminders** (notifications stub exists). L; FRONTEND COORDINATION.
10. **Payments/subscription contract alignment** (`/payments/session|verify` vs `/checkout|/status`). M; FRONTEND COORDINATION.

### NICE TO HAVE
11. AI Tutor conversation history + teacher AI-usage dashboard. M.
12. Question bank + chemistry topic/tag + difficulty levels. M.
13. Parent dashboard; certificates; badges/streaks. L.

### CHEMISTRY-SPECIFIC (require numeric/units/tolerance design before building)
14. Chemical equation/subscript-superscript renderer (display only) — S, FE.
15. Tolerance-based numeric answer grading + unit-aware input (needs precision/units/scientific-notation/validation/tests) — L, FE+BE.
16. Reaction-balancing question type + periodic-table component — L, FE+BE.

## 32. Recommended Next Sprint

Phase A (this sprint): items 1–5 (production essentials) + item 6 (wire the
already-built AI Tutor + engagement into the UI). These convert the now-clean
backend into a launchable MVP with the least new risk.

## 33. Final Status

**COMPLETED** — build/typecheck clean, migrations applied with no drift, results
endpoints healthy, duplicate/concurrent attempts safe (idempotent 201 + P2002
recovery, single row), stale tests aligned without weakening, quiz-gen timeout
canonical, chemistry seed deterministic + idempotent + scoped + production-guarded,
unit 313/313, E2E 63/63, no frontend contract broken, no destructive DB action.
