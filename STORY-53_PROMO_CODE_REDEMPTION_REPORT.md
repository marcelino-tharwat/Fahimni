# STORY-53 Promo Code Redemption Report

## 1. Executive Summary

Implemented the STORY-53 canonical redemption endpoint
`POST /api/promo-codes/redeem` (`{ code, chapterId }`) by reusing the existing
STORY-52 PromoCode model/table/service and STORY-50 enrollment architecture. The
existing `redeem()` service already claimed codes atomically; it was aligned to
the STORY-53 contract (400 + bilingual messages, check ordering, expiry-guarded
claim, and P2002→already-enrolled mapping for the same-chapter race). No new
table, model, service, or migration was created. Focused unit tests (22) and a
real HTTP+PostgreSQL E2E (8 scenarios incl. both concurrency cases) pass twice;
typecheck, build, and the full suite (192) pass.

## 2. STORY-52 Dependency Audit (reused, not reimplemented)

- PromoCode Prisma model + `promo_codes` table + migration
  (`20260626100000_create_promo_codes_drift_fix`).
- Code generator (`CODE_CHARSET`/`CODE_LENGTH`, rejection-sampled), CRUD routes,
  list/validate endpoints, controller, router, pagination/authorization.
- `validate(code)` (exists / not used / not expired) — reused inside redeem.
- STORY-50 Enrollment model + `enrollmentPublicFields`, `PaymentMethod.PROMO`,
  unique `(studentId, chapterId)`, and the soft-delete/active rules.
- STORY-48 E2E infra (`vitest.e2e.config.ts`, `src/test/e2e-setup.ts`,
  `TEST_DATABASE_URL`).

## 3. Missing STORY-53 Behavior Found

The pre-existing `POST /:code/redeem` redeem existed but: (a) had no canonical
body route, (b) returned 409 (not 400) for used/already-enrolled with
English-only messages, (c) did not catch the enrollment unique-violation, so a
concurrent same-chapter redeem (Case B) surfaced a raw P2002 → 500. These were
fixed as the smallest changes needed for STORY-53.

## 4. Canonical Redemption Route

- **Canonical:** `POST /api/promo-codes/redeem` — body `{ code, chapterId }`, STUDENT only.
- **Compatibility alias (retained):** `POST /api/promo-codes/:code/redeem` — now
  delegates to the **same** `PromoCodeService.redeem(...)` method.
- Both: `authenticate` → `authorize("STUDENT")` → DTO validate → controller →
  shared service. Student id always from `req.user.id`.

## 5. DTO Validation

`src/modules/promo-codes/dto/redeem.dto.ts` (`redeemDtoSchema`, strict):
`code` required string, trimmed, upper-cased, exactly 8 chars from the STORY-52
charset; `chapterId` required valid UUID. Unknown/client-controlled fields
(studentId, usedByStudentId, createdBy, isUsed, usedAt, paymentMethod,
enrollmentStatus, …) are rejected by `.strict()`.

## 6. Redemption Transaction

Order (no consumption before the safe checks pass): chapter exists+active →
student not already enrolled → code valid (exists/not expired/not used) → then a
single `prisma.$transaction`:
1. `promoCode.updateMany` claim guarded by `isUsed: false` AND
   `(expiresAt IS NULL OR expiresAt > now)`, setting `isUsed/usedByStudentId/usedAt`;
   `count === 0` → 400 already-used.
2. `enrollment.create` (`PROMO`, price 0, `promoCodeId`); a unique-violation
   (P2002) → 400 already-enrolled and the transaction rolls back the claim.

## 7. Enrollment Integration

Reuses the existing Enrollment model: `paymentMethod = PROMO` (the actual enum
value; the spec's `PROMO_CODE` maps to it), `price = 0`, `status` defaults
`ACTIVE`, `promoCodeId` linked. No fake payment/order record is created (the
schema requires none). Verified via `GET /api/content/student/my-courses` that
the chapter appears after redemption.

## 8. Error Localization

No i18n framework exists; added a minimal `promo-code.i18n.ts` (ar/en) for the
redemption messages only (`resolveLocale` from `Accept-Language`, default `en`):
- Invalid code → «الكود غير صالح» / "Invalid code" (incl. nonexistent + expired).
- Already used → «تم استخدام هذا الكود من قبل» / "Code already used".
- Already enrolled → «أنت مشترك بالفعل في هذا الفصل» / "Already enrolled in this chapter".
- Chapter not found → 404 «الفصل غير موجود» / "Chapter not found".
All domain failures return **400** (chapter-not-found 404). No Prisma/SQL/stack
leakage.

## 9. Concurrency Protection

- **Case A (two students, same code):** the `isUsed:false` claim guard → exactly
  one `updateMany` succeeds; the other gets 400 already-used. One enrollment;
  code linked to the winner. **Verified in E2E.**
- **Case B (one student, two codes, same chapter):** both claim different codes,
  but `enrollment.create` hits the unique `(studentId, chapterId)` → one succeeds,
  the other throws P2002 → 400 already-enrolled and the transaction rolls back the
  losing claim, so the losing code stays unused. One enrollment, one code used.
  **Verified in E2E.**

## 10. Tests Added

- `dto/redeem.dto.test.ts` — 10 (normalization, length/charset/UUID, strict, rejects client fields).
- `promo-code.redeem.service.test.ts` — 12 (happy path, auth-derived studentId,
  invalid/expired/used/already-enrolled/missing/inactive-chapter, claim-miss,
  P2002 rollback mapping, ar + en messages).
- `promo-code.redeem.e2e.test.ts` — 8 real HTTP+DB scenarios.
Total focused: **30 tests**. No STORY-52 CRUD/generation tests were duplicated.

## 11. Real E2E Journey

`src/modules/promo-code/promo-code.redeem.e2e.test.ts` (real Express app, auth,
DTO, controller, service, Prisma, isolated `final_project_test`): success +
my-courses visibility; invalid (ar+en) → 400, no enrollment; expired → 400, code
unused; used code reused by Student 2 → 400; already-enrolled → 400, fresh code
unused; 401 unauthenticated; 403 teacher; Case A concurrency; Case B concurrency.
DB assertions confirm code state, single enrollment, and no partial consumption.

## 12. Database Verification

`prisma validate` valid; `migrate status` up to date; no drift; no new migration
required (promo_codes table + `code` unique + enrollment `(studentId,chapterId)`
unique already exist — the latter as a unique index, which enforces P2002).

## 13. Commands and Results

| Command | Result |
|---|---|
| `npx prisma validate` | valid |
| `npx prisma migrate status` | up to date (dev + test) |
| `npx prisma generate` | ok |
| `npx tsc --noEmit` | 0 errors |
| `npm run build` | success (exit 0) |
| `npx vitest run` (full) | **192 passed / 0 failed** (14 files) |
| `npm run test:e2e:story53` run 1 | 8 passed |
| `npm run test:e2e:story53` run 2 | 8 passed |

## 14. Files Created and Modified

Created: `dto/redeem.dto.ts`, `dto/redeem.dto.test.ts`, `promo-code.i18n.ts`,
`promo-code.redeem.service.test.ts`, `promo-code.redeem.e2e.test.ts`, this report.
Modified: `promo-code.service.ts` (redeem aligned), `promo-code.controller.ts`
(`redeemByBody` + alias delegate), `promo-code.routes.ts` (`POST /redeem`),
`package.json` (`test:e2e:story53`). No backend model/migration/frontend changes.

## 15. Remaining Risks

- Expired codes are folded into the "Invalid code" message (STORY-53 treats expiry
  as invalid); the standalone `validate` endpoint still reports a distinct
  `CODE_EXPIRED` reason. Documented, intentional.
- The retained `/:code/redeem` alias now also returns 400 + `{enrollment, promoCode}`
  (was 409 + enrollment-only). This is the same feature aligned to the STORY-53
  contract; no consumer/tests depended on the old shape.
- `Accept-Language` defaults to English when unspecified.

## 16. Final Status

**Completed** — redemption + enrollment are atomic; both race conditions are
verified (no double-consumption; already-enrolled never consumes a code; losing
codes stay unused); tests and E2E pass twice; STORY-52 was reused (not
duplicated); schema is consistent.
