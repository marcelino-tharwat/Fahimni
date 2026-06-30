# Fahimni Backend and Product Audit Report

> Audit-only. No production code, tests, schema, migrations, seeds, or Postman
> files were modified. Evidence is cited as `path:line`, route, command output,
> or test name. Generated on branch `fix/auth-logout-feature`.

## 1. Executive Summary

Fahimni is an Arabic-first teacher-content + AI learning platform (LMS + AI Tutor
+ AI quiz generation + assessment). The backend (Express + Prisma + PostgreSQL +
pgvector + Gemini) is **feature-rich and largely implemented for Sprints 1–4's
core flows**, with genuinely strong pieces: cookie-based auth with hashed,
rotated, revocable refresh tokens; RAG-grounded AI Tutor with atomic daily
quota; AI quiz generation; auto-grading + essay grading; teacher engagement
analytics via a single CTE query.

However, the **current `fix/auth-logout-feature` branch is not in a shippable
state**, with two confirmed P1 issues found by direct command output:

- **Build is broken** — `npm run build` / `tsc --noEmit` fails: `quizzes.service.ts:485` uses audit action `"QUIZ_UNPUBLISHED"`, which is absent from the `AuditLogAction` union (`auditLog.service.ts:14`). The merged "unpublish endpoint" change never compiled.
- **Migration drift / runtime 500** — `Question.explanation` exists in `schema.prisma:297` and in migration `…_add_question_explanation`, but the column is **absent in both the dev and test databases** (migration unapplied). The student results endpoint (`GET /api/attempts/:attemptId`) and teacher results (`GET /api/quizzes/:quizId/results`) select `explanation`, so they return `column "questions.explanation" does not exist` at runtime. This is what fails `quiz-results.e2e.test.ts`.

Test condition: unit/integration **304/313 pass** (8 stale dashboard tests after a merged "dashboard quiz count" change + 1 long-standing quiz-gen timeout mismatch); E2E **51/63 pass, 4 fail, 8 skipped** (quiz-results suite blocked by the missing column; `attempts.e2e` duplicate-attempt failures).

Security condition: **good for core auth** (HttpOnly cookies, hashed/rotated/
revoked refresh, ownership checks, parameterized raw SQL, CSV-injection escaping)
with medium gaps (SameSite=Strict assumption, brute-force/login-rate limiting,
no per-route rate limiting beyond a global limiter).

Frontend integration condition: **partial and drifting**. Several pages still
render mock data even though real backends exist (notably StudentEngagementPage
vs the completed STORY-66 backend), and three frontend feature areas call
endpoints the backend does not expose (AI Tutor `/ai-tutor/*`, payments
`/payments/session|verify`, support `/support/*`).

Product condition: a **technically strong, well-differentiated Arabic AI
tutoring/assessment idea** whose moat is teacher-owned content grounding the AI;
commercial viability is plausible (teacher/school subscriptions + AI tiers) but
payments are stubbed and multi-tenant/admin is mock-only.

Release readiness: **NOT READY** (build broken + migration drift are hard
blockers), but close — both blockers are small, well-isolated fixes.

## 2. Audit Scope and Limitations

- Read the full `sprints.md` (4 sprints, 83 stories), backend `src/` (18 modules), `prisma/schema.prisma` (19 models, 40 migrations), and the frontend in read-only mode.
- Ran only safe commands: `git`, `npx prisma validate`, `npx prisma migrate status`, `npx tsc --noEmit`, `npm run build`, `npx vitest run`, `npx vitest run --config vitest.e2e.config.ts`, and read-only `psql -c "SELECT …"` against local Docker DBs.
- **Limitation:** depth was concentrated on the highest-signal, cross-cutting areas (auth/session, AI Tutor, quizzes/attempts/grading/results, dashboard/engagement, enrollment/promo, content, schema, build/tests, frontend contract). Sprints 1–2 CRUD stories (stages/chapters/lessons/users/students/teacher profile) were inventoried and spot-checked, not exhaustively re-verified criterion-by-criterion for all 83 stories.
- No production-scale data was available; performance findings are static analysis + the local STORY-66 benchmark (~10ms/120 students) captured in a prior task.
- Secrets were never printed; cookie/token values were redacted.

## 3. Git and Repository Baseline

- Branch: `fix/auth-logout-feature`; **working tree clean** (`git status` empty); started from a stable state.
- No staged/untracked/deleted files; no unexpected mass deletions.
- Recent history shows the auth-refresh repair (`ab7f429`), quiz-results page (`0de1bdf`), quiz bug fixes incl. "unpublish endpoint" + "dashboard quiz count" (`72caa4c`), and STORY-66 engagement (`962cc80`) all merged.
- No recovery/destructive Git command was used.

## 4. Project Architecture

Express app (`backend/src/app.ts`): `helmet`, `cors({origin:"http://localhost:5173", credentials:true})`, `express.json`, `cookieParser`, a global `rateLimiter`, `trust proxy 1`. Mounts (16):

```
/api/v1/auth, /api/users, /api/students, /api/teachers, /api/stages,
/api/chapters, /api/lessons, /api/v1 (files), /api/content, /api/dashboard,
/api/ai, /api/tutor, /api/enrollments, /api/promo-codes, /api/payments,
/api/quizzes, /api/attempts
```

Per-module layering: `*.routes.ts` → `*.controller.ts` → `*.service.ts` (+ validation, types). Shared: `authenticate.middleware`, `authorize.middleware`, `validate.middleware`, `apiResponse` (`okResponse`), `AppError`, `auditLog.service`, Prisma singleton (`config/database.ts`), `geminiClient`. AI/RAG: `ai.service` (chunk/embed/similarity over `content_chunks` `vector(3072)`), `tutor/*`. **Empty stub modules (0 lines, all files): `courses`, `progress`, `notifications`.**

## 5. Product Vision and Core User Journeys

Actors: **Student**, **Teacher (role `OPERATION`)**, **Admin** (`ADMIN` role exists; admin UI is mock-only), Support (frontend-only). Core journeys and status:

| Actor | Journey | Backend | Status |
| --- | --- | --- | --- |
| Student | register/login/session | `/api/v1/auth/*` | Implemented (auth repaired) |
| Student | browse content / My Courses | `/api/content/student/*` | Implemented |
| Student | enroll (promo) | `/api/promo-codes/redeem`, `/api/enrollments` | Implemented |
| Student | take quiz + auto-grade | `/api/quizzes/:id/attempt`, `/api/attempts/:id/submit` | Implemented |
| Student | review results | `GET /api/attempts/:attemptId` | Implemented but **500 (explanation col)** |
| Student | AI Tutor | `/api/tutor/ask`, `/api/tutor/usage-today` | Backend done; **frontend calls wrong paths** |
| Teacher | content CRUD | stages/chapters/lessons | Implemented |
| Teacher | AI quiz gen + edit + publish | `/api/quizzes/generate`, `/:id/publish`, `/:id/unpublish` | Implemented; **unpublish breaks build** |
| Teacher | grade essays + results + CSV | `/api/attempts/:id/grade-essays`, `/api/quizzes/:id/results[/ungraded|/export]` | Implemented; results **500 (explanation col)** |
| Teacher | engagement dashboard | `/api/dashboard/teacher/students` | Backend done; **frontend uses mocks** |
| Teacher | settings (AI cap) | `/api/teachers/profile` | Implemented |
| Any | payments | `/api/payments/{webhook,checkout,status}` | Backend present; **frontend calls `/session`,`/verify`** |
| Support | WhatsApp/support | — | **No backend** (frontend `/support/*` mock) |
| Admin | tenants/moderation | — | **No backend** (mock) |

## 6. Sprint and Story Master Matrix (summary)

83 stories / 4 sprints. High-level status by area (representative, evidence-based):

| Sprint | Area | Representative stories | Status |
| --- | --- | --- | --- |
| 1 | Identity/Access | STORY-1..6 (db, register, login, OTP) | Implemented; login/register working (auth.service) — note STORY-4/5 said "30-day JWT, no refresh"; actual design evolved to access+refresh cookies |
| 2 | Content + dashboards | STORY-23..31 (stages/chapters/lessons, content listing, teacher stats) | Implemented; STORY-29 dashboard implemented (+ later quiz-count change broke its unit test) |
| 3 | AI gen + enrollment/payments | STORY-42..53 | AI client/RAG/quiz-gen/CRUD implemented; STORY-50 enrollment implemented; STORY-51 Paymob backend present but frontend contract mismatch; STORY-52/53 promo implemented |
| 3/4 | Quiz lifecycle | STORY-44,45,46,48,54,55,56,58,68 | Implemented; STORY-58 student results backend present but **500 (explanation)**; STORY-68 results/CSV present but **500 (explanation)** |
| 4 | AI Tutor | STORY-63,64,65 | Backend FULLY IMPLEMENTED + tested; **frontend (STORY-69) not integrated — wrong endpoints** |
| 4 | Engagement | STORY-66 | Backend FULLY IMPLEMENTED + tested (~10ms/120 students); **frontend mock** |
| 4 | Per-lesson breakdown | STORY-67 | **NOT IMPLEMENTED** (no `/dashboard/teacher/students/:id/lessons`) |
| 4 | Notifications / support / parent / tenant | various | **NOT IMPLEMENTED** (`notifications` stub; `/support` absent) |

## 7. Detailed Story-by-Story Audit (key stories)

- **STORY-63/64/65 (AI Tutor service/endpoint/daily cap)** — FULLY IMPLEMENTED AND VERIFIED (backend). Evidence: `src/modules/ai/tutor/*`, e2e `auth/…`, `tutor.e2e`, `tutor-usage.e2e` passing; atomic quota claim; refund; STORY-66-safe createdAt. **Caveat:** consumed by the frontend via non-existent `/ai-tutor/*` routes → end-to-end journey broken.
- **STORY-66 (engagement)** — FULLY IMPLEMENTED AND VERIFIED (backend): `dashboard/student-engagement.service.ts` (CTE, 2 queries), e2e passing. SUPERSEDED-on-frontend: `StudentEngagementPage.tsx` uses `shared/mocks`.
- **STORY-68 (results + essay grading + CSV)** — IMPLEMENTED WITH DEFECTS: grading correct; results/CSV present (`attempts.service.getQuizResults/buildResultsCsv`), but **results queries 500** due to the unapplied `explanation` migration.
- **STORY-58 (student quiz review)** — IMPLEMENTED WITH DEFECTS: `GET /api/attempts/:attemptId` exists with ownership check, but **500 (explanation)**; frontend `QuizResultsPage` is driven by router `location.state` from submit (re-fetch path exists but unverified in UI).
- **STORY-48 (attempts/auto-grade)** — IMPLEMENTED WITH DEFECTS: `attempts.e2e` has failing tests (duplicate-attempt journey + concurrency) — see §24.
- **STORY-29 (teacher stats)** — FULLY IMPLEMENTED; unit test stale after merged quiz-count change.
- **STORY-67/notifications/support/parent/tenant** — NOT IMPLEMENTED.
- **Auth (STORY-4/5 + refresh repair)** — FULLY IMPLEMENTED; see §14.

## 8. Dependency Integrity Analysis

- STORY-63 → 42+43 (Gemini, RAG): satisfied (`geminiClient`, `ai.service` chunk/embed/similarity).
- STORY-64 → 63, STORY-65 → 64: satisfied.
- STORY-66 → 29+50: satisfied (enrollment + dashboard reuse).
- STORY-68 → 44+48: satisfied structurally, but blocked at runtime by the explanation-column drift.
- STORY-69 (AI Tutor chat UI) → 63/64/65: **broken link** — the frontend does not call the implemented `/api/tutor/*` contract.

## 9. Backend Module Inventory (selected)

| Module | Key routes | Service highlights | Tests | Frontend consumer | Risk |
| --- | --- | --- | --- | --- | --- |
| auth | login/register/refresh/me/logout/change-password | hashed+rotated refresh cookie, revoke | e2e (auth refresh) | api client | low |
| ai | index/reindex/status/search | chunk/embed/pgvector | story-43 era | content-index UI | med (status accuracy) |
| ai/tutor | ask, usage-today | RAG + quota | e2e ✓ | **mismatch** | high (integration) |
| quizzes | CRUD, generate, publish/unpublish, results | gen, grading, results, CSV | unit+e2e (partly failing) | quiz pages | **high (build + 500)** |
| attempts | submit, grade-essays(POST+PATCH), GET :id | auto-grade, recalc, ownership | e2e (failing subset) | quiz take/results | **high (500)** |
| dashboard | teacher/stats, teacher/students | counts, engagement CTE | unit (stale), e2e ✓ | stats real / engagement mock | med |
| enrollment | my, student/:id, deactivate, create | active-enrollment rules | — | My Courses | med |
| promo-code | create/list/validate/redeem | atomic redeem | e2e ✓ | redeem UI | low |
| content | tree, student/my-courses, lessons, view | progress via LessonProgress | — | My Courses/lesson | med |
| payment | webhook/checkout/status | Paymob | — | **mismatch** | high (integration) |
| stage/chapter/lessons | CRUD + reorder | two-phase reorder | reorder test | content manager (mock) | low |
| courses/progress/notifications | — | **empty stubs** | — | — | info |

## 10. API Route Inventory (highlights + issues)

Confirmed routes include (canonical, under `/api`): `v1/auth/{login,register,forgot-password,reset-password,verify-otp,refresh,me(GET),change-password(PATCH),logout}`, `tutor/{ask,usage-today}`, `ai/{index/:id,reindex/:id,status/:id,search}`, `dashboard/teacher/{stats,students}`, `quizzes/{,(POST),generate,student,assigned,:id/attempt,:quizId/questions/*,:quizId/results[/ungraded|/export],:id/publish,:id/unpublish,:id/assign,:id(GET/PUT/DELETE)}`, `attempts/{:id/submit,:id/grade-essays(POST+PATCH),:id(GET)}`, `enrollments/{my,student/:id,:id/deactivate,(POST)}`, `promo-codes/{(POST),(GET),:code/validate,redeem,:code/redeem}`, `content/{tree,student/tree,student/my-courses,student/lessons/:id,student/lessons/:id/view}`, `payments/{webhook,checkout,status/:orderId}`, `stages/*`, `chapters/*`, `lessons/*`, `teachers/profile*`, `students/*`, `users/(GET)`, `v1/files/signed-url`.

Issues:
- **Duplicate redeem routes**: `promo-codes/redeem` and `promo-codes/:code/redeem` (verify both are intended / consumed).
- **grade-essays POST+PATCH alias** (intentional, documented in code).
- **Frontend-required-but-absent**: `/ai-tutor/history`, `/ai-tutor/messages`, `/ai-tutor/remaining-questions`; `/support/students`; `/payments/session`, `/payments/verify`.
- **Backend-present-but-unused-by-frontend**: `/api/tutor/*` (frontend calls `/ai-tutor/*`), `/api/dashboard/teacher/students` (frontend mocks).

## 11. Frontend/Backend Contract Matrix (key rows)

| Endpoint (frontend) | Backend exists? | Consumer | Mock/real | Breaking risk |
| --- | --- | --- | --- | --- |
| `/v1/auth/{login,me,refresh,logout}` | Yes | authSlice, client interceptor | real | low (repaired) |
| `/content/student/my-courses` | Yes | My Courses | real | low |
| `/quizzes/:id` + attempt/submit | Yes | quiz take | real | medium (explanation 500) |
| `GET /attempts/:id` (results) | Yes | results page | partial (router state) | **high (500)** |
| `/dashboard/teacher/students` | Yes (STORY-66) | StudentEngagementPage | **mock** | n/a (not wired) |
| `/ai-tutor/{history,messages,remaining-questions}` | **No** | AiTutorPage | **mock** | **high (no backend)** |
| `/payments/{session,verify}` | **No** (`/checkout`,`/status`) | payment.ts | — | **high (mismatch)** |
| `/support/students` | **No** | support.ts | mock | high (no backend) |
| tenants/admin | **No** (no Tenant model) | admin pages | **mock** | n/a |

## 12. Business Logic Findings

- **Auth**: solid (see §14). **Content ownership**: teacher→stage→chapter→lesson chain enforced (e.g., quiz-gen `resolveContent`, engagement CTE). **Enrollment**: active-status rules consistent. **Quiz/attempts/grading**: auto-grade + essay recalc are correct (`auto-grade.ts finalizeOutcome` sums awardedPoints once). **AI Tutor**: grounded, citation-mapped, quota-atomic.
- Confirmed defect: `QUIZ_UNPUBLISHED` audit action type (build).
- Confirmed defect: `explanation` column drift (runtime 500).
- Ambiguous product rule: multi-teacher AI-tutor cap resolution (documented MAX-of-teachers in STORY-65) and multi-teacher engagement scoping — acceptable but worth a product decision.
- Duplication/debt: promo redeem has two route shapes; dashboard `totalQuizzes` semantics changed without test update.

## 13. Student Quiz Review Gap (Phase 8)

- `POST /api/attempts/:attemptId/submit` returns `{ attemptId, quizId, status, score, totalPoints, percentage, pendingEssayCount, isFinal, results[] }` (`attempts.service.toSubmissionResponse`) — submitted answer + awardedPoints + maxPoints + feedback per question; **correctAnswer is NOT in the submit envelope** (good pre-grading protection).
- A durable student re-fetch exists: `GET /api/attempts/:attemptId` (STUDENT, ownership-checked at `attempts.service.ts:519`). It selects `correctAnswer` and `explanation` for post-submission review — appropriate *policy* (show correct answer after submission), but currently **500s** because `explanation` isn't in the DB.
- Frontend `QuizResultsPage.tsx:50` reads `location.state`; on hard refresh it should fall back to the GET (mapping helper noted in the student quiz API), but this fallback is unverified in the UI and currently broken by the 500.
- **Recommended contract (compatible):** keep submit envelope (no correctAnswer) ; keep `GET /attempts/:id` returning correctAnswer+explanation+feedback post-submission; add an optional per-quiz `revealAnswers` policy later (additive). Fix the migration to unblock.

## 14. Authentication and Session Audit

Strong, recently repaired (merged): access JWT (15m) + refresh JWT (7d) both **HttpOnly cookies**; refresh stored **SHA-256 hashed** (`auth.service.ts:60,139,309`), **rotated in place** (preserves `createdAt` → STORY-66 proxy), **replay-rejected** (unique `jti`), **revoked on logout** (`auth.cookies.ts` clear + DB delete); concurrent refresh → one successor; `forceLogout` clears state; `AuthGuard` treats idle/loading as pending (refresh-survival). Cookie options centralized in `auth.cookies.ts`. CORS credentialed with explicit origin.

Residual: SameSite=Strict assumes same-site deployment (cross-site prod needs None+Secure); no login brute-force/rate limit beyond the global limiter; single-device session policy (login `deleteMany`), so multi-device + logout-all are future work.

## 15. Authorization and Data Isolation

`authorize.middleware("OPERATION"/"STUDENT"/"ADMIN")` on protected routes; ownership enforced in services (quiz-gen by `stage.teacherId`; grade-essays by `quiz.createdBy`; engagement by enrollment→stage→teacher; `getAttemptResults` by `studentId`). No IDOR found in audited endpoints. Raw SQL is parameterized (`$queryRaw`/`$queryRawUnsafe` with bound params + allowlisted ORDER BY in engagement). No cross-teacher leakage found in audited paths.

## 16. Database and Migration Audit

`prisma validate`: **valid**. 19 models, 40 migrations. **`prisma migrate status`: drift — the latest migration `…_add_question_explanation` is unapplied to the dev DB**, and a `psql` check shows the `explanation` column missing in **both** `final_project` and `final_project_test`. Schema otherwise coherent: `vector(3072)` matches the embedding model; refresh-token, AiTutorUsage, TeacherProfile.aiTutorDailyQueryLimit, Question.explanation present; soft-delete via `deletedAt` on stage/chapter/lesson. `RefreshToken.token` is `@unique` and stores a hash (good). **Action (forward-only):** `prisma migrate deploy` (or `migrate dev`) in every environment + CI gate that fails when `migrate status` reports drift.

## 17. Transactions, Concurrency, and Idempotency

Good atomic patterns present: refresh rotation (conditional `updateMany`), AI daily quota (atomic `INSERT … ON CONFLICT … WHERE count<limit`), question reorder (two-phase), quiz-gen persistence (transaction). Concurrency risk to verify: `attempts.e2e` "creates exactly one attempt under simultaneous starts" and "submits exactly once" currently **fail** — may indicate a regression OR be downstream of the explanation-column 500; needs isolation (see §24). Promo redeem and enrollment uniqueness rely on DB unique constraints (`enrollments @@unique(studentId,chapterId)`).

## 18. Security Findings

| ID | Sev | Area | Evidence | Note |
| --- | --- | --- | --- | --- |
| S1 | MEDIUM | Login rate limiting | global `rateLimiter` only | add per-account/IP login throttle (brute force) |
| S2 | MEDIUM | Cookie SameSite | `auth.cookies.ts` `sameSite:'strict'` | breaks cross-site prod; document/flag |
| S3 | LOW | OTP in logs | `auth.service.ts:190` `console.log("[OTP] …")` | dev-only MVP; remove before prod |
| S4 | LOW | Error envelope | global handler returns stack only in dev | confirm no stack in prod |
| S5 | INFO | CSV injection | mitigated (`attempts.service.escapeCsv`) | keep |
| S6 | INFO | Prompt injection | mitigated (tutor system instruction) | keep |
| S7 | LOW | Seed credentials | `ADMIN_*` env defaults | ensure overridden in prod |

No CRITICAL/HIGH confirmed in audited code. Refresh-token, ownership, and SQL handling are sound.

## 19. Performance and Scalability Findings

- STORY-66 engagement: 2 bounded queries, ~10ms/120 students (prior benchmark) — good.
- CSV export (`buildResultsCsv`): unbounded by quiz size; fine for class sizes, add a row cap for very large quizzes.
- AI Tutor: bounded RAG (top-K=5) + 10s gen timeout + 18s endpoint budget — good.
- Risks at scale: global in-memory `rateLimiter` and the single-flight refresh state are per-process (won't scale horizontally without shared store/Redis); Gemini latency/quota is the dominant cost driver; no connection-pool tuning observed.
- Likely fine to ~1k students; for 10k+ and many concurrent submissions, add pooling, Redis-backed limiting, and background jobs for heavy AI/CSV.

## 20. Testing and E2E Findings

- `tsc --noEmit` / `npm run build`: **FAIL** (QUIZ_UNPUBLISHED).
- Unit/integration (`vitest run`): 313 tests, **304 pass / 9 fail** — 8 stale `dashboard.service.test.ts` (mock prisma lacks `quiz` after the merged quiz-count change; prod works), 1 pre-existing `quiz-generation … 20s timeout` (code default 55s vs test 20s).
- E2E: 63 tests, **51 pass / 4 fail / 8 skipped** — `quiz-results.e2e.test.ts` blocked by the missing `explanation` column; `attempts.e2e` STORY-48 journey + concurrency failing.
- Strengths: real-Postgres e2e for auth, tutor, engagement, promo; ownership/concurrency tests exist. Gaps: tests not updated after prod changes (dashboard quiz count); the 20s-timeout test contradicts current config.

## 21. Postman and Seed Findings

`backend/postman/` contains quiz-generation/submission collections + environment templates + a prepare script (`scripts/prepare-quiz-postman-e2e.ts`); local populated environments are gitignored. No secrets observed in templates. Coverage is partial (quiz flow); auth/tutor/engagement/promo lack collections. (Not modified.)

## 22. Observability and Operations

`config/logger.ts` is a thin `console` wrapper (no levels config, no request/correlation IDs, no structured transport). `/health` returns `{status:"ok"}`; no readiness/migration/Gemini/DB checks. No graceful shutdown / Prisma `$disconnect` on signals observed in `server.ts`. The backend currently cannot cleanly answer "why did refresh fail / which query is slow / is Gemini up / are migrations applied" in production.

## 23. Deployment and Production Readiness

`READY WITH WARNINGS` blocked to **NOT READY** by: (1) build failure, (2) migration drift. Other gaps: SameSite/Secure for cross-site prod; in-memory rate-limit/refresh state for horizontal scaling; no readiness probe; OTP/console logging; seed-credential defaults. `.env.example` present; `docker-compose.yml` maps Postgres `15432:5432` (note: `.env` `DATABASE_URL` must use `15432` locally).

## 24. Confirmed Defects

| ID | Sev | Title | Evidence | Fix (minimal, compatible) |
| --- | --- | --- | --- | --- |
| D1 | **P1** | Build broken: invalid audit action | `quizzes.service.ts:485` `"QUIZ_UNPUBLISHED"` ∉ `AuditLogAction` (`auditLog.service.ts:14`) | add `"QUIZ_UNPUBLISHED"` to the union (additive) |
| D2 | **P1** | Migration drift → results 500 | `migrate status` drift; `psql` shows `questions.explanation` missing in dev+test; `quiz-results.e2e` error "column does not exist" | apply `add_question_explanation` via `migrate deploy`; add CI drift gate |
| D3 | P2 | `attempts.e2e` STORY-48 failures | e2e: assign→publish→…→grading, unauth/wrong-role start, concurrency one-attempt/one-submit | isolate (may be downstream of D2 or a duplicate-attempt regression); verify before fixing |
| D4 | P3 | Stale dashboard unit tests | `dashboard.service.test.ts` mock prisma lacks `quiz` after merged quiz-count change | update test mocks (do not revert prod) |
| D5 | P3 | quiz-gen 20s-timeout test mismatch | test expects 20s; code default 55s | reconcile test/config |
| D6 | P3 | Empty stub modules shipped | `courses`, `progress`, `notifications` (0 lines) | remove or implement; don't mount |

## 25. Suspected Risks Requiring Verification

- D3 root cause (concurrency regression vs explanation-500 cascade) — re-run `attempts.e2e` after applying D2.
- Frontend results page hard-refresh fallback to `GET /attempts/:id` — verify in UI after D2.
- Whether both promo redeem routes are consumed.

## 26. Pre-Existing Test Failures

- `quiz-generation.service.test.ts > calls Gemini with a 20s timeout configuration` — long-standing (config 55s). Evidence: stable across prior tasks.
- `attempts.e2e` STORY-48 duplicate-attempt failures predate this branch (observed in earlier audits) — but the count grew (now 4); the increase is likely D2-driven and must be re-checked.

## 27. Missing Test Coverage

Auth login brute-force; payment flow; AI Tutor endpoint wiring contract; content/my-courses; enrollment creation; results page hard-refresh; migration-drift CI check; logout-all/multi-device.

## 28. Undocumented Backend Additions

| Addition | Location | Value | Recommendation |
| --- | --- | --- | --- |
| Refresh rotation + hashing + `jti` + revoke | auth.service/auth.cookies | high (security) | document |
| grade-essays POST→PATCH alias | attempts.routes | compat | document |
| `/quizzes/:id/unpublish` | quizzes.routes | useful | document + fix D1 |
| `/ai/reindex/:id` | ai.routes | useful | document |
| AI quota atomic claim + refund | tutor-usage.service | high | document |
| CSV injection escaping | attempts.service | high | document |
| Student `GET /attempts/:id` results | attempts.routes | high (STORY-58) | document |
| Empty stub modules | courses/progress/notifications | risk | remove/track |

## 29. Sprint Documentation Drift

- STORY-4/5 say "JWT 30-day, refresh not needed for MVP"; the system now uses access+refresh cookie sessions. `sprints.md` not updated.
- STORY-29 acceptance ("totalQuizzes") predates the Quiz model; dashboard now counts quizzes; tests/docs stale.
- AI Tutor frontend (STORY-69) endpoints in code (`/ai-tutor/*`) don't match the delivered backend (`/tutor/*`).

## 30. Technical Debt Register (selected)

| ID | Pri | Module | Debt | Effort |
| --- | --- | --- | --- | --- |
| T1 | High | quizzes | build-breaking type; large service | S |
| T2 | High | ops | logger has no levels/IDs/structured output | M |
| T3 | Med | tests | stale mocks/expectations after prod changes | S |
| T4 | Med | modules | empty stub modules | XS |
| T5 | Med | scaling | in-memory rate-limit + refresh single-flight | M |
| T6 | Low | routes | duplicate promo redeem shapes | XS |
| T7 | Med | migrations | no CI drift gate | S |

## 31. Product Idea Evaluation

Fahimni is a **hybrid Arabic teacher-content LMS + AI study assistant + AI
assessment** platform. The defensible core is **AI grounded strictly in the
teacher's own indexed content** (RAG over `content_chunks`), combined with
AI-generated quizzes and a teacher essay-grading + analytics loop. This is more
focused and trustworthy than generic ChatGPT use and more AI-native than
Moodle/Google Classroom, and it targets an underserved Arabic K-12/tutoring
market. The product is real and coherent; the main risks are content-quality
dependence, AI cost, and unfinished monetization/operations.

## 32. Product Scoring (subjective, evidence-based; 1–10)

| Category | Score | Reasoning |
| --- | --- | --- |
| Problem clarity | 8 | clear Arabic teacher/student pain |
| Market usefulness | 8 | tutoring + assessment demand |
| Teacher value | 8 | content ownership + AI gen + grading + analytics |
| Student value | 7 | grounded tutor + quizzes; review flow broken now |
| AI differentiation | 9 | content-grounded RAG tutor + quota |
| Technical feasibility | 8 | already built end-to-end |
| Backend maturity | 6 | strong features; build/migration/test breakage |
| Security readiness | 7 | strong auth; rate-limit/ops gaps |
| Scalability | 6 | fine to ~1k; in-memory state limits scale-out |
| Retention potential | 6 | needs notifications/parent/streaks |
| Commercial potential | 7 | subscriptions + AI tiers; payments unfinished |
| Production readiness | 4 | two P1 blockers, observability gaps |

## 33. Product Strengths

Content-grounded AI Tutor; AI quiz generation; auto + essay grading with score
recalculation; engagement analytics; promo-code enrollment; cost control via AI
daily caps; Arabic-first; recently hardened auth/session.

## 34. Product Weaknesses

Unfinished payments; no notifications/parent/support backend; AI Tutor & engagement
not wired in the UI; results currently 500; build broken; thin observability;
multi-tenant/admin mock-only; AI cost exposure.

## 35. Competitive Differentiation

vs Moodle/Google Classroom: AI-native, Arabic-first, teacher-content-grounded.
vs generic ChatGPT: grounded + cited + quota-limited + assessment-integrated.
vs quiz tools: full teacher→content→AI→grade→analyze loop. Moat = teacher-owned
RAG corpus + the grading/analytics loop.

## 36. Commercial and Cost Considerations

Likely model: teacher/school subscription + AI usage tiers (the daily cap is
already a cost lever) + optional paid content. Cost drivers: Gemini generation/
embeddings, support, infra. Acquisition friction: teacher onboarding + content
indexing quality. Retention: notifications, parent visibility, streaks/analytics.

## 37. Feature Gap Analysis

**Must-have before production:** apply migrations + CI gate; fix build; complete
student result review (fix 500 + verify UI); wire AI Tutor frontend to `/tutor/*`;
production cookie/CORS config; structured logging + readiness probe; login rate
limiting; backups. **High-value next:** payments completion (align frontend
`/checkout`,`/status`), notifications center + WhatsApp, parent dashboard,
configurable per-quiz answer visibility, STORY-67 per-lesson breakdown, teacher
onboarding, AI usage dashboard. **Nice-to-have:** badges/streaks/leaderboards,
question bank, certificates, offline/mobile.

## 38. Non-Breaking Backend Recommendations (NO/Backward-compatible)

Add `QUIZ_UNPUBLISHED` to the audit union; apply pending migration; add
compatibility aliases for the frontend's `/ai-tutor/*` → tutor service and
`/payments/session|verify` → checkout/status (or coordinate frontend); add
structured logging + `/ready`; per-account login throttle; CSV row cap;
migration-drift CI check. All additive.

## 39. Changes Requiring Frontend Coordination

Wire AI Tutor UI to `/api/tutor/*` (or keep alias); reconcile payments paths;
wire StudentEngagementPage to `/api/dashboard/teacher/students`; remove tenant/
support mocks once backends exist; ensure results page uses `GET /attempts/:id` on
refresh.

## 40. Prioritized Improvement Roadmap

- **Phase A (blockers):** D1 build fix; D2 migrate deploy + CI gate; re-verify D3.
- **Phase B (complete promises):** wire AI Tutor + engagement frontends; verify student review; align payments contract; STORY-67.
- **Phase C (reliability):** update stale tests (D4/D5), e2e isolation, migration verification in CI, Postman coverage.
- **Phase D (perf/scale):** Redis-backed rate limit + refresh state, pooling, bounded CSV, background jobs.
- **Phase E (growth):** notifications, parent dashboard, payments/subscriptions, onboarding, analytics, retention.

## 41. Recommended Execution Order

| Order | Item | Why now | Severity | Effort | FE coord |
| --: | --- | --- | --- | --- | --- |
| 1 | D1 build fix | nothing ships otherwise | P1 | XS | no |
| 2 | D2 migrate + CI gate | results 500 in all envs | P1 | S | no |
| 3 | Re-verify D3 attempts.e2e | data correctness | P2 | S | no |
| 4 | Wire AI Tutor FE → `/tutor/*` | flagship feature dead in UI | P1(product) | S–M | yes |
| 5 | Wire engagement FE | completed backend unused | P2 | S | yes |
| 6 | Student review verify | core loop | P2 | S | yes |
| 7 | Logging + /ready + login throttle | prod ops/security | P2 | M | no |
| 8 | Payments contract align | monetization | P2 | M | yes |
| 9 | Stale tests + Postman | reliability | P3 | S | no |

## 42. Quick Wins

D1 (one line in the audit union), D6 (drop empty stub modules), D5 (timeout test), document undocumented additions, add `/ready`.

## 43. Do-Not-Rewrite List

Prisma singleton; auth architecture (hashed/rotated/revoked refresh cookies, `auth.cookies.ts`); RAG similarity search + `geminiClient`; quiz auto-grade + essay recalculation (`auto-grade.ts`); promo redeem; AI quota atomic claim/refund; engagement CTE; route aliases; CSV escaping. Extend, don't replace.

## 44. Release Readiness Checklist

- [ ] Build passes (D1) — **FAIL now**
- [ ] Migrations applied, no drift (D2) — **FAIL now**
- [ ] Unit + e2e green (or only documented pre-existing) — **FAIL now**
- [x] Auth/session secure
- [ ] Observability (logs/IDs/readiness) — partial
- [ ] Production cookie/CORS/scaling config — partial
- [ ] Core student/teacher journeys verified end-to-end (UI wired) — partial

## 45. Remaining Unknowns

Exact root cause of `attempts.e2e` concurrency failures (pre-existing vs D2 cascade); whether frontend results page already falls back to the GET; production deployment topology (same-site vs cross-site) for cookie policy; intended status of stub modules.

## 46. Final Conclusion

Fahimni is a strong, differentiated Arabic AI-tutoring/assessment product with a
genuinely capable backend and several best-in-class implementations. It is **not
release-ready today** purely due to two small, well-isolated blockers (a build
type error and an unapplied migration) plus frontend/backend wiring drift that
leaves two flagship features (AI Tutor, engagement) unreachable in the UI.
Fixing D1+D2, wiring the existing backends into the frontend, and adding
production observability would move it from "advanced prototype" to "launchable
MVP" with modest, mostly additive effort. Preserve the auth, RAG, grading, and
engagement implementations — they are the product's strengths.
```
