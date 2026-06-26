# Secondary General Seed Report

## 1. Executive Summary

The local Prisma seed was redesigned to provision a coherent **Egyptian General
Secondary Education** (المرحلة الثانوية العامة) dataset and deterministic,
ready-to-use fixtures for direct STORY-45 (`POST /api/quizzes/generate`) testing.
The seed is now **idempotent**, **local-only** (refuses production), reuses the
existing Gemini/RAG/Quiz/Stage/Chapter/Lesson implementations, removes the legacy
preparatory (إعدادي) seed data, and emits a git-ignored populated Postman
environment + manifest. The seed ran twice (idempotent), all read-only DB checks
passed, the contract smoke suite passed, and a single live generation returned
**201 DRAFT** end-to-end.

**Final status: Ready for direct Postman testing.**

## 2. Previous Seed Analysis

- The on-disk `prisma/seed.ts` was **stale and broken**: it created `Enrollment`
  rows with columns (`enrolledMonth`, `enrolledYear`, `startedAt`, `expiresAt`)
  that no longer exist after `20260624111545_simplify_enrollment_permanent_access`.
- Its educational content was **preparatory (الإعدادي)**, not secondary, and it
  began with `deleteMany` of `seed-*` records then `create` (non-idempotent for users).
- The live DB already contained a deterministic `f45*` General Secondary dataset
  (from a prior run of this task) plus legacy `seed-*` preparatory data and a
  `reorder.test@school.edu` teacher.

## 3. Seed Architecture

- `src/seed/secondary-general.data.ts` — pure, typed, unit-tested dataset
  (accounts, stages, chapters, lessons + rich Arabic text, fixtures, version).
- `src/seed/local-guard.ts` — `assertLocalDatabase()` safety guard.
- `prisma/seed.ts` — orchestrator: guard → hash once → legacy cleanup → upsert
  accounts → `createMany(skipDuplicates)` relational → optional AI indexing →
  emit manifest + populated Postman env.
- `prisma/seed-verify.ts` — read-only post-seed DB assertions.
- IDs are deterministic strings (`f450….`) matching the existing DB exactly.

## 4. Local Safety Guards

The seed aborts (without printing the password or connection string) when:
`NODE_ENV=production`, an explicit `PRODUCTION` flag is set, the DB host is not a
recognized local host (`localhost`/`127.0.0.1`/`::1`/`postgres`/`db`/
`host.docker.internal`), or `DATABASE_URL` is missing/unparseable. Verified host
on this run: `localhost`.

## 5. Accounts Created (passwords omitted)

| Role | Email | Prisma role | Status |
|---|---|---|---|
| Teacher 1 | `story45.teacher1@local.test` | `OPERATION` | ACTIVE |
| Student | `story45.student@local.test` | `STUDENT` | ACTIVE |
| Teacher 2 | `story45.teacher2@local.test` | `OPERATION` | ACTIVE |

Password is hashed once with **bcrypt rounds = 12** (matches production
`auth.service`), set only via the seed, written only into the git-ignored populated
Postman env, overridable with `SEED_LOCAL_PASSWORD`. Admin (`admin@example.com`) is
upserted, never overwritten destructively.

## 6. General Secondary Dataset

| Owner | Stages | Chapters | Lessons |
|---|---|---|---|
| Teacher 1 | 3 (الأول/الثاني/الثالث الثانوي) | 12 (3–4 per stage) | 36 |
| Teacher 2 | 1 (الصف الأول الثانوي) | 1 (خواص المادة) | 2 |
| **Total** | **4** | **13** | **38** |

Subjects span الرياضيات، الفيزياء، الكيمياء، الأحياء. No preparatory/primary
content remains (verified). Every lesson has an Arabic description and source text;
the successful chapter's three lessons carry multi-paragraph educational text.

## 7. STORY-45 Fixtures

| Fixture | ID | Name |
|---|---|---|
| stageId | `f4500010-0001-4001-8001-000000000001` | الصف الأول الثانوي |
| chapterId (success) | `f4500100-0001-4001-8001-000000000001` | الرياضيات — الدوال الخطية |
| lessonId1 | `f4500100-0001-4001-8001-000000000001` | مفهوم الدالة الخطية |
| lessonId2 | `f4500100-0001-4001-8001-000000000002` | الميل والجزء المقطوع |
| unindexedChapterId | `f4500101-0001-4001-8001-000000000001` | الرياضيات — المعادلات التربيعية |
| otherTeacherChapterId | `f4500200-0001-4001-8001-000000000001` | الفيزياء — خواص المادة |
| otherTeacherLessonId | `f4500200-0001-4001-8001-000000000001` | الكثافة |

## 8. RAG Readiness

- **Strategy A** (real indexing via the existing `aiService.indexLesson`), gated by
  `SEED_AI_READY=true` + `GEMINI_API_KEY`; idempotent (skips lessons that already
  have chunks).
- **Vector dimension verified: 3072** (`content_chunks.embedding`, matches the
  configured `gemini-embedding-2` model output).
- Successful chapter lessons have **8 chunks** total → `ragReady = true`.
- Live embedding status: pre-existing chunks present; no re-embedding needed on the
  verified runs (quota preserved).

## 9. Unindexed Fixture

`f4500101` (الرياضيات — المعادلات التربيعية), owned by Teacher 1, with **3 active
lessons** and **0 content chunks** → returns **422** for generation (verified),
not 404. No chunks were deleted to create it; it is simply never indexed.

## 10. Ownership Fixture

`f4500200` (الفيزياء — خواص المادة) belongs to **Teacher 2** via
`Chapter → Stage.teacherId`. Teacher 1 generating against it reaches the ownership
guard and receives **404** (project-standard safe behavior). Verified.

## 11. Performance Improvements

- Password hashed **once** (not per account).
- Relational data inserted with **3 `createMany` calls** (stages/chapters/lessons)
  using `skipDuplicates` — no per-row `findUnique`/N+1.
- AI embedding runs **outside** DB transactions, sequentially over only the 3
  successful lessons, reusing the shared Gemini client's rate limiting, and
  **skips already-indexed** lessons (`seedVersion` in chunk metadata).
- Concise progress logging; no full educational text, answers, or secrets logged.
- Measured: relational ~29–33 ms; total seed ~0.6 s (no embedding needed on re-runs).

## 12. Idempotency Verification

Ran the seed twice. Run 1 removed 3 legacy users + their content; Run 2 removed 0.
Both runs: Stages `+0/4 skipped`, Chapters `+0/13 skipped`, Lessons `+0/38 skipped`,
no duplicate users/stages/chapters/lessons/chunks, no unrelated data touched.

## 13. Postman Environment Generation

- Tracked template: `backend/postman/Fahimni_Local.postman_environment.template.json`
  (empty credentials/IDs/tokens; no secrets).
- Git-ignored populated env: `backend/postman/Fahimni_Local.postman_environment.json`
  (real IDs + local password; runtime tokens/quiz IDs left empty).
- Git-ignored manifest: `backend/postman/story45-seed-manifest.local.json`
  (IDs only, no secrets). `git check-ignore` confirms both are ignored; the
  template and `postman/README.md` are tracked.

## 14. Automated Verification

- `src/seed/secondary-general.data.test.ts` — 18 pure tests (dataset shape, no
  preparatory keywords, fixtures, guard behavior, template has no secrets).
- `prisma/seed-verify.ts` — read-only DB assertions: **ALL CHECKS PASSED**
  (accounts/roles, 3 secondary stages, no preparatory data, no legacy `seed-`
  users, ownership, success lessons in success chapter, unindexed chapter has
  active lessons + 0 chunks, success chapter 8 chunks, 0 QuizAttempt).

## 15. Newman/Postman Results

`newman` is not installed; an equivalent **fetch-based contract smoke** was run
against the live server using the populated env — **SMOKE PASSED (10/10)**:
health 200; teacher1/student/teacher2 login 200; no-auth 401; student 403;
invalid 400; missing chapter 404; unindexed 422; cross-teacher 404. One **live
generation** confirmed **201 DRAFT** (5 questions with IDs, totalPoints 5, types
MCQ/TRUE_FALSE/ESSAY).

## 16. Files Changed

Created:
- `backend/src/seed/secondary-general.data.ts`
- `backend/src/seed/local-guard.ts`
- `backend/src/seed/secondary-general.data.test.ts`
- `backend/prisma/seed-verify.ts`
- `backend/postman/Fahimni_Local.postman_environment.template.json` (tracked)
- `backend/postman/README.md` (tracked)
- `backend/postman/Fahimni_Local.postman_environment.json` (git-ignored, generated)
- `backend/postman/story45-seed-manifest.local.json` (git-ignored, generated)
- `backend/docs/testing/story-45-postman-e2e-ar.md` (git-ignored under docs/)
- `SECONDARY_GENERAL_SEED_REPORT.md` (this file)

Modified:
- `backend/prisma/seed.ts` (full rewrite)
- `backend/package.json` (`db:seed:secondary`, `db:seed:verify` scripts)
- `backend/.gitignore` (track template; ignore populated env + manifest)

## 17. Remaining Manual Prerequisites

- For **live** generation: a working `GEMINI_API_KEY` and a model the key can use
  (verified working: `gemini-2.0-flash` is `limit:0` on the current free-tier key;
  `gemini-2.5-flash` works — configured in `.env`).
- For AI-ready indexing on a **fresh** DB: run with `SEED_AI_READY=true`.
- Pre-existing drift (not introduced here): `promo_codes` table is absent from this
  DB while present in `schema.prisma`; the seed's legacy cleanup tolerates this.

## 18. Final Status

**Ready for direct Postman testing.**
