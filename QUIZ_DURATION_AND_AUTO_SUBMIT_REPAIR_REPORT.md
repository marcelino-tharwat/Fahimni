# Fahimni Quiz Duration and Auto-Submit Repair Report

## 1. Executive Summary

Repaired the quiz duration contract and automatic submission flow end-to-end. The backend is now authoritative for attempt deadlines (`startedAt`, `durationMinutesSnapshot`, `expiresAt`, `serverTime`). Student answers persist as server-side drafts while in progress. Timeout finalization reuses the same grading path as manual submit, is idempotent, and no longer surfaces as a generic frontend error. The frontend timer derives from `expiresAt` + `serverTime` with no hardcoded 30-minute fallback.

**Status: COMPLETED WITH WARNINGS**

## 2. Initial Git State

- **Branch:** `feature/story-69-persistent-ai-chat-seed-fix-solve-some-errors`
- **Working tree:** Dirty with quiz repair changes plus prior AI tutor / auth work
- **Staged:** None for this repair
- **Pre-existing failures:** Frontend `tsc -b` has unrelated teacher/profile type errors; frontend auth logout tests pre-existing

## 3. Reproduced Fixed 30-Minute Failure

- `QuizPage.tsx` initialized `timerSeconds` to `1800` and computed `(data.durationMinutes ?? 30) * 60`
- `quiz.ts` `mapMetaFromAttempt` used `durationMinutes ?? 30`
- `QuizHeaderCard.tsx` displayed `meta.durationMinutes ?? 30`
- Start-attempt API returned `quiz.durationMinutes` (nullable) without attempt snapshot timing

## 4. Reproduced Timeout Submission Failure

- Auto-submit called `submitAttempt` with fabricated answers for all questions
- Backend required every question answered exactly once; partial/blank handling was fragile
- No server-side draft persistence — answers only in React state
- On failure, `QuizPage` caught and showed `t('common:error')` → "حدث خطأ"
- Timer used decrementing `setInterval` (drift, refresh inconsistency)

## 5. Root Causes

| Issue | Root cause |
|-------|------------|
| Fixed 30:00 | Frontend `?? 30` and `useState(1800)` overrides |
| Timeout error | Strict submit validation + no draft persistence + generic catch |
| Refresh timer reset | Client-side elapsed calculation without immutable `expiresAt` |
| No authoritative deadline | `QuizAttempt` lacked `expiresAt` / duration snapshot |

## 6. Existing Quiz Duration Contract

- **DB field:** `quizzes.duration_minutes` (`Quiz.durationMinutes Int?`)
- **Unit:** Minutes (integer)
- **Validation:** `quizzes.validation.ts` — optional on create, min 1 when provided

## 7. Canonical Duration Contract

- **Public field:** `durationMinutes` (minutes, integer)
- **Attempt snapshot:** `durationMinutesSnapshot` frozen at start
- **Deadline:** `expiresAt = startedAt + durationMinutesSnapshot` (UTC)
- **Clock sync:** `serverTime` in start/resume response
- Quizzes without configured duration return `400 QUIZ_DURATION_NOT_CONFIGURED` at attempt start (no silent 30-minute default)

## 8. Teacher Duration Create/Update Flow

Unchanged: teacher sets `durationMinutes` via quiz create/update → Prisma `duration_minutes` → returned in quiz APIs → snapshotted on attempt start.

## 9. Attempt Timing Architecture

`POST /api/quizzes/:id/attempt` returns:

```json
{
  "attemptId": "...",
  "durationMinutes": 20,
  "startedAt": "...",
  "expiresAt": "...",
  "serverTime": "...",
  "savedAnswers": [],
  "lastSavedAt": null
}
```

Resume of `IN_PROGRESS` attempt returns same `startedAt` / `expiresAt` (immutable).

## 10. Duration Snapshot

`durationMinutesSnapshot` stored on `QuizAttempt` at creation; not recalculated if quiz duration is edited later.

## 11. Authoritative Deadline

`expiresAt` set once at attempt start; backfilled for legacy in-progress attempts from quiz duration.

## 12. Database Migration

1. `20260701143000_add_quiz_attempt_timing` — additive columns + backfill
2. `20260701152000_fix_submission_reason_enum` — `AttemptSubmissionReason` enum column

## 13. Existing Attempt Backfill

```sql
UPDATE quiz_attempts SET duration_minutes_snapshot, expires_at
FROM quizzes WHERE IN_PROGRESS AND expires_at IS NULL
```

## 14. Draft Answer Persistence

- **Endpoint:** `PATCH /api/attempts/:attemptId/answers`
- **Storage:** `answers` JSON `{ kind: "draft", items: [...] }` while `IN_PROGRESS`
- **Helpers:** `attempt-draft.ts`

## 15. Manual Submission

Unchanged UX; uses `finalizeInProgressAttempt` with `submissionReason: MANUAL` and full answer validation.

## 16. Timeout Finalization

Single `finalizeInProgressAttempt` path:
- Merges draft + optional submit payload
- Allows partial answers on timeout
- Sets `submissionReason: TIME_EXPIRED`
- Idempotent via conditional `updateMany`

## 17. Lazy Expiration

`GET /api/attempts/:attemptId` and `startAttempt` on expired in-progress attempts call finalize, then return results.

## 18. Idempotency and Concurrency

- Duplicate submit → `200` with existing results
- Concurrent submit → one graded row (`updateMany` guard)
- Re-fetch after lazy finalize fixes stale answers bug

## 19. Frontend Timer Implementation

- **Hook:** `useQuizAttemptTimer.ts`
- Derives remaining seconds from `expiresAt` and `serverTime` offset
- Resyncs on `visibilitychange` / `focus`
- `formatTimerDisplay` supports `HH:MM:SS` for durations > 60 minutes

## 20. Server Clock Synchronization

`serverOffsetMs = parse(serverTime) - Date.now()` applied on each tick.

## 21. Refresh and Navigation Behavior

Start-attempt resume returns same deadline; timer recalculates from `expiresAt`; saved drafts restored from `savedAnswers`.

## 22. Automatic Submission UI

- Locks inputs at expiry
- Shows `quiz:autoSubmitting` / `quiz:autoSubmitRetry`
- Flushes draft before finalize
- Handles `409` / already-finalized by fetching results (no generic error)

## 23. Network Failure Recovery

Timeout path retries with 3s backoff; inputs stay locked; server drafts preserved.

## 24. Authorization and Security

Unchanged ownership checks; draft save and submit require `STUDENT` + enrollment; no answer content in logs.

## 25. Structured Logging

Events: `quiz_attempt_started`, `quiz_answer_draft_saved`, `quiz_timer_expired`, `quiz_auto_submit_started/completed`, `quiz_manual_submit_completed`, `quiz_attempt_finalized`, `quiz_attempt_already_finalized`.

## 26. Backend Unit Tests

- `attempt-timing.test.ts` (5)
- `attempt-draft.test.ts` (2)
- `attempts.validation.test.ts` updated (16)
- All quiz module unit tests: **121 passed**

## 27. Backend E2E Tests

- `quiz-timing.e2e.test.ts` (5) — **all passed**
- `attempts.e2e.test.ts` (5) — **all passed** after idempotent submit expectation update

## 28. Frontend Tests

- `useQuizAttemptTimer.test.ts` (7) — **all passed**

## 29. Full E2E Scenarios

Covered in `quiz-timing.e2e.test.ts`: custom durations 5/20/45, resume same deadline, draft + timeout finalize, reject draft after expiry, lazy GET finalize.

## 30. Visual and Accessibility Review

Timer uses tabular nums; warning state < 5 minutes; auto-submit label in topbar; inputs disabled after expiry. Full manual RTL/mobile pass not re-run in this session.

## 31. Full Non-Regression

| Check | Result |
|-------|--------|
| Prisma validation | OK (generate) |
| Migration status | Applied (dev + test DB) |
| Backend typecheck | Pass |
| Backend build | Pass |
| Backend quiz unit | 121 pass |
| Quiz timing E2E | 5/5 pass |
| Attempts E2E | 5/5 pass |
| Frontend timer tests | 7/7 pass |
| Frontend lint | Pre-existing Design System errors |
| Frontend tsc -b | Pre-existing unrelated errors |

## 32. Files Created

- `backend/src/modules/quizzes/attempt-timing.ts`
- `backend/src/modules/quizzes/attempt-draft.ts`
- `backend/src/modules/quizzes/attempt-timing.test.ts`
- `backend/src/modules/quizzes/attempt-draft.test.ts`
- `backend/src/modules/quizzes/quiz-timing.e2e.test.ts`
- `backend/prisma/migrations/20260701143000_add_quiz_attempt_timing/`
- `backend/prisma/migrations/20260701152000_fix_submission_reason_enum/`
- `Frontend/src/features/student/hooks/useQuizAttemptTimer.ts`
- `Frontend/src/features/student/hooks/useQuizAttemptTimer.test.ts`

## 33. Files Modified

- `backend/prisma/schema.prisma`
- `backend/src/modules/quizzes/attempts.service.ts`
- `backend/src/modules/quizzes/attempts.controller.ts`
- `backend/src/modules/quizzes/attempts.routes.ts`
- `backend/src/modules/quizzes/attempts.validation.ts`
- `backend/src/modules/quizzes/attempts.validation.test.ts`
- `backend/src/modules/quizzes/attempts.e2e.test.ts`
- `Frontend/src/features/student/pages/QuizPage.tsx`
- `Frontend/src/features/student/api/quiz.ts`
- `Frontend/src/features/student/components/quiz/*.tsx`
- `Frontend/src/shared/lib/i18n/*/quiz.json`

## 34. Remaining Warnings

1. Apply migrations on all deployment environments (`prisma migrate deploy`)
2. E2E test DB (`TEST_DATABASE_URL`) must receive migrations before CI E2E
3. Quizzes without `durationMinutes` cannot be started (by design)
4. Frontend full `tsc -b` / lint still have pre-existing unrelated failures
5. Dev DB migration required separate from test DB in local setup

## 35. Final Status

**COMPLETED WITH WARNINGS**
