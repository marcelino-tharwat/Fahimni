# Fahimni Admin and Backend Improvement Proposal

> Audit-only, proposal-only, non-destructive. No code, schema, migration, seed,
> test, Postman, `.env`, or package file was modified. No commit/push performed.
> Branch at audit time: `fix/frontend-jwt-fix` (working tree clean).

## 1. Executive Summary

Fahimni's backend is, for its scope, **healthy and well-factored**: cookie-based
auth with refresh-token rotation and `User.status` enforcement, a centralized
`authorizeMiddleware`, an `AuditLog` model + service with `actorType`/scope,
teacher-ownership scoping across content/enrollment/AI, idempotent quiz attempts,
auto + essay grading, AI-tutor grounding with per-teacher daily caps, and a
Paymob webhook/checkout flow. These should **not** be rewritten.

However, there is **one critical security defect** that must be fixed before any
production exposure regardless of the Admin question: `GET /api/users` and
`POST /api/users` are mounted with **no authentication and no authorization**, and
the create schema accepts `role: "ADMIN"`. Anyone on the network can enumerate all
users (PII) and **mint an ADMIN account**. (Passwords are not leaked — `select`
is scoped — but the open privilege escalation is severe.)

On the Admin question: the product is effectively a **single-teacher academy**
model (teacher owns stages→chapters→lessons→quizzes; students enroll per chapter).
Most "admin-sounding" operations already belong correctly to `OPERATION` (teacher).
The genuinely cross-cutting needs are **promo codes** (already ADMIN-gated),
**enrollment deactivation** (already ADMIN-gated), **payment oversight**,
**account moderation**, and **AI cost control** — none of which has a real Admin
surface today (the `AdminDashboardPage` is an empty stub; the Tenants pages are
pure mocks). 

**Final decision: MINIMAL ADMIN REQUIRED BEFORE PRODUCTION** — a small set of
secured operational endpoints (Phase 0 + a thin Phase 1), not a full admin
platform. The demo/MVP can run without an Admin **panel**; a paying production
cannot run safely without minimal admin operational capability.

## 2. Current Backend Health

Modules present and mounted (`app.ts`): auth, users, students, teachers, stages,
chapters, lessons, files, content, dashboard, ai, tutor, enrollments, promo-codes,
payments, quizzes, attempts. Empty/unmounted stubs: `courses`, `progress`,
`notifications` (0 lines each).

| Area | State | Verdict |
| --- | --- | --- |
| Auth (login/refresh/logout/register) | Refresh rotation; `status` (INACTIVE/BANNED→403) enforced at login (`auth.service.ts:35`) | **NO CHANGE — strong** |
| Authorization | Centralized `authorizeMiddleware(...roles)` (`authorize.middleware.ts`) | Strong; coverage gap on `users` routes |
| Audit logging | `AuditLog` model (action/resourceType/resourceId/details/actorType/scopeTeacherId, indexed) + service | **NO CHANGE — strong**; extend coverage |
| Content ownership | Teacher-scoped stages/chapters/lessons/quizzes; ADMIN bypass where intended | **NO CHANGE — strong** |
| Enrollment | `GET /student/:id` (OPERATION own / ADMIN all), `PATCH /:id/deactivate` ADMIN-only, audited | Strong |
| Promo codes | `POST /`, `GET /` ADMIN-only, paginated (`promo-code.routes.ts`) | Strong |
| Payments | Public webhook + STUDENT checkout/status; `PaymentTransaction` has status/rawCallback/paymobOrderId | Read-model exists; **no admin oversight** |
| Quizzes / attempts / grading | Idempotent attempts, auto-grade, essay grading, CSV export | Strong |
| AI generation / tutor | Generation OPERATION; tutor STUDENT with daily cap (`TeacherProfile.aiTutorDailyQueryLimit`) | Strong; **no cost/usage admin view** |
| Dashboards | OPERATION-only teacher dashboards | No admin dashboard endpoint |
| Env validation | `env.ts` zod-validated, fail-fast | **NO CHANGE — strong** |
| Rate limiting | Global 100/15m **in-memory**, no login-specific limit | Needs hardening |
| Observability | `logger` exists; no `/ready`, no correlation IDs, no graceful shutdown | Gaps |
| `users` module | **Unauthenticated list + create-with-role** | **CRITICAL** |

## 3. Current Admin Role Audit

```
Current ADMIN role:            EXISTS — enum Role { ADMIN, STUDENT, OPERATION } (schema.prisma:346)
Seeded:                        YES — admin.chemistry@fahimni.test, role ADMIN, status ACTIVE (seed.ts)
Can log in:                    YES — standard auth; status ACTIVE
Dedicated Admin routes:        NONE (no admin module / no admin.routes / no admin.controller / no admin.service)
Routes allowing ADMIN:         promo-codes POST & GET (ADMIN-only); enrollment GET /student/:id (ADMIN sees all)
                               and PATCH /:id/deactivate (ADMIN-only)
Inherited behavior:            None beyond explicit ADMIN checks; ADMIN bypasses ownership only where coded
Role checks centralized:       YES (authorizeMiddleware) — but role-only; no permission granularity
Permission granularity:        NONE beyond the 3 roles
Security concerns:             Open POST /api/users accepts role:"ADMIN" (privilege escalation); open GET /api/users (PII)
```

Conclusion: **ADMIN is a real, enforced role with a few endpoints — not purely an
enum** — but there is **no Admin module, dashboard, or management surface**. The
enum's existence must not be mistaken for an implemented Admin feature.

## 4. Existing Admin Backend Capabilities

Real ADMIN-gated backend that exists today:
- `POST /api/promo-codes` — mint a promo code (ADMIN).
- `GET /api/promo-codes?page&limit&isUsed` — list/audit codes (ADMIN, paginated).
- `GET /api/enrollments/student/:studentId` — ADMIN sees all (teacher scoped).
- `PATCH /api/enrollments/:id/deactivate` — ADMIN-only, writes an audit log.

Everything else an admin would want (users, teachers, payments, AI usage, content
moderation, audit-log viewing, system health beyond `/health`) **does not exist**.

## 5. Existing Admin Frontend Pages

| Page | Route | Backend? | Status |
| --- | --- | --- | --- |
| `AdminDashboardPage` | `/admin/dashboard` | none | **Empty stub** (renders only a title) |
| `PromoCodesPage` | `/admin/promo-codes` | real (`/promo-codes`) | **Functional** |
| `TenantsPage` | `/admin/tenants` | none | **Mock** (`mockTenant`, `mockAnalytics`) |
| `TenantDetailsPage` | `/admin/tenants/:tenantId` | none | **Mock** |

Admin routes are guarded by `RoleGuard allowedRoles={['super_admin']}` with
`serverRoleToRouteGroup: { ADMIN→super_admin }`. Note a **phantom `support_agent`
route group** (`/support/students`) that maps to **no backend role** — unreachable
by any real user.

Admin pages using mocks: **TenantsPage, TenantDetailsPage** (and AdminDashboard is
empty). Mocks live in `src/shared/mocks/` (`tenant`, `analytics`, `users`).

## 6. Sprint Requirements Related to Admin

Search of `sprints.md` (path: `./sprints.md`):

| Story | Admin requirement | Backend evidence | Frontend page | Status |
| --- | --- | --- | --- | --- |
| Promo code generator (STORY-52 area) | "Access restricted to **admin/support** role" | ADMIN promo endpoints | PromoCodesPage | **Implemented** |
| Enrollment deactivate (SCRUM-506) | ADMIN-only action | `PATCH /enrollments/:id/deactivate` + audit | (admin support) | **Implemented (API)** |
| "list … for tenant" phrasing (stages/quizzes) | Indirect — "tenant" used loosely for the academy | teacher-scoped queries | — | Single-academy, no tenant model |
| Audit log on deletion (content stories) | Indirect | AuditLog service | — | Partial |

There is **no sprint story demanding a full Admin dashboard/platform**. The only
explicit admin/support requirement is promo-code management, already built. "Tenant"
in the sprints is descriptive language, not a multi-tenant architecture mandate.

## 7. Is Admin Required?

**MINIMAL ADMIN REQUIRED BEFORE PRODUCTION.** Not a full platform. Justification:
- Payments are real (Paymob): production needs someone able to **view/investigate
  failed payments and reconcile webhooks** — no role can do this today.
- Money + accounts demand **moderation** (ban abusive users, revoke sessions) —
  the data model supports `status BANNED` and login enforces it, but **no endpoint
  performs the change** except via direct DB edits.
- AI has real provider cost: production needs **usage visibility and a kill
  switch** — none exists.
- The open `users` endpoints must be **locked to ADMIN** before launch anyway.

## 8. MVP Without Admin — Risks

- **Critical:** open `POST /api/users` → anyone mints an ADMIN (full compromise).
- **Critical:** open `GET /api/users` → bulk PII (emails, mobiles, roles) leak.
- No way to **ban/deactivate** an abusive account except direct SQL.
- No way to **see or reconcile payments**; failed Paymob callbacks are invisible →
  students pay but stay unenrolled with no operator recourse.
- No **AI cost/usage** visibility → runaway Gemini spend undetected.
- No **audit-log viewer** → incidents are not investigable without DB access.
- Support cannot resolve access issues without raw DB queries (error-prone, unsafe).

What can operate without Admin: all teaching/learning flows (content, enrollment,
quizzes, grading, AI tutor) and promo codes. What cannot safely operate: payment
operations, account moderation, AI cost control, incident investigation.

Temporarily handleable via DB/scripts (acceptable short-term): one-off account
status changes, promo seeding. Should **never** require manual DB edits in
production: payment reconciliation, banning users at scale, session revocation.

## 9. Minimal Admin MVP Recommendation

Smallest secure scope, in two slices:

**Admin Phase 0 (no UI, security/ops essentials)** — highest priority:
1. **Lock down `users` routes** (authenticate + `authorizeMiddleware("ADMIN")`; forbid self-service ADMIN creation). *(Security fix, gates everything.)*
2. Admin **user search** (paginated, safe fields).
3. Admin **deactivate/reactivate** account (status change + audit).
4. **Revoke sessions** (delete user refresh tokens) + audit.
5. **`/ready`** readiness probe.

**Admin Phase 1 (thin panel)**:
6. Admin **overview** (counts: users, teachers, students, active enrollments, published content, attempts, failed payments, AI usage).
7. **Payments** list + detail (status filter, webhook state) — read-only first.
8. **AI usage** view (per teacher/student aggregates).
9. **Audit-log** viewer (paginated, safe metadata).

Defer (NOT in first Admin version): refunds, bulk destructive actions, content
takedown workflow, reported-content queue, feature-flag UI, multi-tenant admin,
2FA. Plan them, don't build them yet.

## 10. Admin Responsibilities (ADMIN-only)

View/search all users; activate/deactivate/ban; revoke sessions; view payments &
investigate/reconcile; mint/disable promo codes; deactivate enrollments
platform-wide; view AI usage/cost + global kill switch; view audit logs; view
system health. Role changes (if ever exposed) ADMIN-only under explicit policy.

## 11. Teacher / OPERATION Responsibilities (stay as-is)

Own stages/chapters/lessons/quizzes (create/edit/publish/unpublish); AI quiz
generation; grade essays; view own students' engagement + CSV export; set own
students' AI daily cap; view own dashboards. These are correctly teacher-scoped
and must **not** move to Admin.

## 12. Support Responsibilities

Find a user by email/mobile; view **safe** account metadata (status, role, last
activity, enrollment/attempt state); generate promo codes; assist access recovery.
Must never see password/refresh-token hashes, raw answers, or Gemini keys. Today
"support" is folded into ADMIN (promo story said "admin/support"); a dedicated
`SUPPORT` role is **optional/later** (the frontend already has a phantom
`support_agent` group with no backend role).

## 13. Proposed Admin Routes (proposal only — do not implement)

Global prefix is `/api` (note: auth is the lone `/api/v1/auth` outlier; keep admin
on `/api/admin` for consistency with the majority). All require
`authenticate` + `authorizeMiddleware("ADMIN")`.

```
# Phase 0
PATCH  /api/users/:id/status              # activate/deactivate/ban (+reason) — also fixes open route
POST   /api/users/:id/revoke-sessions
GET    /api/admin/users                   # search/list, paginated
GET    /api/admin/users/:id               # safe detail
GET    /api/ready                         # readiness (DB + migration)

# Phase 1
GET    /api/admin/overview
GET    /api/admin/payments                # filter by status, paginated
GET    /api/admin/payments/:id            # detail incl. webhook state (no card data)
GET    /api/admin/ai-usage                # aggregates by teacher/student
GET    /api/admin/audit-logs              # paginated, safe metadata
```

(Existing ADMIN endpoints `POST/GET /api/promo-codes` and
`PATCH /api/enrollments/:id/deactivate` are reused as-is.) No destructive `DELETE`
proposed — prefer status changes/soft state.

## 14. Proposed Admin Response Contracts (per endpoint)

For each: **Method/Path/Purpose/Role/Request/Response/Pagination/Filters/
Authorization/Audit event/Security risks/Frontend consumer/Priority.** Examples:

- `GET /api/admin/users` — Purpose: list users for ops. Role: ADMIN. Request:
  `?q&role&status&page&limit`. Response: `{ data: SafeUser[], meta:{page,limit,total} }`
  reusing `userPublicFields` (never password). Pagination: offset. Filters:
  role/status/q (DB-level `ILIKE`, allowlisted sort). Auth: ADMIN. Audit: none
  (read). Risk: PII exposure → enforce ADMIN + field allowlist. Consumer:
  `/admin/users`. Priority: **P0**.
- `PATCH /api/users/:id/status` — Purpose: activate/deactivate/ban. Request:
  `{ status, reason }`. Response: SafeUser. Audit: `USER_STATUS_CHANGED`
  (target, old→new, reason). Risk: privilege/abuse → ADMIN-only, cannot ban self,
  idempotent. Consumer: `/admin/users`. Priority: **P0**.
- `POST /api/users/:id/revoke-sessions` — deletes user refresh tokens. Audit:
  `USER_SESSIONS_REVOKED`. Priority: **P0**.
- `GET /api/admin/payments` — read-only, status filter, paginated; exclude raw
  callback secrets in list (detail may include sanitized `rawCallback`). Priority: **P1**.
- `GET /api/admin/audit-logs` — paginated, filter by resourceType/userId/date.
  Priority: **P1**.
- `GET /api/admin/overview` / `GET /api/admin/ai-usage` — aggregate counts.
  Priority: **P1**.

## 15. Database Impact

Reusable **without schema change**: `User` (has `status` ACTIVE/INACTIVE/BANNED),
`StudentProfile`, `TeacherProfile` (has `aiTutorDailyQueryLimit`), `Enrollment`,
`PaymentTransaction` (status/rawCallback/paymobOrderId), `AuditLog`,
`AiTutorUsage`, content models, `QuizAttempt`, `RefreshToken`, `PromoCode`.

Additive, forward-only (only if/when the matching feature is built):

| Change | When |
| --- | --- |
| `User.statusReason` (or audit-only) for ban/deactivate reason | **Useful later** (audit `details` can hold it now) |
| `TeacherProfile.approvalStatus` (PENDING/APPROVED/SUSPENDED) | **Useful later** (only if teacher approval becomes a flow; `User.status` covers suspend now) |
| `PaymentReconciliationLog` model | **Useful later** (Phase 2 refunds/reconcile) |
| `SystemSetting` / feature-flags model | **Useful later** (Phase 2 kill switch via env first) |
| `SupportNote` model | **Useful later** |
| New `SUPPORT` enum value | **Useful later** — additive, never replace existing enum |
| AI usage aggregation table | **Not required** (aggregate `AiTutorUsage` on read first) |

**Required now: none.** Phase 0 + Phase 1 reuse existing models. Do not edit
applied migrations; any later change is an additive `migrate` step.

## 16. Security Model

- Strict server-side `authorizeMiddleware("ADMIN")` on every admin route; **never**
  rely on the frontend `RoleGuard` alone.
- **Fix open `users` routes immediately** (authenticate + ADMIN; remove ability to
  self-register ADMIN via `POST /api/users`).
- Audit every admin mutation (status change, session revoke, promo disable,
  enrollment change) with actor, target, before→after, reason.
- Never return password or refresh-token hashes, raw Gemini keys, or raw provider
  payloads/answers unnecessarily; keep `userPublicFields`-style allowlists.
- Pagination + allowlisted sorting + DB-level search on every list (no in-memory
  full scans; cap page size).
- Forbid self-ban / self-role-change; no bulk destructive actions in v1.
- Optional: reauth/2FA for high-risk actions; rate-limit sensitive admin endpoints.
- **Risks to test:** IDOR (admin reading scoped resources by id), privilege
  escalation (the open create route), mass-assignment (PATCH bodies — whitelist
  fields), enumeration via search.

## 17. Audit Logging Requirements

Reuse `AuditLog` (action/resourceType/resourceId/details/actorType=ADMIN/userId/
scopeTeacherId). Required actions to add coverage for:
`USER_STATUS_CHANGED`, `USER_SESSIONS_REVOKED`, `USER_ROLE_CHANGED` (if exposed),
`PAYMENT_RECONCILED` (Phase 2), `PROMO_DISABLED`, `ENROLLMENT_DEACTIVATED`
(exists), `AI_KILL_SWITCH_TOGGLED` (Phase 2). Store safe metadata only — never
secrets or full payloads.

## 18. Admin Frontend Route Proposal (each backed by a real endpoint)

```
/admin                 → redirect to /admin/overview
/admin/overview        → GET /api/admin/overview              (Phase 1)
/admin/users           → GET /api/admin/users + PATCH status  (Phase 0/1)  [replaces nothing; new]
/admin/promo-codes     → existing /promo-codes                (DONE)
/admin/payments        → GET /api/admin/payments              (Phase 1)
/admin/ai-usage        → GET /api/admin/ai-usage              (Phase 1)
/admin/audit-logs      → GET /api/admin/audit-logs            (Phase 1)
/admin/system          → GET /api/ready + health              (Phase 1)
```

Keep `/admin/tenants*` **hidden / "قريبًا"** until a tenant model exists (today
they are mocks with no backend). Do not ship a page whose only data source is a mock.

## 19. Multi-Tenancy Decision

**TENANT MODEL SHOULD BE PLANNED, NOT BUILT YET.**

Current model: each teacher (`OPERATION`) owns their content tree; students enroll
per chapter. This is a **single-platform, teacher-isolated** model — effectively
one academy with teacher-scoped ownership, **no `Tenant` model in the schema**. The
existing `ADMIN` is a **platform admin**, not a tenant admin. The frontend Tenants
pages are mock-only. A real tenant model (orgs/schools, tenant admins, data
isolation per tenant) is only justified **before B2B/school licensing sales**.
Building it now adds isolation complexity and migration cost with no current
commercial driver; deferring is cheap because teacher-ownership already provides a
natural seam to introduce `tenantId` later as an additive migration.

## 20. Remaining Backend Improvements (catalog)

Effort: XS<½d · S~1d · M~2–3d · L~4–7d · XL=architectural.
Format below condensed (ID · Title · Module · Problem/Evidence · Risk · Fix ·
Frontend/DB/Security impact · Tests · Effort · Priority).

**Total backend improvements proposed: 18.**

## 21. Production-Readiness Improvements

- **PROD-1 — Lock down `users` routes** · users · Evidence: `user.routes.ts` has no
  auth; `createUserSchema` allows `role:"ADMIN"` · Risk: full compromise · Fix:
  authenticate + ADMIN, drop ADMIN from public create · FE: none (page is mock) ·
  DB: none · Sec: critical · Tests: 401/403/role · **XS · MUST**.
- **PROD-2 — Readiness probe `/ready`** · app · only `/health` exists · Risk:
  traffic to unmigrated/DB-down instance · Fix: check DB + migration status · Tests:
  ready/not-ready · **S · MUST**.
- **PROD-3 — Migration CI gate** · ci · prior drift caused result 500s · Fix: fail
  CI on `migrate status` drift · **XS · MUST**.
- **PROD-4 — CORS/cookie production config** · app · `cors origin` hardcoded
  `http://localhost:5173` · Risk: broken prod / unsafe cross-site · Fix: env-driven
  origin, SameSite/Secure for prod · FE: origin coordination · **S · MUST**.
- **PROD-5 — Graceful shutdown** · server · `app.listen` only, no SIGTERM/close ·
  Risk: dropped in-flight requests, leaked connections · Fix: close server + prisma
  on signal · **S · HIGH**.
- **PROD-6 — Structured logging + correlation IDs** · shared · `logger` exists but
  no request IDs · Fix: per-request id, structured fields · **M · HIGH**.
- **PROD-7 — Error monitoring (Sentry/equiv.)** · shared · no aggregation · **S · HIGH**.
- **PROD-8 — Env validation** · config · `env.ts` already fail-fast · **NO CHANGE NEEDED**.

## 22. Security Improvements

- **SEC-1 — Login rate limiting** · auth · only a global 100/15m limiter; no
  per-account/IP login throttle · Risk: brute force · Fix: stricter limiter on
  `/auth/login` (+ lockout/backoff) · Tests: lockout · **S · MUST**.
- **SEC-2 — Distributed rate limiting** · shared · `express-rate-limit` in-memory →
  ineffective across instances · Fix: Redis store · **M · HIGH** (overlaps PERF).
- **SEC-3 — Audit coverage for all privileged mutations** · shared · partial today ·
  Fix: ensure every ADMIN/teacher mutation writes `AuditLog` · **S · HIGH**.
- **SEC-4 — Unify bcrypt cost** · users/auth · `user.service` uses rounds 10 vs auth
  12 · Fix: single constant (12) · **XS · NICE**.
- **SEC-5 — Verify no OTP/secret logging in prod** · auth · prior audit noted dev
  OTP `console.log` · Fix: gate behind non-prod · **XS · HIGH**.
- **SEC-6 — Mass-assignment guards on PATCH bodies** · multiple · Fix: field
  allowlists (zod already helps) · **S · HIGH**.

## 23. Performance Improvements

- **PERF-1 — Pagination + allowlisted sort on every list** (incl. future admin
  lists) · enforce caps · **S · HIGH (when admin lists ship)**.
- **PERF-2 — Bounded CSV export** · quizzes · cap rows on results export · **XS · NICE**.
- **PERF-3 — Redis-backed limiter / background jobs** (see SEC-2) · **M · NICE**.
- **PERF-4 — Add indexes only with evidence** · current schema is already
  well-indexed (audit/payment/attempt indexes present) · **NO CHANGE NEEDED** now.

## 24. Product Backend Improvements

- **PRODP-1 — Admin payment oversight** (list/detail/reconcile) · payment · no admin
  view of `PaymentTransaction`; failed Paymob callbacks invisible · **M · HIGH**.
- **PRODP-2 — Account moderation endpoints** (status + revoke sessions) · users ·
  **S · HIGH** (part of Admin Phase 0).
- **PRODP-3 — AI usage/cost view + kill switch** · ai · no aggregate/cost surface ·
  **M · HIGH**.
- **PRODP-4 — Notifications** (module is an empty stub) + WhatsApp reminders ·
  **L · NICE**.
- **PRODP-5 — Configurable answer visibility / question bank / per-lesson analytics
  / AI conversation history / parent dashboard** · additive features · **M–L · NICE**.
- **PRODP-6 — Implement or remove empty `courses`/`progress`/`notifications`
  modules** · cleanup/clarity · **XS (remove) / L (implement) · NICE**.
- **PRODP-7 — Dedicated `SUPPORT` role** (frontend already has phantom
  `support_agent`) · additive enum + guard · **S · NICE/LATER**.

## 25. Features Not Recommended Yet

Refunds & full reconciliation workflow; reported-content / moderation queue; bulk
destructive admin actions; feature-flag admin UI; multi-tenant admin & tenant data
isolation; 2FA enforcement; parent portal. Plan, don't build, until a clear driver
(payment volume, B2B sales, abuse) appears.

## 26. Required Test Coverage (proposal — do not implement)

- **Authorization:** unauth→401; STUDENT→403; OPERATION→403; ADMIN→allowed on every
  admin route; prove no route relies on the frontend guard.
- **User mgmt:** search/pagination; deactivate → deactivated user cannot log in
  (login already returns 403 on INACTIVE/BANNED); session revocation invalidates
  refresh; password/token fields never returned.
- **Teacher mgmt:** status change + AI-limit change emit audit events.
- **Content moderation (later):** unpublish/soft-delete/restore; teacher ownership
  cannot override admin policy; audited.
- **Payments:** no card data in responses; pagination/filter; safe reconcile; never
  fabricate SUCCESS.
- **Data isolation:** admin sees platform-scoped data as intended; (future) tenant
  admin cannot cross tenant boundaries.
- **Concurrency/idempotency:** duplicate status updates idempotent; race on
  status/session-revoke well-defined.

## 27. Phased Admin Roadmap

**Phase 0 — operational essentials (no/minimal UI).** Goal: make production safe.
Features: lock `users` routes; user search; deactivate/reactivate; revoke sessions;
`/ready`. Backend: ~4 endpoints + 1 probe. Frontend: optional minimal users table.
DB: none. Security: ADMIN guard + audit. Tests: authz + status + revoke. Effort:
**S–M**. Dependencies: none (do first).

**Phase 1 — minimal Admin panel.** Goal: visibility. Features: overview, users
page, payments (read), ai-usage, audit-logs viewer. Backend: ~5 read endpoints.
Frontend: 5 pages (replace empty dashboard + mocks). DB: none. Tests: pagination,
field allowlists, authz. Effort: **M–L**.

**Phase 2 — moderation & support.** Content moderation, support notes, reported
content, refund/reconciliation, global settings/kill switch. DB: additive
(`SupportNote`, reconciliation log, `SystemSetting`). Effort: **L–XL**.

**Phase 3 — schools/tenants.** Only if B2B. Additive `tenantId`, tenant admins,
isolation tests. Effort: **XL**.

## 28. Prioritized Implementation Order

1. **PROD-1** lock `users` routes (critical security) — **XS**.
2. **SEC-1** login rate limiting — **S**.
3. **PROD-4** CORS/cookie prod config — **S**.
4. **PROD-2 / PROD-3** `/ready` + migration CI gate — **XS–S**.
5. **Admin Phase 0** (user search, deactivate, revoke sessions) — **S–M**.
6. **PRODP-1** payment oversight (read) + **Admin Phase 1 panel** — **M–L**.
7. **PRODP-3** AI usage/cost view + kill switch — **M**.
8. **PROD-5/6/7** graceful shutdown, structured logs, error monitoring — **S–M**.
9. Nice-to-haves (notifications, question bank, support role, cleanup).

## 29. Effort Estimate

- Critical security + prod-readiness (items 1–4): **~2–3 days**.
- Admin Phase 0: **~2–3 days**.
- Admin Phase 1 panel (backend + frontend): **~4–7 days**.
- **Minimal Admin MVP (Phase 0 + Phase 1) total: ~1.5–2 weeks**, reusing existing
  models (no schema migration required).

## 30. Final Recommendation

**MINIMAL ADMIN REQUIRED BEFORE PRODUCTION.**

The teaching/learning core is strong and should not be rewritten. Before any
production launch you must (a) close the open `users` privilege-escalation/PII hole,
(b) add login rate limiting and production CORS/cookie config, and (c) ship a thin
ADMIN operational layer for account moderation, payment oversight, AI cost control,
and audit-log visibility — all of which **reuse existing models** (no schema change
for Phase 0/1). A full Admin platform and multi-tenancy are **not** warranted yet;
plan them, don't build them. The MVP/demo can launch without an Admin **panel**; a
paying production cannot launch safely without the minimal Admin operational
capability above.
