# Quiz Generation and Submission Postman E2E Report

## 1. Executive Summary

A self-populating Postman/Newman E2E collection was built for the full quiz
journey across STORY-45/47/48: generate by chapter, generate by lessons, assign,
publish, chapter quizzes, assigned quizzes, start attempt, partial + complete
submit, auto-grade, essay grading, and duplicate/authorization protections. All
runtime values (quiz IDs, attempt ID, question IDs, answer arrays, essay-grade
payloads) are captured by scripts — the user only imports the collection + the
populated local environment, selects it, and runs one folder.

The collection was executed with Newman. **Run 1 passed completely: 21 requests,
107 assertions, 0 failures.** A repeat run failed **only** because both live
Gemini generations exceeded the backend's 20-second generation cap (20.6s / 21.4s
→ 422) — a free-tier latency condition, not a logic defect. The database was
verified after the passing run: one PUBLISHED quiz, exactly one GRADED attempt,
no duplicates.

## 2. Latest Seed Used

- Command: `npm run db:seed` (Prisma `db seed` → `tsx prisma/seed.ts`), idempotent.
- Seed version: `secondary-general-v1` (Egyptian General Secondary Education).
- Accounts (no plaintext passwords here): `story45.teacher1@local.test` (OPERATION),
  `story45.student@local.test` (STUDENT, actively enrolled), `story45.teacher2@local.test` (OPERATION).
- Stage: «الصف الأول الثانوي». Chapter: «الرياضيات — الدوال الخطية» (owned by teacher1,
  RAG-indexed). Lessons: «مفهوم الدالة الخطية», «الميل والجزء المقطوع».
- Local password sourced from `SEED_LOCAL_PASSWORD` (git-ignored `.env`); written
  only into the git-ignored populated environment.

## 3. Environment Preparation

- Collection: `backend/postman/Fahimni_Quiz_Generation_Submission_E2E.postman_collection.json` (tracked)
- Template env: `backend/postman/Fahimni_Quiz_Generation_Submission.template.postman_environment.json` (tracked)
- Populated local env: `backend/postman/Fahimni_Quiz_Generation_Submission.local.postman_environment.json` (git-ignored)
- Prepare script: `backend/scripts/prepare-quiz-postman-e2e.ts` (`npm run postman:prepare:quiz-e2e`) —
  refuses non-local DB, verifies roles/enrollment/ownership/index-readiness, then writes the populated env.
- Git ignore result: `git check-ignore` confirms the populated env and manifest are
  ignored; the collection + template + script are tracked. No real key/password
  appears in any tracked file (the only matches are the collection's own
  leak-detection needle strings).

## 4. Authentication Strategy

Login sets an HttpOnly `access_token` cookie (no bearer token in the body).
Newman's cookie jar reuses it automatically. Because teacher and student share the
cookie name on localhost, the collection logs in immediately before each role's
block: Teacher (01) → Student (09) → Teacher again (17) before essay grading.
Scripts never read the HttpOnly cookie.

## 5. Generate by Chapter Result

201 Created, ~12s. 6 questions, all three persisted types (MCQ, TRUE_FALSE, ESSAY),
DRAFT, chapter matches, sortOrder sequential, totalPoints correct, options valid,
no duplicates, no AI-internals leak. `chapterGeneratedQuizId` captured.

## 6. Generate by Lesson IDs Result

201 Created, ~13.4s. 4 questions, only MCQ/TRUE_FALSE, DRAFT. `lessonGeneratedQuizId`
captured.

## 7. Assign and Publish Result

Assign → 200 (chapter matches). Publish → 200, status PUBLISHED, `publishedAt` set,
questionCount > 0. `publishedQuizId` captured.

## 8. Assigned Quiz Result

Chapter quizzes (08) → published quiz present, draft lesson quiz absent, no
`correctAnswer`. Student assigned (10) → published quiz present, draft absent, no
`correctAnswer`.

## 9. Start Attempt Result

201, status IN_PROGRESS, questions sorted by sortOrder, no `correctAnswer`.
`attemptId` captured; full and partial answer arrays built automatically from the
returned safe questions (MCQ → first option, TRUE_FALSE → «صح», ESSAY → fixed text).

## 10. Partial Submission Result

400 Bad Request — partial submission rejected, safe error, no stack trace.

## 11. Complete Submission and Auto-Grade Result

200, status COMPLETED, numeric score/totalPoints/percentage, results count equals
question count, each result correct/incorrect/pending, MCQ/TF not pending, ESSAY
pending with null awardedPoints, no `correctAnswer`. `pendingEssayQuestionIds` and
`essayGrades` built automatically.

## 12. Essay Grading Result

Student grading (16) → 403. Teacher grading (18) → 200, status GRADED,
pendingEssayCount 0, isFinal true, numeric final score/percentage, no pending
results, no `correctAnswer`.

## 13. Duplicate Protection Result

Duplicate submission (14) → 409 (not overwritten). Duplicate start (15) → 409
(no second attempt). Re-grade (19) → 409 (final score not overwritten).

## 14. Database Verification (after the passing run)

Read-only queries on the dev DB for Run 1's IDs:
- Published quiz `54395b9c-…`: status PUBLISHED, `publishedAt` set, chapter = f4500100. ✅
- Attempts for (student, quiz): **1** (no duplicate). ✅
- Attempt `097622c8-…`: status GRADED, completedAt set, score 2. ✅
- Answer result states: `correct, graded, incorrect`. ✅
- Total attempts for the student: 1. ✅
No data was modified during verification; no reset/drop/truncate occurred.

## 15. Newman Results

| Run | Requests | Assertions | Failed | Duration | Generation latency |
|---|---|---|---|---|---|
| Run 1 | 21 | 107 | **0** | 38.9s | chapter 12.0s, lessons 13.4s (both 201) |
| Run 2 | 21 | 107 | 33 | 55.3s | chapter 20.6s, lessons 21.4s (both 422 — exceeded 20s cap) |

Run 2's 33 failures are entirely downstream of the two 422 generations (Gemini
latency > 20s). The backend, collection scripts, and journey logic are correct —
proven by Run 1 (107/107) and by direct pre-checks (both generations 201 at ~12s).
The only non-determinism is Gemini free-tier response time.

## 16. Files Created or Modified

Created:
- `backend/postman/Fahimni_Quiz_Generation_Submission_E2E.postman_collection.json`
- `backend/postman/Fahimni_Quiz_Generation_Submission.template.postman_environment.json`
- `backend/postman/Fahimni_Quiz_Generation_Submission.local.postman_environment.json` (git-ignored, generated)
- `backend/scripts/prepare-quiz-postman-e2e.ts`
- `QUIZ_GENERATION_SUBMISSION_POSTMAN_REPORT.md` (this file)

Modified:
- `backend/package.json` (`postman:prepare:quiz-e2e` script)
- `backend/.gitignore` (track collection + templates; ignore populated env + manifest)
- `backend/postman/README.md` (run instructions)

No frontend/UI files changed; no backend route/logic changed; no test bypass added.

## 17. Remaining Requirements or Warnings

- **Gemini quota/latency warning:** live generation (requests 04/05) must complete
  within the backend's 20s cap (STORY-45 spec). On this free-tier key latency varies
  (~12s–21s); when it exceeds 20s the backend returns 422 and the run fails. Re-run
  when the key is responsive, or use a faster/paid key. The 20s cap and the spec'd
  question counts (6/4) were intentionally not changed.
- No student-facing attempt-detail endpoint exists; final GRADED state is asserted
  in request 18 and verified directly in the database (request 20 reads the quiz).
- A transient `embedContent` cold-start can return 500 on the first generation;
  warming or re-running resolves it.

## 18. Final Status

**Ready with Gemini quota warning** — the complete direct journey passed end-to-end
(Run 1: 107/107) and the database was verified, but live generation depends on the
Gemini free-tier responding within the 20s cap, which is intermittent.
