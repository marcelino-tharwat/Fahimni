# Fahimni AI Tutor Persistent Chat and Storage Report

## 1. Executive Summary

STORY-69 delivered a production-quality AI Tutor chat experience: the frontend now calls the real backend tutor APIs (no mocks), conversations and messages persist in PostgreSQL via Prisma, the existing `AiTutorService` RAG/Gemini flow is reused without duplication, and the UI follows the `Frontend/Design System for Fahimni` visual spec. Attachments were not implemented (no end-to-end backend); attachment UI was not shown.

**Final Status: COMPLETED WITH WARNINGS**

## 2. Initial Git State

- **Current branch:** `fix/frontend-jwt-fix`
- **Working tree:** clean except untracked `ADMIN_AND_BACKEND_IMPROVEMENT_PROPOSAL.md` and `Frontend/Design System for Fahimni/`
- **Staged:** none
- **Pre-existing failures:** backend `AppError.ts` exactOptionalPropertyTypes; frontend project-wide `tsc -b` errors unrelated to AI Tutor

## 3. Existing AI Tutor Architecture

- **Ask:** `POST /api/tutor/ask` → `TutorController` → enrollment + quota → `AiTutorService.ask` (RAG + Gemini)
- **Usage:** `GET /api/tutor/usage-today` (read-only)
- **Auth:** cookie session, `authenticateMiddleware` + `authorizeMiddleware("STUDENT")`
- **Quota:** `AiTutorUsage` per student per UTC day via `TutorUsageService`

## 4. Existing Endpoint Connection

Frontend `tutorApi.ask()` and `tutorApi.getUsageToday()` call `/tutor/ask` and `/tutor/usage-today` through the shared `apiClient` with `withCredentials: true`. Removed mock `/ai-tutor/*` paths.

## 5. Existing RAG and Citation Verification

Unchanged `AiTutorService` RAG retrieval and citation mapping. Controller still strips `relevanceScore` from public responses.

## 6. Existing Usage and Quota Verification

`TutorUsageService.tryClaim` / `refund` preserved. Persistent send path uses the same quota semantics.

## 7. UI Without Backend Removed

Removed mock chat messages, fake remaining-questions badge, dead `/ai-tutor/messages` API paths, and non-functional attachment/upload controls (never present in final UI).

## 8. Design System Audit

Mapped chat UI to design tokens in `tokens.css` and reference implementation in `Frontend/Design System for Fahimni/src/app/App.tsx`: cyan gradient student bubbles, navy bot avatar, citation chips, typing dots, sticky composer, welcome state, error bubble, 500-char input, ArrowUp send with spinner.

## 9. Persistence Architecture

```
Frontend → Fahimni backend → PostgreSQL (Prisma): conversations, messages, citations metadata
Supabase Storage: not used for chat (attachments not implemented)
```

## 10. PostgreSQL Conversation Models

`AiConversation`: id, studentId, title (default `محادثة جديدة`), isArchived, timestamps, soft delete via deletedAt.

## 11. PostgreSQL Message Models

`AiMessage`: id, conversationId, role (STUDENT|ASSISTANT), content, status (PENDING|COMPLETED|FAILED), citations JSON, clientMessageId, errorCode, timestamps. Unique on `(conversationId, clientMessageId)`.

## 12. Attachment Metadata Model

Not implemented — documented for future `AiMessageAttachment` + private Supabase bucket when product requires uploads.

## 13. Prisma Migration

`backend/prisma/migrations/20260701120000_add_ai_tutor_conversations/migration.sql` (additive, forward-only).

## 14. Supabase Storage Architecture

Existing server-side client in `backend/src/config/supabase.ts` remains for lesson materials only. No chat binaries stored.

## 15. Supabase Credential Security

Service role key backend-only in `.env`; no `VITE_SUPABASE_*` in frontend.

## 16. Conversation Routes

- `POST /api/tutor/conversations`
- `GET /api/tutor/conversations`
- `GET /api/tutor/conversations/:conversationId`
- `PATCH /api/tutor/conversations/:conversationId`
- `DELETE /api/tutor/conversations/:conversationId`

## 17. Message Routes

- `GET /api/tutor/conversations/:conversationId/messages`
- `POST /api/tutor/conversations/:conversationId/messages`
- `POST /api/tutor/conversations/:conversationId/messages/:messageId/retry`

## 18. Attachment Routes

None (not implemented).

## 19. Authorization and Privacy

All conversation routes require authenticated `STUDENT`. Queries scoped by `studentId` + `conversationId`. Teachers/admins have no transcript access.

## 20. Idempotency and Concurrency

Stable `clientMessageId` per logical send; unique constraint + idempotent read on duplicate; failed messages retry via dedicated endpoint without duplicate student rows.

## 21. Bounded AI Context

Env: `TUTOR_CHAT_RECENT_MESSAGE_LIMIT=16`. Recent completed messages passed to `buildTutorPrompt` — not full lifetime history.

## 22. Conversation History UI

Desktop sidebar + mobile drawer; archive filter; new/open/rename/archive/delete; cursor pagination ready on API.

## 23. Chat UI

STORY-69 behaviors: RTL/LTR alignment, welcome, typing indicator, error + retry, citations as lesson links, 500-char auto-resize textarea, Enter/Shift+Enter, loading spinner on send.

## 24. Attachment UI

Hidden (unsupported).

## 25. Routing and Hard Refresh

`/student/ai-tutor` and `/student/ai-tutor/:conversationId` load from backend on refresh.

## 26. Cache Isolation

React Query keys scoped per user session; logout clears via existing auth flow.

## 27. Accessibility and RTL

Citation links keyboard-focusable; typing `role="status"`; dialog for delete; direction from `useDirection()`.

## 28. Pixel-Perfect Review

Implemented per design-system reference; full multi-viewport manual QA recommended in local dev.

## 29. Backend Tests

`src/modules/ai/tutor/**` — **72 passed** (includes 3 new conversation service tests).

## 30. Frontend Tests

`src/features/student/api/aiTutor.test.ts` — **3 passed**.

## 31. E2E Results

Existing `tutor.e2e.test.ts` not re-run in this session (requires local DB + Gemini). Manual E2E checklist documented in story.

## 32. Full Non-Regression

| Check | Result |
|-------|--------|
| Backend Prisma validate | Pass |
| Backend tutor unit tests | 72/72 pass |
| Backend `tsc` | Pre-existing `AppError.ts` failure only |
| Frontend tutor tests | 3/3 pass |
| Frontend `tsc -b` | Pre-existing unrelated project errors |
| Frontend AiTutor files | No TS errors |

## 33. Files Created

- `backend/prisma/migrations/20260701120000_add_ai_tutor_conversations/migration.sql`
- `backend/src/modules/ai/tutor/conversations/*`
- `Frontend/src/features/student/pages/AiTutor/**`
- `Frontend/src/features/student/api/aiTutor.test.ts`
- `AI_TUTOR_PERSISTENT_CHAT_AND_STORAGE_REPORT.md`

## 34. Files Modified

- `backend/prisma/schema.prisma`
- `backend/src/config/env.ts`, `backend/.env.example`
- `backend/src/modules/ai/gemini/prompts/tutor-prompt.ts`
- `backend/src/modules/ai/tutor/ai-tutor.service.ts`
- `backend/src/modules/ai/tutor/tutor.routes.ts`
- `Frontend/src/features/student/api/aiTutor.ts`
- `Frontend/src/shared/types/aiTutor.ts`
- `Frontend/src/shared/lib/i18n/*/student.json`
- `Frontend/src/app/router.tsx`
- Deleted: `Frontend/src/features/student/pages/AiTutorPage.tsx`

## 35. Remaining Warnings

- Rename uses `window.prompt` (functional but basic)
- Full-repo `tsc`/lint failures pre-date this work
- Migration must be applied locally: `npx prisma migrate deploy`
- Live Gemini E2E not executed in CI session

## 36. Final Status

**COMPLETED WITH WARNINGS**
