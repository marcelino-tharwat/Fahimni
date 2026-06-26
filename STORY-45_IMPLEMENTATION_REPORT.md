# STORY-45 Implementation Report

**Story:** AI Quiz Generation Endpoint — Sprint 3, 5 pts
**Endpoint:** `POST /api/quizzes/generate` (teacher-only, `OPERATION` role)

---

## 1. Architecture Found

- **Stack:** Node + **Express 5** (not NestJS), **Prisma 7** (Postgres + `@prisma/adapter-pg`),
  **pgvector**, **Zod 4**, **Vitest 3**. ESM with NodeNext `.js` import specifiers.
- **Routing:** `src/app.ts` mounts the quiz router at `/api/quizzes`. Routes are
  function handlers wrapped in `asyncHandler`, with `authenticateMiddleware` +
  `authorizeMiddleware("OPERATION")` + `validateRequest(zodSchema)` middleware.
- **Final route prefix:** `/api/quizzes` → route file uses `/generate` →
  **`POST /api/quizzes/generate`** (no `/api/api`, no version duplication).
- **Teacher identity:** `req.user.id` from the JWT; role string `OPERATION`.
  `teacherId` is never read from body/query/params.
- **Errors:** `AppError(message, statusCode)`; global `errorHandler` maps
  `AppError.statusCode` and Zod errors → 400. Envelope:
  `{ success, message }` (+ `errors` for Zod).
- **Response:** `okResponse(message, data)` → `{ success, message, data }`.
- **Ownership chain:** `Chapter → Stage.teacherId`,
  `Lesson → Chapter → Stage.teacherId`; soft-delete via `deletedAt`.

## 2. Dependency Verification

| Dependency | Status | Evidence / Notes |
|---|---|---|
| **STORY-42** Shared Gemini client | **Present & reused** | `src/shared/services/geminiClient.ts` (`generateContent`, `embedContent`, retries/backoff for 429 & 5xx, typed errors in `src/shared/errors/geminiErrors.ts`, safety-block handling, Arabic system instruction, timeout via `AbortController`). **Minimal compat change:** added an optional per-call `options.timeoutMs` so STORY-45 can cap the call at 20s (default stays 30s), plus `responseMimeType` in `GenerationConfig`. No client rewrite. |
| **STORY-43** RAG pipeline | **Present & reused** | `src/modules/ai/ai.service.ts` (`chunkText`, `embedAndStore`, `indexLesson`, `getStatus`, `similaritySearch`, pgvector cosine search, `content_chunks` table). **Minimal additions:** `similaritySearchInLessons(query, lessonIds, k)` (scoped multi-lesson search, single pgvector query) and `countChunksInLessons(lessonIds)` — both reuse the same table/embedding path; no duplicate store, no in-memory cosine. |
| **STORY-44** Quiz/Question model | **Present & reused** | `prisma/schema.prisma`: `Quiz` (id, title, description, chapterId?, status DRAFT/PUBLISHED, createdBy, timestamps, publishedAt), `Question` (id, quizId, type MCQ/TRUE_FALSE/ESSAY, text, options Json, correctAnswer?, sortOrder), `QuizAttempt`. Reused existing `quizPublicFields`/`questionPublicFields`. **Deviation:** schema has **no `points`/`totalPoints`/`questionCount` columns** — see §10. |

No dependency was absent; no duplicate Gemini client / RAG service / quiz model was created.

## 3. Endpoint Contract

`POST /api/quizzes/generate` — auth required, `OPERATION` only. Body accepts a
single content source (`chapterId` **xor** `lessonIds`) plus `questionCount`,
`types`, `difficulty`, optional `topicFocus`. Returns `201` with the persisted
draft quiz and all questions (DB-assigned IDs). Full contract in
[`backend/docs/api/quiz-generation.md`](backend/docs/api/quiz-generation.md).

## 4. Request Validation

Zod schema `generateQuizSchema` (`src/modules/quizzes/dto/generate-quiz.dto.ts`):
exactly one of `chapterId`/`lessonIds`; UUID checks; `lessonIds` non-empty/unique;
`questionCount` integer `1..20`; `types` non-empty/unique within `{MCQ,TF,ESSAY}`;
`difficulty ∈ {easy,medium,hard}`; `topicFocus` trimmed, non-blank, ≤200 chars;
`questionCount ≥ |unique types|`. Enforced by the existing `validateRequest`
middleware (Zod → 400).

## 5. Ownership and Authorization

- Route guarded by `authenticateMiddleware` (→401) + `authorizeMiddleware("OPERATION")` (→403).
- Teacher id taken from `req.user.id`; body `teacherId` is ignored (test-covered).
- `chapterId`: resolved with `stage.teacherId = teacher`, `deletedAt: null`;
  missing/unowned → 404.
- `lessonIds`: all must resolve under the teacher's ownership chain and be active;
  if `found.length !== requested.length` → 404 (no partial success).
- Cross-teacher content is unreachable because every query is scoped to the teacher.

## 6. RAG Retrieval Flow

1. Resolve content → owned, active `lessonIds` + safe titles + `chapterId`.
2. `countChunksInLessons` precondition (0 → `422 ContentNotIndexedError`).
3. Build a semantic query (prioritizes `topicFocus`, else chapter/lesson titles +
   difficulty/intent).
4. `similaritySearchInLessons(query, lessonIds, topK=8)` — scoped top-K, single query.
5. Prepare chunks: drop empties, de-dup exact, keep highest-ranked, bound to
   ~12k chars with multibyte-safe truncation. Empty → 422. No IDs/embeddings/metadata leak.

## 7. Prompt Design

Pure builder `src/modules/ai/gemini/prompts/quiz-generation.prompt.ts`. Arabic,
grounded, injection-resistant: use only supplied content; no external knowledge;
no invented/unsupported answers; treat source as data and ignore embedded
instructions; don't reveal prompt/metadata/chunk IDs; exact count; requested
types only; apply difficulty + topicFocus; avoid duplicates; **JSON only**.
Receives only safe text (no IDs/embeddings/secrets).

## 8. Gemini Configuration

Calls the shared `geminiClient.generateContent(prompt, config, { timeoutMs })`:
`temperature: 0.3`, `responseMimeType: "application/json"`, `maxOutputTokens: 8192`,
**timeout 20s**. Provider failures mapped: `ContentBlocked → GeminiSafetyBlockedError (422)`,
`Timeout → QuizGenerationTimeoutError (422)`, `RateLimit/Network → QuizGenerationError (422)`,
auth/unknown → bubble (500). Retry/backoff remain the shared client's responsibility
(no second retry loop, no second client).

## 9. Parsing and Validation

`src/modules/quizzes/quiz-generation.parser.ts` (uses `JSON.parse`, never `eval`):
supports plain JSON, ```json / generic ``` fences, and one JSON object inside
surrounding prose. Validates: top-level object; questions array; **exact count**;
allowed + all-requested types only; non-empty content; MCQ (≥2 distinct options,
correctAnswer ∈ options); TF (centralized AR/EN answer normalization →
`["صح","خطأ"]`); ESSAY (options/correctAnswer → null); positive-integer points;
duplicate content rejected via count check; sequential `sortOrder`. Failure →
`QuizGenerationParseError (422)`; raw model output is never surfaced.
Type mapping is centralized in `quiz-generation.mapping.ts`
(`MCQ→MCQ`, `TF→TRUE_FALSE`, `ESSAY→ESSAY`; unknown throws).

## 10. Persistence Transaction

Single `prisma.$transaction`: create `Quiz` (`status` defaults `DRAFT`,
`createdBy = teacher`, `chapterId` per §6) then `question.createMany`, then re-read
questions ordered by `sortOrder` for DB IDs. All-or-nothing; nothing persisted on
any earlier failure or after the deadline. Audit log `QUIZ_GENERATED` recorded
post-commit.

**`points`/`totalPoints` note:** the STORY-44 schema has **no** `points` column on
`Question` and no `totalPoints`/`questionCount` columns on `Quiz`. To avoid an
out-of-scope destructive/extra migration, points are **not persisted**; the
response derives `points: 1` per question and `totalPoints`/`questionCount` from
the generated set. Documented in the API doc. `ESSAY` options persist as `[]`
(the schema's `options` is non-nullable `Json`), `correctAnswer` as `null`.

## 11. Timeout Handling

One deadline strategy: total budget **25s** via `Promise.race` against a timer +
an explicit deadline check before persistence; Gemini call capped at **20s** via
the client's `AbortController`. The work promise gets a no-op `catch` so a late
rejection isn't unhandled; the timer is cleared in `finally`. A late Gemini
resolution can never reach `persist` (deadline guard). Timeouts return
`422` (never 500) with a retry suggestion. All covered by fast unit tests
(no real 20–25s waits).

## 12. Error Mapping

New typed errors (`quiz-generation.errors.ts`) all extend `AppError(…, 422)` and
carry safe `reason`/`details`/`suggestion`: `QuizGenerationError`,
`ContentNotIndexedError`, `QuizGenerationParseError`, `QuizGenerationTimeoutError`,
`GeminiSafetyBlockedError`. The global `errorHandler` was extended **additively**
to surface `reason`/`details`/`suggestion` only when present and to include
`statusCode` — other errors are unaffected. Validation/authn/authz/not-found keep
their 400/401/403/404 codes; only unexpected failures are 500.

## 13. Files Created and Modified

**Created**
- `src/modules/quizzes/dto/generate-quiz.dto.ts`
- `src/modules/quizzes/quiz-generation.mapping.ts`
- `src/modules/quizzes/quiz-generation.errors.ts`
- `src/modules/quizzes/quiz-generation.parser.ts`
- `src/modules/quizzes/quiz-generation.service.ts`
- `src/modules/ai/gemini/prompts/quiz-generation.prompt.ts`
- Tests: `dto/generate-quiz.validation.test.ts`, `quiz-generation.mapping.test.ts`,
  `quiz-generation.parser.test.ts`, `quiz-generation.service.test.ts`,
  `quizzes.generate.controller.test.ts`, `ai/gemini/prompts/quiz-generation.prompt.test.ts`
- `backend/docs/api/quiz-generation.md`
- `STORY-45_IMPLEMENTATION_REPORT.md` (this file)

**Modified (minimal, additive)**
- `src/shared/services/geminiClient.ts` — optional per-call `timeoutMs`
- `src/shared/types/gemini.types.ts` — `GenerateContentOptions`, `responseMimeType`
- `src/modules/ai/ai.service.ts` — `similaritySearchInLessons`, `countChunksInLessons`
- `src/modules/quizzes/quizzes.controller.ts` — `generate` handler
- `src/modules/quizzes/quizzes.routes.ts` — `POST /generate` route
- `src/shared/middlewares/errorHandler.middleware.ts` — safe `reason/details/suggestion` + `statusCode`
- `src/shared/services/auditLog.service.ts` — `QUIZ_GENERATED` action
- `backend/.env.example` — clarifying Gemini/timeout comments

No frontend/UI, schema, or unrelated module changes. No migration was required.

## 14. Tests Added

82 new tests across 6 files: validation (19), mapping (8), prompt (13),
parser (19), service incl. timeouts/ownership/persistence/no-persist-on-failure (18),
controller + route registration + 422 envelope (5). External boundaries (Gemini,
RAG, Prisma transaction, timers) are mocked; the real Gemini API is never called.

## 15. Documentation Added

- API reference: `backend/docs/api/quiz-generation.md` (URL, method, auth/role,
  headers, body/validation, type mapping, RAG/indexing prerequisite, timeouts,
  success + all error examples with retry suggestion, cURL, draft-visibility notes).
- This report.

## 16. Commands Executed and Results

| Command | Result |
|---|---|
| `npx prisma generate` | OK (regenerated stale client) |
| `npx prisma validate` | Schema valid |
| `npx tsc --noEmit` (typecheck) | **0 errors** |
| `npm run build` (`tsc`) | **Success (exit 0)** |
| `npx vitest run` (full) | **115 passed, 1 failed (116)** |
| Focused STORY-45 tests | **82/82 passed** |

The single failing test — `geminiClient.test.ts › throws GeminiRateLimitError on
HTTP 429` — was verified to **fail identically on the clean `develop` baseline**
(before any STORY-45 change) by stashing my edits and re-running. It is a
pre-existing STORY-42 test/retry mismatch (the test queues one 429 response while
the client retries 429), unrelated to and not blocking STORY-45. Left untouched
per the "do not rewrite STORY-42" rule.

## 17. Manual Verification

Behavioral guarantees verified via automated tests (live Gemini not called):
draft creation with persisted question IDs and sequential sortOrder; correct
`chapterId` for single-chapter selections and `null` for mixed chapters; 422 +
no persistence for missing chunks / Gemini failure / parse failure / timeout;
late Gemini resolution does not persist; Gemini invoked with a 20s timeout; RAG
scoped to resolved lessons; teacher-scoped ownership (404 on unowned, whole-request
failure on any bad lesson); client cannot override teacher identity; safe 422
envelope without raw model output; `getChapterQuizzes` already filters to
`PUBLISHED`, so drafts stay hidden from students.

## 18. Remaining Risks or Blockers

- **No live Gemini run:** verification is mock-based; a real key is required for an
  end-to-end live call (not performed).
- **Pre-existing 429 test failure** in `geminiClient.test.ts` (STORY-42) — see §16.
- **`points`/`totalPoints` not persisted** (no schema columns) — derived in the
  response; if product later requires persistence, a non-destructive migration is needed.
- **Embedding dimension:** `content_chunks.embedding` is `vector(3072)`; ensure the
  configured embedding model matches the indexed dimension (pre-existing concern;
  STORY-45 reuses the existing RAG path unchanged).
