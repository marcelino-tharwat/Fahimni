# STORY-63 AI Tutor Service Implementation Report

## 1. Executive Summary

Implemented `AiTutorService.ask(question, studentId)` — a RAG-grounded Q&A service
that embeds a student's question, runs an **enrollment-scoped** pgvector
similarity search over the teacher content the student may access, builds a
grounded, prompt-injection-resistant tutor prompt, calls Gemini once, strictly
parses a `{answer, citationRefs}` response, and returns lesson citations mapped
**only from trusted database metadata**.

The work is preservation-first and minimal-diff. It **reuses** the existing
Gemini client, embedding service, RAG similarity search, Prisma client, timeout
pattern, error classes, and the enrollment access rule. No second client,
service, Prisma instance, or RAG pipeline was created. STORY-42 and STORY-43 were
not rebuilt. The only change to shared code is a tiny, backward-compatible
extension to the Gemini client (an optional per-call `systemInstruction`,
default unchanged). No frontend, no migrations, no DB resets, no secrets, no
commit/push.

Status: **Completed** (one *pre-existing, unrelated* baseline test failure
remains, documented below).

## 2. Baseline Health

- Branch: `fix/quiz-question-reorder-conflict`, working tree clean at start (ahead of origin by 7 commits).
- PostgreSQL: database `final_project`, reachable at `localhost:15432`.
- pgvector: extension `vector` **0.8.3** installed.
- Embedding dimension: `content_chunks.embedding` is `vector(3072)`, matching the configured `GEMINI_EMBEDDING_MODEL=gemini-embedding-2` (3072-dim). Not modified.
- `npx prisma validate`: schema valid.
- `npx prisma migrate status`: 37 migrations found, **database schema up to date**.
- `npx tsc --noEmit`: clean.
- Full suite baseline: **200 tests, 199 passed, 1 failed**.
  - Pre-existing failure: `quiz-generation.service.test.ts > calls Gemini with a 20s timeout configuration` — the test expects `timeoutMs: 20_000` but the quiz-gen code default is `DEFAULT_GEMINI_TIMEOUT_MS = 55_000`. This predates STORY-63 (clean tree), is unrelated to the tutor, and was intentionally **not** modified (out of scope; "do not change unrelated tests just to make them pass").

## 3. Dependency Audit

`sprints.md` inspected at repo root: `c:/Users/kerol/Downloads/Fahimni/sprints.md`.
Read in full: STORY-42 (lines 1217–1243), STORY-43 (1247–1274), STORY-45
(1306–1331), STORY-63 (1860–1885), STORY-64 (1889–1914).

Key cross-check: STORY-63 is a **service** story; the HTTP endpoint `POST
/tutor/ask` (with 10–500 char validation, 401-if-not-enrolled, daily limit) is a
**separate** story, STORY-64, which depends on STORY-63. Therefore **no
controller/route was added** here.

Note: `sprints.md` describes a planned NestJS-style layout (`gemini-client.ts`,
`rag/similarity-search.service.ts`, `vector(768)`, `text-embedding-004`). The
**actual** repository differs and is the source of truth: a singleton-export
Express architecture, embeddings at `vector(3072)` via `gemini-embedding-2`, and
RAG implemented inside `AiService`. Implementation followed the actual code.

### Reused from STORY-42 (Gemini client)
- `geminiClient.embedContent(text)` (used transitively via the RAG search).
- `geminiClient.generateContent(prompt, config, options)` with per-call `timeoutMs`.
- Gemini error classes: `GeminiAuthError`, `GeminiRateLimitError`, `GeminiContentBlockedError`, `GeminiTimeoutError`, `GeminiNetworkError`.
- Retry/backoff, rate-limit queue, safety-block handling — unchanged.

### Reused from STORY-43 (RAG pipeline)
- `content_chunks` table (`vector(3072)`, `lessonId` FK, cosine via `<=>`).
- `aiService.similaritySearchInLessons(query, lessonIds, k)` — embeds the question once and runs the access-scoped cosine top-K query. **This is the similarity-search service STORY-63 reuses; no duplicate was created.**
- Score convention `1 - (embedding <=> query)` (cosine similarity; higher = more relevant) and `ORDER BY embedding <=> query` (most similar first).

### Missing specifically for STORY-63 (built here)
- A tutor service orchestrating: validation → student-access scoping → reuse RAG → no-chunks not-found → grounded prompt → Gemini → strict parse → trusted citation mapping, under tutor-specific budgets (15s/10s/25s).
- A grounded, bilingual, injection-resistant tutor prompt + system instruction.
- A strict `{answer, citationRefs}` parser.
- Tutor error classes.
- An optional per-call `systemInstruction` on the Gemini client so the tutor can answer in the question's language and carry system-level grounding rules (the client's default was hard-coded to Arabic).

### Dependency gaps
None blocking. STORY-42/43 are complete and sufficient. The single dependency
correction was the additive `systemInstruction` option (see §5), guarded by a
regression test.

## 4. Existing Architecture Reused

| Concern | Existing implementation | Reused as-is? |
| --- | --- | --- |
| Gemini client | `src/shared/services/geminiClient.ts` (singleton `geminiClient`) | Yes (one additive optional param) |
| Embedding | `geminiClient.embedContent` (via RAG search) | Yes |
| Similarity search | `aiService.similaritySearchInLessons` | Yes |
| Prisma client | `src/config/database.ts` (`prisma`) | Yes |
| Timeout pattern | `Promise.race` + `setTimeout` + `assertDeadline` (from quiz-generation.service) | Yes (same pattern) |
| Error base | `AppError` (`src/shared/utils/AppError.ts`) | Yes (extended) |
| Access control | `enrollment { studentId, status: "ACTIVE" }` join (attempts.service) | Yes |
| Logging | `logger` (`src/config/logger.ts`) | Yes |

## 5. Minimal Changes Applied

### `src/shared/types/gemini.types.ts` (modified)
- Existing: `GenerateContentOptions { timeoutMs?: number }`.
- Missing for STORY-63: a way to answer in the user's language / carry tutor system rules without touching every caller.
- Smallest change: added optional `systemInstruction?: string`.
- Why no rewrite: purely additive optional field.

### `src/shared/services/geminiClient.ts` (modified)
- Existing: `_buildGenerateRequestBody(prompt, config)` hard-codes the Arabic system instruction.
- Smallest change: `generateContent` now forwards `options?.systemInstruction`; `_buildGenerateRequestBody` uses it **only when provided**, otherwise keeps the exact previous default string.
- Why no rewrite: default behavior is byte-for-byte unchanged for all existing callers (quiz generation, etc.). Guarded by the existing test "sends the system instruction instructing Arabic responses" plus a new test for the override.

### New files (no duplication of existing services)
- `src/modules/ai/gemini/prompts/tutor-prompt.ts` — system instruction + user prompt + not-found constants + language detection.
- `src/modules/ai/tutor/ai-tutor.service.ts` — `AiTutorService` + `aiTutorService` singleton.
- `src/modules/ai/tutor/ai-tutor.parser.ts` — strict `{answer, citationRefs}` parsing.
- `src/modules/ai/tutor/ai-tutor.errors.ts` — tutor error classes (extend `AppError`).

### `tutor.module.ts` — intentionally NOT created
The repository has **no** `*.module.ts` files; services are wired via singleton
exports (e.g. `export const aiService`). A module file would be decorative and
violate the "no decorative module files" rule. The tutor follows the existing
convention with `export const aiTutorService`.

## 6. Student Content-Access Scope

Accessible lessons are resolved in one bounded Prisma query:

```
lesson.deletedAt = null
  AND chapter.deletedAt = null
  AND chapter.stage.deletedAt = null
  AND chapter.enrollments has some { studentId, status = "ACTIVE" }
```

The similarity search is then scoped to exactly those lesson IDs
(`similaritySearchInLessons(question, accessibleLessonIds, 5)`). A defensive
second check drops any returned chunk whose `lessonId` is not in the accessible
set. This prevents cross-student, cross-teacher, unenrolled-chapter, and
deleted-content leakage. `studentId` is taken as a service argument (the future
STORY-64 controller must pass the authenticated id, never client-supplied data).
No existing access rule was broadened.

## 7. Question Embedding

Performed by the reused `aiService.similaritySearchInLessons`, which calls
`geminiClient.embedContent` **once** per ask using the configured production
embedding model (3072-dim, matching the column). No second embedding path, no
mock/random vectors, no model/dimension change. Raw embeddings and full question
text are never logged (only question length and durations).

## 8. Similarity Search

Reuses `aiService.similaritySearchInLessons` (no duplicate). Top **K = 5**,
access-scoped by lesson IDs, ordered by cosine similarity descending. Each
retrieved chunk becomes a controlled source (`SOURCE_1..5`) carrying the trusted
lesson title + chapter name (from the access query) and the normalized score.
No threshold is applied (none exists in STORY-43); grounding is enforced via the
prompt, and the no-rows path is covered by tests.

## 9. Tutor Prompt

`buildTutorSystemInstruction(language)` + `buildTutorPrompt({question, sources})`.
Rules enforced: answer ONLY from SOURCE blocks; no world knowledge; never invent
facts/lessons/citations; return the exact localized not-found text when context
is insufficient; cite only controlled `SOURCE_n` keys; answer in the question's
language (MSA quality rules for Arabic); strict JSON output
`{"answer": string, "citationRefs": string[]}`. Each source's content is bounded
(default 1500 chars) to keep prompt size predictable.

## 10. Gemini Generation

Reuses `geminiClient.generateContent` with `temperature: 0.2` (low, to reduce
hallucination), `responseMimeType: "application/json"`, `maxOutputTokens: 2048`,
and per-call `{ timeoutMs: 10_000, systemInstruction }`. One independent request
per `ask`; no chat/session API; no history. Provider failures are mapped to safe
tutor errors (see §15). The global generation default (60s) is unchanged, so
other callers (quiz generation) are unaffected.

## 11. Citation Parsing and Mapping

`parseTutorResponse` strips Markdown fences, `JSON.parse`s, requires a non-empty
string `answer` (bounded), and normalizes `citationRefs` to deduplicated
`SOURCE_n` tokens (anything else ignored). The service then maps each ref to its
source and emits citations using **trusted DB metadata only**
(`{lessonId, lessonTitle, chapterName, relevanceScore}`). Citations are
deduplicated by lesson (highest score kept), ordered by first reference, and
unknown refs / refs outside the top-K are ignored. Chunk text is never exposed.
If the model returns no refs, no citations are returned (citations are not
blindly populated).

## 12. Not-Found Behavior

When there are no accessible relevant chunks (no enrollments, or empty search),
the service returns the localized not-found **without calling Gemini and without
embedding**, with `citations: []`. Language is derived from the question text
(`detectQuestionLanguage`) because STORY-63's signature has no locale argument.

- Arabic: `لم أجد إجابة في المحتوى المتاح`
- English: `I couldn't find an answer in the available content`

## 13. Session-Scoped Behavior

No conversation memory, no chat session, no per-student cache, no module-level
mutable state. The service holds only readonly config. Each prompt contains only
the current question + freshly retrieved sources. A unit test proves the second
ask sees neither the first question nor the first answer.

## 14. Timeout Enforcement

- Retrieval (embed + access query + vector search + mapping): hard **15s** via `Promise.race`.
- Generation: hard **10s** via the client's per-call `timeoutMs`.
- Total `ask`: hard **25s** via `Promise.race`, with `assertDeadline` guards before and after generation.

The no-chunks path returns immediately. Losing-race promises get a no-op
`.catch` so they never become unhandled, and all timers are cleared in `finally`.
Both the retrieval-timeout and total-timeout paths are covered by tests.

## 15. Error Handling

All via `AppError` subclasses with safe messages and a `reason` category:
- `TutorValidationError` (400, `QUESTION_INVALID`) — empty/whitespace/too-long question or invalid studentId.
- `TutorTimeoutError` (504, `TUTOR_TIMEOUT`) — retrieval/generation/total budget, and mapped Gemini timeout.
- `TutorSafetyBlockedError` (422, `SAFETY_BLOCKED`) — Gemini content block.
- `TutorUnavailableError` (503, `TUTOR_UNAVAILABLE`) — rate limit / network-5xx / malformed model output.

"No accessible content" is **not** an error (successful not-found). Infrastructure
failures are errors and are not converted to not-found. No raw Prisma/SQL/vector/
API-key/provider payloads/stack traces are exposed.

## 16. Security and Prompt-Injection Review

The system instruction explicitly frames the QUESTION and SOURCE text as
untrusted data, tells the model to ignore embedded instructions (e.g. "ignore
previous instructions"), never reveal system rules, and only cite controlled
keys. The server never trusts model-generated lesson IDs/titles — citations are
mapped from trusted DB rows. Access scoping (§6) blocks cross-tenant leakage.
Tests cover an injection-laden question and a model attempting to smuggle a fake
lesson id/title as a citation.

## 17. Unit Tests

47 new tests, all passing:
- `ai-tutor.service.test.ts` — 27 (input validation, retrieval/top-K/access scope, not-found-no-Gemini, retrieval & total timeouts, Gemini once + 10s + system instruction, prompt content, error mapping, citation dedup/trust/unknown-ref, session isolation, injection).
- `tutor-prompt.test.ts` — 11 (language detection, grounding, exact not-found, MSA quality, JSON contract, injection framing, source keys, bounded content, no prior conversation).
- `ai-tutor.parser.test.ts` — 8 (valid, fenced, missing refs, normalization/dedup, malformed, non-object, empty answer, bounded length).
- `geminiClient.test.ts` — +1 (system-instruction override; default path still covered by the existing Arabic-instruction test).

## 18. PostgreSQL Integration Test

`ai-tutor.e2e.test.ts` (6 tests, passing) against the isolated
`TEST_DATABASE_URL` using **real Prisma + real pgvector + real
`similaritySearchInLessons`**; only the Gemini boundary is mocked (query
embedding spy + injected answer). Dynamically created fixtures: Teacher1/2,
Student1/2, two stages/chapters, accessible lesson (Student1) + inaccessible
teacher2 lesson, duplicate chunks in one lesson, known 3072-dim embeddings.
Verifies: accessible content returned with correct trusted metadata; inaccessible
teacher content excluded even when more similar; per-student scoping; not-found
(no Gemini, no embed) for a user with no enrollments; descending relevance order
and K≤5; and that `ask` mutates no rows. Cleanup deletes only test-owned rows
(no reset/truncate).

## 19. Real Gemini Smoke Test

Not run as part of the deterministic suite (no opt-in real-Gemini harness exists
for the tutor, and the suite must not depend on external quota). The
focused + integration tests fully exercise the logic with the Gemini boundary
mocked. No production fallback or dummy content was added.

## 20. Non-Regression Results

- Full suite after changes: **247 tests, 246 passed, 1 failed**.
- The single failure is the **identical pre-existing** `quiz-generation.service.test.ts > calls Gemini with a 20s timeout configuration` (unchanged by this work). 200→247 = the 47 new tests, all green.
- Verified unchanged: STORY-42 Gemini retry/timeout classification (geminiClient tests pass; default system instruction preserved), STORY-43 indexing/retrieval, STORY-45 quiz generation (its service/parser/mapping/controller tests pass), embedding dimension, content visibility.

## 21. Commands and Results

```
git status / git diff --stat .............. clean baseline; final diff = 3 shared files + new tutor files
npx prisma validate ....................... valid
npx prisma migrate status ................. 37 migrations, up to date
pg / pgvector / dim ....................... final_project, vector 0.8.3, embedding vector(3072)
npx tsc --noEmit .......................... exit 0
npm run build (tsc) ....................... exit 0
npx vitest run (focused tutor + gemini) ... 70 passed
npx vitest run --config vitest.e2e ... (tutor e2e) 6 passed
npx vitest run (full) ..................... 246 passed, 1 pre-existing failure
```

## 22. Files Created

- `src/modules/ai/tutor/ai-tutor.service.ts`
- `src/modules/ai/tutor/ai-tutor.parser.ts`
- `src/modules/ai/tutor/ai-tutor.errors.ts`
- `src/modules/ai/gemini/prompts/tutor-prompt.ts`
- `src/modules/ai/tutor/ai-tutor.service.test.ts`
- `src/modules/ai/tutor/ai-tutor.parser.test.ts`
- `src/modules/ai/gemini/prompts/tutor-prompt.test.ts`
- `src/modules/ai/tutor/ai-tutor.e2e.test.ts`
- `STORY-63_AI_TUTOR_SERVICE_REPORT.md`

## 23. Files Modified

- `src/shared/types/gemini.types.ts` — optional `systemInstruction?: string`.
- `src/shared/services/geminiClient.ts` — forward + apply optional system instruction (default preserved).
- `src/shared/services/geminiClient.test.ts` — +1 override test.

## 24. Database/Migration Changes

None. No new migration was required — STORY-42/43 already provide chunk
embeddings, lesson/chapter metadata, ownership/enrollment relations, and the
`content_chunks` table with an index on `lessonId`. No conversation/session/
message tables were added (the story mandates no memory). No vector dimension
change. No applied migration was edited. No DB reset/drop/truncate.

## 25. Remaining Risks

- **Language detection** is a codepoint heuristic (any Arabic char ⇒ Arabic). Adequate for the Arabic-first product; STORY-64 may pass an explicit locale later.
- **No relevance threshold** (top-K only, matching STORY-43). Grounding + the not-found contract mitigate low-relevance answers; covered by tests.
- **Pre-existing** quiz-generation 20s-timeout test failure remains (out of scope).
- The bilingual answer path depends on the new per-call system instruction; default Arabic behavior for all other callers is unchanged and test-guarded.

## 26. Final Status

**Completed.**

Confirmation: STORY-42 not rebuilt; STORY-43 not rebuilt; existing backend code
preserved; no second Gemini client / embedding service / Prisma client / RAG
pipeline; no frontend changes; no inaccessible lesson content returned; citations
never trust model-generated IDs/titles; no-chunks never calls Gemini; no
conversation memory; retrieval ≤15s, generation ≤10s, total ≤25s; no applied
migration edited; no DB reset/drop/truncate; no skipped tests or weakened
assertions; no secrets added; no commit or push.
