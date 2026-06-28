# STORY-68 — Teacher Essay Grading & Quiz Results API — Audit + Completion Report

## 1. Executive Summary

Discovery classified STORY-68 as **PARTIALLY IMPLEMENTED**: essay grading
(criteria 7–15, 24) already existed and is correct; the three results endpoints
(`/results`, `/results/ungraded`, `/results/export`), sorting, CSV export, and the
PATCH method were missing. I completed **only** the missing criteria by extending
the existing `attempts` layers — no new service/controller/DTO layers, no
duplication of grading/scoring logic. Build green; 14 new tests pass; the only
failing tests in the suite are **pre-existing and unrelated**.

Status: **Completed with warnings** (warnings = pre-existing failures + an
environment-recovery event, both detailed below).

## 2. Environment Recovery (unplanned)

At the start of the task the working tree had the **entire `backend/` directory,
the 3 STORY report `.md` files, `node_modules`, and `backend/.env` missing** — 268
pending git deletions. I did not cause this (discovery is read-only). Recovery:
- Verified the only pending changes were deletions (no modifications/untracked) → `git restore .` losslessly recovered all **tracked** files (everything was committed at `5337c57`).
- `node_modules` (gitignored) → reinstalled with `npm ci` from the restored lockfile.
- `backend/.env` (gitignored) → recreated from the tracked `.env.example` (local DB URLs + dev JWT secret + placeholders). **The original real secrets — notably the real `GEMINI_API_KEY` — are lost and must be restored by you.** STORY-68 does not use Gemini, so tests are unaffected.
- Docker postgres volume was never dropped → `prisma migrate status` = up to date (39 migrations).

## 3. Discovery Audit

`sprints.md` read for STORY-44 (1278), STORY-48 (1395), STORY-68 (2003).
`git log`/`git status` inspected. Searched route fragments + behavior across the
backend.

**Found (reused):**
- `POST /api/attempts/:attemptId/grade-essays` → `AttemptsController.gradeEssays` → `AttemptsService.gradeEssays` (ownership via `quiz.createdBy`, pending-essay targeting, max-points check, score recalculation via `finalizeOutcome`).
- `gradeEssaysSchema` (`attempts.validation.ts`): grades[]{questionId, awardedPoints≥0 finite, feedback?}, nonempty, duplicate-id refine, `.strict()`.
- `auto-grade.ts` `finalizeOutcome` — `score = Σ awardedPoints` (auto + essay, counted once).

**Missing:** `/results`, `/results/ungraded`, `/results/export`, sorting, CSV, PATCH method.

## 4. Acceptance-Criteria Matrix (post-implementation)

| # | Criterion | Result | Evidence |
|---|-----------|--------|----------|
| 1 | `GET /quizzes/:quizId/results` | PASS | quizzes.routes.ts → `getResults`; e2e |
| 2 | All attempts for owned quiz | PASS | `fetchResultRows` (COMPLETED+GRADED); e2e count=2 |
| 3 | Per-question breakdown | PASS | `breakdown` from stored answers; unit + e2e |
| 4 | `GET /quizzes/:quizId/results/ungraded` | PASS | route → `getUngradedResults`; e2e |
| 5 | Only ungraded-essay attempts | PASS | filter `status==="COMPLETED"` (⟺ pending essays); unit + e2e |
| 6 | `PATCH /attempts/:attemptId/grade-essays` | PASS | PATCH alias added (POST kept); e2e proves both route |
| 7 | Accepts array of grades | PASS | gradeEssaysSchema (pre-existing) |
| 8 | Rejects points > max | PASS | service `awardedPoints > q.points` (pre-existing) |
| 9 | Rejects negative/non-finite | PASS | schema `.finite().min(0)` (pre-existing) |
| 10 | Rejects questions outside quiz | PASS | `qMap` miss → 400 (pre-existing) |
| 11 | Rejects non-essay | PASS | `q.type !== "ESSAY"` → 400 (pre-existing) |
| 12 | Rejects duplicate ids | PASS | schema `.refine` + service size check (pre-existing) |
| 13 | Persists feedback | PASS | stored on result (pre-existing) |
| 14 | Recalculates score | PASS | `finalizeOutcome`; e2e (2→5 after grading) |
| 15 | No double-count auto points | PASS | single Σ awardedPoints (pre-existing) |
| 16 | Sort by score | PASS | `sortResults`; unit + e2e |
| 17 | Sort by student name | PASS | `sortResults` (localeCompare "ar"); unit + e2e |
| 18 | Deterministic default sort | PASS | score desc + name asc + attemptId tie-break; unit |
| 19 | `GET /quizzes/:quizId/results/export` | PASS | route → `exportResults`; e2e |
| 20 | Valid CSV | PASS | `buildResultsCsv` (BOM, quoting, injection guard); unit + e2e |
| 21 | Enforces teacher role | PASS | `authorizeMiddleware("OPERATION")`; e2e student→403 |
| 22 | Enforces quiz ownership | PASS | `assertQuizOwnership`; e2e other-teacher→403 |
| 23 | No other teacher's students | PASS | results scoped to owned quiz only; e2e 403 |
| 24 | Existing API/error conventions | PASS | okResponse/AppError/asyncHandler reused |

## 5. Changes Applied (minimal, reuse existing layers)

**Modified**
- `attempts.validation.ts` — `resultsQuerySchema` (sortBy: score|studentName, sortOrder: asc|desc).
- `attempts.service.ts` — `getQuizResults`, `getUngradedResults`, `buildResultsCsv` + private `assertQuizOwnership`, `fetchResultRows`, `sortResults`, `escapeCsv`. Reuses `finalizeOutcome`/`roundPercentage`; ownership mirrors the existing `gradeEssays` rule. `gradeEssays` itself untouched.
- `attempts.controller.ts` — `getResults` (validates query via `safeParse`), `getUngradedResults`, `exportResults`.
- `quizzes.routes.ts` — `GET /:quizId/results`, `/results/ungraded`, `/results/export` (OPERATION), reusing the already-imported `AttemptsController`. Registered before `/:id`.
- `attempts.routes.ts` — `PATCH /:attemptId/grade-essays` alias sharing the exact POST handler chain.

**Created (tests only)**
- `attempts.results.service.test.ts` (6) — ownership 404/403, breakdown, score-desc default + tie-break, name sort, ungraded filter, CSV (BOM/quote/injection).
- `quiz-results.e2e.test.ts` (8) — results + breakdown, name sort, invalid-sort 400, ungraded, PATCH grade recalc + ungraded empties, CSV export, ownership/role (403/404), PATCH+POST alias both reach handler (409).

**No new files created for** `quiz-results.service.ts` / `results.controller.ts` /
`grade-essay.dto.ts` — the suggested filenames were intentionally avoided per the
non-duplication rule; equivalent behavior lives in the existing attempts module.

## 6. Notable Decisions

- **POST kept + PATCH added** for grade-essays (AC says PATCH; POST is the existing tested contract) — non-breaking alias to the same handler.
- **Field name** stays `awardedPoints` (existing, tested) rather than the AC's `points`; behavior matches the AC. Documented deviation (not a defect).
- **Query validation in the controller** (`safeParse`), not `validateRequest(...,"query")`, because Express 5 exposes `req.query` as a read-only getter that the shared middleware cannot reassign — avoided a runtime crash without modifying shared middleware.
- **CSV**: one row per attempt; UTF-8 BOM (Arabic-friendly in Excel); RFC-style quoting; CSV/formula-injection guard (leading `= + - @` neutralized).
- **`ungraded`** uses `status === "COMPLETED"`, which by construction means pending essays (submit sets COMPLETED when not final, GRADED when final).

## 7. Verification

```
prisma validate / migrate status ... valid / up to date (39 migrations)
tsc --noEmit / npm run build ....... clean
vitest run (results unit) .......... 6 passed
vitest run (full unit/integration) . 293 passed, 1 PRE-EXISTING fail
vitest e2e (quiz-results.e2e) x2 ... 8 passed each
vitest e2e (full) .................. 47 passed; 2 PRE-EXISTING attempts.e2e fails
```

## 8. Pre-existing failures (not caused by STORY-68, not in scope)

- `quiz-generation.service.test.ts > calls Gemini with a 20s timeout configuration` — expects 20s; quiz-gen code default is 55s. Pre-dates STORY-63/64/65/68.
- `attempts.e2e.test.ts` 2 tests (duplicate-attempt `409` path) — proven independent (failed without my changes via stash in STORY-64). STORY-68 does not touch quiz-attempt creation.

No regression was introduced; existing AI tutor, quiz generation, submission, auto-grading, attempts, scoring, authorization, and APIs are unchanged.

## 9. Remaining Risks / Warnings

- The original `backend/.env` (real Gemini key etc.) was lost to the external deletion and recreated from the template — **restore your real secrets**.
- The two pre-existing failures above remain open (out of scope).
- CSV is a per-attempt summary (not per-question matrix) — the natural "results export" interpretation; can be extended if a per-question CSV is later required.

## 10. Final Status

**Completed with warnings.** All 24 acceptance criteria PASS; missing behavior was
implemented minimally over the existing architecture; grading/scoring/auth logic
reused unchanged; build + targeted/full suites green except documented
pre-existing failures.
