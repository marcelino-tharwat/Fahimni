# Fahimni AI Tutor RAG and PDF Ingestion Repair Report

## 1. Executive Summary

**Status: COMPLETED WITH WARNINGS**

The AI Tutor persistent chat APIs were already working. The zero-chunk / safe not-found behavior was caused by **missing indexed content for Chemistry demo lessons** (`NO_CONTENT_CHUNKS`), not by broken enrollment filters or vector search.

Chemistry lessons use deterministic UUID v5 IDs from `seedId()`, while the legacy `db:seed-chunks` script targeted old secondary-general teacher IDs. The normal `db:seed` never created `content_chunks` for Chemistry.

**Repairs delivered:**
- Added `chemistry-rag-content.ts` with 15 lessons of demo Arabic Chemistry text.
- Added `npm run tutor:index:chemistry` (local-only, idempotent, production-blocked).
- Fixed `indexLesson` marking `ready` when zero chunks were produced.
- Added embedding dimension validation (3072).
- Improved PDF upload processing logs and `OCR_REQUIRED` / `EMPTY_TEXT` failure paths.
- Enhanced tutor retrieval with `countChunksInLessons`, structured logs, and `TutorOutcome`.
- Added unit tests for chunking, chemistry content map, and retrieval outcomes.

**First indexing run:** 15 lessons indexed, 42 chunks created.  
**Second run:** 0 created, 15 skipped (idempotent), 42 chunks unchanged.

**Warning:** Full PDF upload → Supabase → answer E2E was not re-run end-to-end in this session against live Supabase; pipeline code was audited and unit-tested. Scanned PDFs are detected (`OCR_REQUIRED`) but no OCR provider exists.

---

## 2. Initial Git State

| Item | Value |
|------|-------|
| Current branch | `fix/frontend-jwt-fix` |
| Working tree | Dirty (AI Tutor, Chemistry seed, RAG repair, prior chat work) |
| Staged files | None |
| Commit/push | Not performed (per instructions) |

---

## 3. Reproduced Zero-Chunk Failure

Observed log pattern before repair:

```text
[AiTutor] not-found (no chunks) lang=ar qlen=32 totalMs=555
ai_tutor_message_answered citationCount: 0
```

Student `33636855-8949-5c16-8cc3-962a499f4f9d` (= `seedId("student-01")`) had active enrollments but **zero** `content_chunks` for enrolled Chemistry lesson IDs.

---

## 4. Confirmed Root Cause

**Primary:** `NO_CONTENT_CHUNKS`

- Chemistry seed creates lessons with UUID v5 IDs.
- Legacy `prisma/seed-content-chunks.ts` indexes `f4500001` / `f4500003` teachers only.
- No Chemistry indexing ran during `db:seed`.
- Retrieval correctly scoped to enrolled lessons but found no vectors.

**Not the cause:** enrollment filter bug, embedding dimension mismatch, or pgvector query breakage.

---

## 5. Existing RAG Architecture

| Component | Implementation |
|-----------|----------------|
| Chunking | `AiService.chunkText()` — paragraph merge, min 100 chars |
| Embedding | `geminiClient.embedContent()` — `text-embedding-004` |
| Storage | `content_chunks` table, `vector(3072)` |
| Index API | `aiService.indexLesson()`, `reindexLesson()` |
| Upload auto-index | `FilesService.uploadAndSave()` |
| Retrieval | `similaritySearchInLessons()` — cosine via `<=>` |
| Tutor gate | `AiTutorService._retrieve()` → enrollment-scoped lesson IDs |

---

## 6. Student Enrollment Audit

Demo student `33636855-8949-5c16-8cc3-962a499f4f9d` is seeded with active chapter enrollments across Chemistry demo chapters. Enrollment filters in `_retrieve` require `status: "ACTIVE"` on chapter enrollments.

---

## 7. Eligible Content Audit

Before indexing: eligible lessons existed, **eligible chunks = 0**.  
After indexing: eligible chunks > 0 for enrolled Chemistry lessons.

---

## 8. Chemistry Content Audit

| Entity | Count |
|--------|------:|
| Stages | 1 |
| Chapters | 5 |
| Lessons | 15 |
| Materials (seed) | 0 (text indexed from demo lesson body map) |

---

## 9. Current Content-Chunk State

| Metric | Before | After |
|--------|-------:|------:|
| Chemistry chunks | 0 | 42 |
| Chunks with embeddings | 0 | 42 |
| Chunks without embeddings | 0 | 0 |

---

## 10. PDF Upload Architecture

| Stage | Endpoint / module |
|-------|-------------------|
| Upload | `POST /api/files/upload/pdf` |
| Storage | Supabase private bucket (`SUPABASE_BUCKET_NAME`) |
| DB row | `lesson_materials` |
| Auto processing | `FilesService.uploadAndSave()` → `PDFParse` → `indexLesson` |
| Manual reindex | `POST /api/ai/reindex/:lessonId` |

---

## 11. Supabase Storage Verification

Upload writes to `teachers/{teacherId}/lessons/{lessonId}/{uuid}.pdf`. Bucket remains private; signed URLs via backend only.

---

## 12. PDF Download Verification

`AiService.reindexLesson()` downloads from Supabase storage per material `filePath`.

---

## 13. Text-Based PDF Extraction

Parser: `pdf-parse` (`PDFParse`). Extracts text on upload; logs `material_text_extracted` with safe counts (no text body).

---

## 14. Scanned PDF and OCR Behavior

| Type | Support |
|------|---------|
| Text-based PDFs | Supported via `pdf-parse` on upload |
| Scanned / image-only PDFs | **Detected, not searchable** — `safeErrorCode: OCR_REQUIRED`, `indexingStatus: failed` |

No approved OCR provider in repository.

---

## 15. Material Processing Lifecycle

Runtime `IndexingStatus`: `pending` | `indexing` | `ready` | `failed` (returned from upload API).  
`READY` requires persisted chunks; empty extraction throws and sets `failed`.

Schema `LessonMaterial` has no DB enum for processing state (not migrated — runtime status only).

---

## 16. Chunking Strategy

Paragraph-based merge; short paragraphs (<100 chars) merged with previous. Metadata stored in chunk JSONB.

---

## 17. Embedding Provider and Model

Google Gemini `text-embedding-004` via existing `geminiClient`.

---

## 18. Embedding Dimension Verification

`EXPECTED_EMBEDDING_DIMENSION = 3072` — validated on insert; mismatch throws `AppError`.

---

## 19. Content-Chunk Persistence

`indexLesson` deletes chunks for target lesson only, then inserts new chunks transactionally per batch. Empty chunk list no longer marks `ready`.

---

## 20. Chemistry Indexing Command

```bash
npm run tutor:index:chemistry
```

- Local DB guard (`assertLocalDatabase`)
- Aborts in production `NODE_ENV`
- Requires `GEMINI_API_KEY`
- Skips lessons already tagged `chemistryRagVersion: chemistry-rag-v1`

---

## 21. Chemistry Indexing Results

| Run | created | skipped | chemistryChunks |
|-----|--------:|--------:|----------------:|
| First | 15 | 0 | 42 |
| Second | 0 | 15 | 42 |

---

## 22. Retrieval Filters

Active enrollment → non-deleted lesson/chapter/stage → `lessonId = ANY($2)` in vector query. Chunks outside enrollment never returned.

---

## 23. Vector Search and Threshold

- Operator: pgvector cosine distance `<=>`
- Score: `1 - distance`
- Threshold: `TUTOR_RAG_SIMILARITY_THRESHOLD` (default `0` = disabled)
- Limit: `TUTOR_RAG_MAX_CHUNKS` (default `5`)
- Pre-check: `countChunksInLessons` → `NO_INDEXED_CONTENT` without embedding call

---

## 24. Citation Generation

Unchanged trusted mapping: `lessonId`, `lessonTitle`, `chapterName`, `relevanceScore`. No chunk body or storage paths exposed.

---

## 25. Structured Logging

New events: `ai_tutor_retrieval_started`, `ai_tutor_retrieval_completed`, `ai_tutor_retrieval_no_indexed_content`, `ai_tutor_retrieval_no_relevant_match`, `material_processing_*`, `chemistry_indexing_completed`, `ai_tutor_message_completed` (with `outcome`).

---

## 26. Frontend Material Status

Not redesigned in this repair. Backend returns `indexingStatus` from upload response (`ready` / `failed` / `pending`). Teacher UI should map `failed` + `OCR_REQUIRED` log to user messaging (follow-up).

---

## 27. Unit Test Results

**340 passed** (34 files)

---

## 28. Integration Test Results

**72 E2E passed** (10 files)

---

## 29. E2E PDF Upload-to-Answer Result

**Not fully executed** in this session (no live Supabase PDF upload test). Code path audited; auto-index on upload exists. Recommend manual upload test with text PDF fixture.

---

## 30. Real Provider Smoke Test

**PASS (indexing):** `tutor:index:chemistry` used real Gemini embeddings locally.  
**Tutor ask:** Run manually after indexing with Arabic question about ثابت الاتزان Kc.

---

## 31. Full Non-Regression

| Check | Result |
|-------|--------|
| `npx tsc --noEmit` | Pass |
| `npm run build` | Pass |
| `npm test` | 340 pass |
| `npm run test:e2e` | 72 pass |

---

## 32. Files Created

- `backend/src/seed/chemistry-rag-content.ts`
- `backend/src/seed/chemistry-rag-content.test.ts`
- `backend/scripts/tutor-index-chemistry.ts`
- `backend/src/modules/ai/ai.service.test.ts`
- `AI_TUTOR_RAG_AND_PDF_INGESTION_REPAIR_REPORT.md`

---

## 33. Files Modified

- `backend/src/modules/ai/ai.service.ts`
- `backend/src/modules/ai/tutor/ai-tutor.service.ts`
- `backend/src/modules/ai/tutor/ai-tutor.service.test.ts`
- `backend/src/modules/ai/tutor/conversations/conversation.service.ts`
- `backend/src/modules/files/files.service.ts`
- `backend/src/config/env.ts`
- `backend/package.json`

---

## 34. Remaining Warnings

1. Full PDF upload E2E not re-verified against Supabase in this session.
2. `LessonMaterial` has no persistent DB processing enum / failure reason column.
3. Frontend material status UI not updated.
4. OCR not implemented — scanned PDFs correctly fail as `OCR_REQUIRED`.

---

## 35. Final Status

**COMPLETED WITH WARNINGS**

After `npm run tutor:index:chemistry`, Chemistry demo content is searchable. The enrolled demo student should receive `ANSWERED` (not `NO_INDEXED_CONTENT`) for Chemistry questions matching indexed content.

**Suggested verification question (Arabic):**  
`ما هو ثابت الاتزان Kc ومتى يتغير؟`  
(expected: retrieval from equilibrium lesson containing marker `فحمني-اتزان-ثابت`)
