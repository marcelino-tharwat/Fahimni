# Fahimni Authentication Session and Refresh Token Repair Report

## 1. Executive Summary

The "browser refresh logs me out" defect was repaired across the existing stack
with minimal, preservation-first changes — no auth system, API client, store,
router, or Prisma model was replaced. The refresh flow already existed on the
backend but was **defective and disconnected**: the refresh token was returned in
JSON and stored in browser `localStorage` (not an HttpOnly cookie), logout never
revoked the DB session, refresh tokens were stored raw, rotation reset the
STORY-66 last-login timestamp, refresh tokens were not unique per issuance, and
the frontend `AuthGuard` redirected during the bootstrap window before
`initAuth` resolved.

After the repair: both tokens are HttpOnly cookies, the refresh token is stored
only as a SHA-256 hash, rotation is atomic/in-place (replay-safe and STORY-66
safe), logout revokes the DB session and clears both cookies, and the frontend
treats the page-load bootstrap as "unknown" (spinner) instead of "logged out".

Status: **COMPLETED WITH WARNINGS** (warnings = pre-existing, unrelated frontend
build/lint failures and the pre-existing `attempts.e2e`/quiz-gen test failures —
all proven independent of this work).

## 2. Initial Git and Environment State

- Branch `feature/story-66-teacher-student-engagement`; clean tree (only pre-existing `package-lock.json` modifications from earlier, untouched).
- Docker Postgres was stopped; brought up via `docker compose up -d postgres` (`.env` already targets `localhost:15432`; `TEST_DATABASE_URL` present). `prisma migrate status`: 39 migrations, up to date.

## 3. Authentication Stories Reviewed

`sprints.md`: STORY-4 (register), STORY-5 (login) — originally "JWT 30-day, refresh
not needed for MVP"; STORY-23 area (navigation shell, route guards, logout). The
codebase evolved beyond MVP to cookie + refresh-token sessions, so the repair
targets the *actual* implementation, not the MVP prose. STORY-66 depends on
`refresh_tokens.createdAt` as a last-login proxy — explicitly preserved (see §13).

## 4. Existing Backend Auth Architecture

Express module at `/api/v1/auth` (login, register, forgot/reset/verify-otp,
**refresh**, **me**, change-password, **logout**). JWT access (15m) + JWT refresh
(7d). `authenticate.middleware` reads `Authorization: Bearer` or the `access_token`
cookie. `RefreshToken` Prisma model persists sessions. CORS: explicit origin
`http://localhost:5173` + `credentials:true`; `cookie-parser`; `trust proxy 1`.

## 5. Existing Frontend Auth Architecture

Single axios `apiClient` (`withCredentials:true`) with a 401 single-flight
interceptor; Redux Toolkit `authSlice` (login/initAuth/validateAuth/logoutUser);
`AuthGuard`/`RoleGuard`; `initAuth` dispatched once from `AppProviders`;
`authCacheSync` clears React Query on logout.

## 6. Reproduced Defects

- **Browser refresh → login redirect:** on reload the first synchronous render has `status:'idle'`, `isAuthenticated:false` (initAuth runs in a post-paint `useEffect`); `AuthGuard` only treated `'loading'` as pending, so `'idle'` fell through to `<Navigate to="/auth">` before bootstrap finished.
- **Refresh token mis-transported:** returned in login/register/refresh JSON and saved to `localStorage["refreshToken"]`; `/refresh` read it from the request body.
- **Logout didn't revoke:** only `clearCookie("access_token")` — the DB `refresh_tokens` row survived, so a captured refresh token still worked after logout.
- **Raw token storage:** the refresh JWT was stored verbatim in `refresh_tokens.token`.
- **Rotation reset STORY-66 last-login:** refresh did delete+create, moving `createdAt` to each refresh time.
- **Non-unique refresh tokens:** `generateRefreshToken` had no `jti`; two tokens minted in the same second were byte-identical, breaking rotation/replay detection (caught by the new E2E).

## 7. Root Causes

Primary (the user-visible bug): `AuthGuard` redirecting during the `idle`
bootstrap window. Secondary (security/correctness): refresh token in JSON +
localStorage instead of an HttpOnly cookie; logout not revoking the DB session;
raw storage; non-unique refresh tokens; rotation altering the STORY-66 proxy.

## 8. Existing Code Reused

Auth routes/controller/service/middleware, `TokenService`, the `RefreshToken`
model (no schema change), the single axios client, the Redux `authSlice` + thunks,
`AuthGuard`/`RoleGuard`, `authCacheSync`, CORS/cookie-parser config — all kept and
repaired in place.

## 9. Minimal Backend Changes

- New `auth.cookies.ts`: one source of truth for cookie names/options (`setAuthCookies`, `setAccessCookie`, `clearAuthCookies`) + `hashRefreshToken` (SHA-256).
- `auth.controller.ts`: login/register/refresh set both cookies via the helper and **no longer return any token in JSON**; refresh reads the `refresh_token` **cookie** (legacy body accepted transitionally); logout revokes the DB session and clears both cookies with matching options.
- `auth.service.ts`: store the refresh token **hashed**; `refreshAccessToken` verifies the JWT then **atomically rotates in place** (`updateMany WHERE token=oldHash` → preserves row id + `createdAt`); added idempotent `logout(rawToken)`; inactive/deleted-user rejected.
- `token.service.ts`: refresh JWT now carries a unique `jti`.

## 10. Minimal Frontend Changes

- `AuthGuard.tsx`: treat `status === 'idle' || 'loading'` as pending (spinner) — never redirect until bootstrap is settled.
- `authSlice.ts`: `initAuth` calls `/auth/me` as the source of truth (no localStorage gate); login/register no longer persist a refresh token.
- `client.ts`: 401 interceptor refreshes via the **cookie** (`POST /v1/auth/refresh` with no body), single-flight, retry-once, excludes auth-flow endpoints; on failure clears state once.
- `token.ts`: removed the refresh-token localStorage setter/getter (kept `removeRefreshToken` only to purge any legacy value on logout).

## 11. Access Token Behavior

Unchanged transport: HttpOnly cookie `access_token`, `Path=/`, 15m, `SameSite=Strict`, `Secure` in production. Verified at runtime: `Max-Age=900; Path=/; HttpOnly; SameSite=Strict`.

## 12. Refresh Token Behavior

HttpOnly cookie `refresh_token`, `Path=/api/v1/auth`, 7d, `SameSite=Strict`, `Secure` in production. Never in JSON, never in browser storage. Persisted only as SHA-256 hash. Runtime confirmed: `Max-Age=604800; Path=/api/v1/auth; HttpOnly; SameSite=Strict`; login response `data` = `{ user }` only.

## 13. Refresh Rotation

Atomic in-place: `updateMany({ where: { token: oldHash, userId, expiresAt > now }, data: { token: newHash, expiresAt } })`. Because it updates the **same row**, `createdAt` is preserved — so STORY-66's last-login proxy keeps reflecting the original login, not each refresh (E2E asserts `createdAt` unchanged after refresh). The unique `jti` guarantees a genuinely new token each rotation.

## 14. Refresh Token Revocation

Old token rejected after rotation (its hash no longer matches → 0 rows → 401). Logout deletes the matching row. Disabled/deleted user → session revoked + rejected.

## 15. Logout Behavior

Backend reads the `refresh_token` cookie, deletes the matching DB row (idempotent — safe if missing/invalid/already-revoked), and clears both cookies with options matching how they were set. Frontend `logoutUser` calls the endpoint then clears state; `authCacheSync` clears React Query. E2E: after logout the DB session count is 0 and the old token returns 401.

## 16. Cookie Configuration

Centralized in `auth.cookies.ts`. `httpOnly:true`; `secure` only in production (localhost HTTP dev works); `SameSite=Strict` (frontend/backend are same-site on localhost ports — documented; a cross-site production deployment would require `SameSite=None; Secure`); refresh `Path=/api/v1/auth`; clear options exactly match set options.

## 17. CORS and Proxy Configuration

Unchanged and correct: explicit origin `http://localhost:5173`, `credentials:true`, `trust proxy 1`. Runtime confirmed `Access-Control-Allow-Origin: http://localhost:5173` + `Access-Control-Allow-Credentials: true`.

## 18. Frontend Bootstrap After Browser Reload

`AppProviders` dispatches `initAuth` → `GET /auth/me`. The HttpOnly `access_token`
cookie persists across reload, so `/me` succeeds; if access has expired, the
interceptor performs one cookie-based refresh and retries. `AuthGuard` shows a
spinner during `idle`/`loading`, eliminating the login-page flash/redirect.

## 19. API Interceptor and Single-Flight Refresh

One in-flight refresh; concurrent 401s queue on it and retry once after success.
`_retry` prevents loops. Auth-flow URLs (refresh/login/logout/register) are
excluded, so a refresh 401 never recurses. On refresh failure: queue rejected,
state cleared once, cache cleared (via `authCacheSync`), guard redirects once.

## 20. Protected Route Behavior

`AuthGuard`: spinner while `idle|loading`; redirect to `/auth` only when settled-unauthenticated; otherwise render. `RoleGuard` already handled `idle|loading` correctly (unchanged). No competing guards added.

## 21. Cache and User Data Clearing

`authCacheSync` clears React Query when `isAuthenticated` flips to false (logout or unrecoverable refresh). Login caches the user object; no cross-account leakage.

## 22. Database and Migration Changes

**None.** The hash fits the existing unique `token` column; rotation/revocation
use existing fields. No new table, no migration, no schema edit.

## 23. Security Review

Refresh token: HttpOnly-cookie only, hashed at rest, unique per issuance, rotated,
revocable, replay-rejected. No token/cookie/password logged. No token in JSON. No
localStorage/sessionStorage token. CORS credentialed with an explicit origin (no
wildcard). Remaining hardening noted in §30.

## 24. Backend Tests

`auth.refresh.e2e.test.ts` (real app + Postgres, run twice, 5/5): login sets
HttpOnly cookies + no JSON token + hashed DB storage; rotation + replay rejection
+ `createdAt` preserved + `/me`; missing/invalid token rejected; logout revokes +
clears cookies + blocks reuse + idempotent; concurrent refresh → exactly one
successor. Existing `authorize.middleware` test still passes.

## 25. Frontend Tests

`authSlice.test.ts` (6): bootstrap states — initial `idle`; `initAuth.pending →
loading`; fulfilled → authenticated; rejected → failed/unauthenticated; login
authenticates; logout clears. `auth-contract.test.ts` (7): single client +
`withCredentials`; cookie-based refresh (no body, no localStorage); single-flight
+ retry-once + auth-flow exclusion; no refresh token in storage; `/auth/me`
bootstrap; guard treats `idle` as pending.

## 26. Full-Stack E2E Verification

Runtime (real server) confirmed the cookie lifecycle end to end (login/refresh/
logout headers, redacted; CORS credentialed). The backend E2E exercises the real
HTTP login→/me→refresh→rotate→replay→logout→revoke→concurrency path against real
Postgres, twice. (No Playwright/Cypress added — none exists in the repo;
browser-reload behavior is covered by the guard/bootstrap reducer tests + the
HttpOnly cookie persistence proven at runtime.)

## 27. Non-Regression Results

- Backend unit/integration: 313 tests, 312 pass; 1 **pre-existing** failure (`quiz-generation` 20s-timeout, unrelated).
- Backend E2E: 63 tests, 61 pass; 2 **pre-existing** `attempts.e2e` STORY-48 failures (quiz-attempt duplicate path — auth works: the other attempts tests + STORY-66 + auth E2E pass).
- Frontend tests: 68 pass (incl. the 13 new).
- STORY-66 dashboard E2E passes → last-login proxy intact.

## 28. Files Created

- `backend/src/modules/auth/auth.cookies.ts`
- `backend/src/modules/auth/auth.refresh.e2e.test.ts`
- `Frontend/src/features/auth/store/authSlice.test.ts`
- `Frontend/src/features/auth/auth-contract.test.ts`
- `AUTH_SESSION_REFRESH_REPAIR_REPORT.md`

## 29. Files Modified

- `backend/src/modules/auth/auth.controller.ts`, `auth.service.ts`, `token.service.ts`
- `Frontend/src/shared/lib/api/client.ts`, `src/features/auth/store/authSlice.ts`, `src/features/auth/lib/token.ts`, `src/shared/components/guards/AuthGuard.tsx`

## 30. Remaining Risks

- **Pre-existing frontend build failure** (`tsc -b` errors in `ProfilePage.tsx`, `shared/mocks/users.ts`, `StudentEngagementPage.tsx`, `TeacherSettingsPage.tsx`) — proven identical with my changes stashed; not caused by this repair, but `npm run build` is red until those unrelated files are fixed. My auth files pass `tsc --noEmit` and lint.
- **Pre-existing lint** (29 errors) in untouched files; my changed files are lint-clean.
- **SameSite=Strict** assumes same-site localhost; a cross-site production frontend would need `SameSite=None; Secure` + matching CORS.
- **Single-device session policy** is preserved (login `deleteMany` for the user). Multi-device sessions and a logout-all/password-change global revocation are future hardening (not in scope; no existing endpoint).
- Replay protection is single-row atomic rotation (no token-family tree); sufficient for the current model.

## 31. Final Status

**COMPLETED WITH WARNINGS.** Browser refresh preserves a valid session; expired
access recovers via one cookie-based refresh; refresh tokens rotate, are stored
hashed, and are revoked on logout; concurrent 401s trigger one refresh; no refresh
token is in JSON or browser storage; no business logic, roles, schema, or
unrelated behavior changed. Warnings are pre-existing, unrelated build/test
failures documented above.
