# Postman, README, and Database Upgrade Documentation Report

## 1. Executive Summary

Updated the canonical Postman collection to cover STORY-53 promo-code redemption
(added a `STORY-53 — Promo Code Redemption` folder with 16 requests / 49
assertions), extended the local-env preparation script and env template/local
files with the promo fixtures/variables, rewrote the previously-empty root
`README.md` into a complete setup/command/testing guide, and added a prominent,
non-destructive **"Upgrading an Existing Database Created with Older Migrations"**
section. Also fixed two real env-template defects. Newman ran the STORY-53 folder
green twice (49/49). Backend `prisma validate`/`migrate status`/`generate`,
`tsc --noEmit`, `npm run build`, and `npm test` (192) all pass. No commit/push; no
reset/drop/truncate; no real secrets committed.

## 2. Files Inspected

Root `README.md` (empty), `sprints.md`; backend `package.json`, `docker-compose.yml`,
`.env.example`, `prisma/schema.prisma`, all 34 migrations + `migration_lock.toml`,
`prisma/seed.ts`, `scripts/prepare-quiz-postman-e2e.ts`, `vitest.config.ts`,
`vitest.e2e.config.ts`, `src/test/e2e-setup.ts`, `src/app.ts` (routes/health),
promo-code module (routes/controller/service/dto/i18n); `backend/postman/*`;
`Frontend/package.json`, `Frontend/.env.example`, `src/shared/lib/api/client.ts`;
`.gitignore`.

## 3. Postman Changes

- **Canonical collection updated (not duplicated):**
  `backend/postman/Fahimni_Quiz_Generation_Submission_E2E.postman_collection.json`.
- Added folder **`STORY-53 — Promo Code Redemption`** (16 requests). The existing
  `RUN DIRECT — Quiz Generation and Submission E2E` folder and the collection-level
  secret-scan test were preserved. No requests were removed.
- Auth uses the project's real contract: the HttpOnly `access_token` cookie via the
  cookie jar (each role logs in before its block) — no fabricated bearer tokens.
- All scripts are IIFE-wrapped (function scope) to avoid Newman shared-scope
  collisions; assertions are explicit; no secrets logged; runtime values are guarded
  before assignment.

## 4. Environment Variables

- **Template (tracked, placeholders only):**
  `Fahimni_Quiz_Generation_Submission.template.postman_environment.json` — added
  `adminEmail/adminPassword`, `secondStudentEmail/secondStudentPassword`,
  `promoChapterId`, `promoChapterId2`, `alreadyEnrolledChapterId`,
  `invalidPromoCode` (`ZZZZZZZZ`), `acceptLanguage` (`en`), and runtime
  `createdPromoCode`, `secondPromoCode`, `createdEnrollmentId`.
- **Populated local (git-ignored):**
  `Fahimni_Quiz_Generation_Submission.local.postman_environment.json` — written by
  `npm run postman:prepare:quiz-e2e`. Reuses existing `studentEmail/Password`
  (redeemer) and `otherTeacherEmail/Password` (OPERATION, for the 403 test).
- `baseUrl = http://localhost:3000`. Passwords come from `SEED_LOCAL_PASSWORD` and
  exist only in the ignored populated file.

## 5. STORY-53 Postman Flow

Admin login → create code → list codes → create 2nd code → student login → validate
→ **redeem (201, PROMO enrollment, code used)** → verify in `my-courses` → redeem
used code for another chapter (400 used) → redeem fresh code for the enrolled
chapter (400 already-enrolled) → verify fresh code still unused → invalid code (400)
→ 2nd student reuses code (400 used) → no-auth (401) → operation role (403).
Localized messages assert against `{{acceptLanguage}}` (en|ar) and match the backend
`promo-code.i18n.ts`.

## 6. README Changes

Replaced the empty root `README.md` with 21 sections: overview, structure,
prerequisites, install, env config, infrastructure, first-time DB setup, the
existing-database upgrade section, run backend/frontend, setup orders, daily startup,
a command reference table (command / directory / purpose / when / DB impact),
testing matrix, STORY-53 verification, Postman setup, build/production, database
safety, troubleshooting, security, git workflow. Every documented command states its
working directory and database impact; only commands/scripts that actually exist are
referenced.

## 7. First-Time Setup Instructions

Documented an empty-DB order: `docker compose up -d postgres` → `npm install` →
copy `.env` → `npm run db:generate` → `npx prisma migrate deploy` →
`npx prisma migrate status` → `npm run db:seed` → run backend/frontend. Each DB
command annotated with effect and rerun-safety.

## 8. Existing Database Upgrade Instructions

A dedicated, prominent section with a 16-step safe workflow: stop writes → back up
(`docker exec backend-postgres-1 pg_dump`) → pull/install → verify `DATABASE_URL`
target → `migrate status` → **`migrate deploy`** (non-destructive) → `generate` →
verify (build/health/data) → seed only if appropriate → explicit "what not to do" →
failed-migration escalation → drift handling → very-old-DB procedure →
constraint-violation remediation → dev/test/prod distinction → a quick command
sequence prefixed with "back up and verify DATABASE_URL first".

## 9. Old Migration Handling

`migrate deploy` applies all committed pending migrations in order (no skipping, no
new files, data preserved). `migrate dev` is documented as authoring-only and
explicitly **not** the upgrade command for data-bearing databases. `migrate status`
and `generate` are clearly distinguished.

## 10. Failed Migration and Drift Guidance

Failed migrations: stop, inspect, back up, review `_prisma_migrations`, use
`prisma migrate resolve --applied/--rolled-back` only when the real state is
understood — never to hide an error. Drift: inspect via `prisma migrate diff`, do not
reset a data-bearing DB, reconcile with a new forward-only migration, never edit an
applied migration, validate on an isolated DB.

## 11. Command Reference Verification

All referenced repository paths exist (verified). All documented npm scripts exist
(backend: dev, build, start, test, db:generate, db:migrate, db:seed,
db:seed:verify, test:e2e:story48, test:e2e:story53, postman:prepare:quiz-e2e;
frontend: dev, build, lint, test). Noted that the **backend has no `lint`/`typecheck`
script** (use `npm run build` / `npx tsc --noEmit`).

## 12. Postman/Newman Verification

`npm run postman:prepare:quiz-e2e` populated the local env (admin/2nd-student/
chapters). With the backend running, Newman ran the STORY-53 folder **twice**:
**17 requests, 49 assertions, 0 failures** each run. Collection + template JSON
validated with `JSON.parse`.

## 13. Database Safety Review

The existing-database guidance uses only non-destructive commands; `migrate deploy`
is the upgrade path; backup is required before upgrading; `migrate dev` is not
presented as the upgrade command; reset/`db push --force-reset`/DROP/TRUNCATE/`down -v`
are explicitly prohibited; seed is not presented as mandatory; dev vs test vs
production databases are distinguished. No applied migration was edited; no migration
was created in this task.

## 14. Security and Git Hygiene

`git status`/`diff` reviewed. No `.env` tracked; populated local env
(`*.local.postman_environment.json`) and manifests (`*.local.json`) are git-ignored
(`git check-ignore` confirmed). Tracked files contain **0** occurrences of the real
Gemini key or the local seed password. Template + `*.env.example` hold placeholders
only. No commit or push performed.

## 15. Files Modified

Modified: `README.md`, `backend/.env.example` (added `TEST_DATABASE_URL`; corrected
DB host port to 15432), `Frontend/.env.example` (fixed unused `VITE_API_URL` →
`VITE_API_BASE_URL` to match the code), `backend/scripts/prepare-quiz-postman-e2e.ts`
(promo fixtures + vars), `backend/postman/Fahimni_Quiz_Generation_Submission.template.postman_environment.json`,
`backend/postman/Fahimni_Quiz_Generation_Submission_E2E.postman_collection.json`.
Generated (git-ignored): the populated local env. (Other uncommitted files —
promo-code module, its tests, `STORY-53_*` report, `package.json` script — are from
the prior STORY-53 implementation task, not this one.)

## 16. Remaining Warnings

- **Frontend** `npm run build`/`npm run lint` have a **pre-existing** baseline of TS/
  ESLint errors in untouched source files (documented in the prior My-Courses report);
  out of scope here. This task's only frontend change is `Frontend/.env.example`
  (a template, not linted/built).
- `test:e2e:story48` requires a working `GEMINI_API_KEY` and a model the key can use;
  Gemini free-tier latency can intermittently exceed the 20s generation cap.
- The STORY-53 Postman folder makes real promo-code creations (accumulate as local
  test data); the prepare script resets only its own test enrollments.

## 17. Final Status

**Completed** — README contains only existing commands; existing-database
instructions are non-destructive and use `migrate deploy`; backup is required before
upgrades; Postman JSON is valid and all variables resolve (Newman 49/49 twice);
tracked files contain no real secrets; all referenced paths exist.
