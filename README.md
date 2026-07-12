# Fahimni

Fahimni is a bilingual (Arabic/English) learning platform: a **Node.js + Express 5 +
Prisma 7 + PostgreSQL** backend and a **React 19 + Vite + TypeScript** frontend.
Core modules: authentication, stages/chapters/lessons content, enrollments,
promo codes, AI quiz generation (Gemini + pgvector RAG), quiz attempts/grading.

> All command blocks state their **working directory**. Backend commands run from
> `backend/`, frontend commands from `Frontend/`. There is no root `package.json`.

---

## 1. Project Overview

- **backend/** — Express API (port `3000`), Prisma ORM, PostgreSQL (pgvector),
  Zod validation, Vitest tests, Gemini client + RAG, JWT auth via an HttpOnly
  `access_token` cookie.
- **Frontend/** — React 19 SPA (Vite dev server port `5173`) calling the backend
  under `/api`.
- **PostgreSQL** runs in Docker (`pgvector/pgvector:pg16`), host port `15432`.

## 2. Repository Structure

```text
Fahimni/
├── backend/
│   ├── src/                     # Express app, modules, shared, config
│   │   ├── app.ts               # route mounting (/api/...), /health
│   │   ├── server.ts            # entry point (port from .env PORT=3000)
│   │   ├── modules/             # auth, content, enrollment, promo-code, quizzes, ai, ...
│   │   ├── config/              # database.ts (Prisma client), env.ts (Zod-validated env)
│   │   └── test/e2e-setup.ts    # points E2E at TEST_DATABASE_URL
│   ├── prisma/
│   │   ├── schema.prisma
│   │   ├── migrations/          # committed migration history
│   │   └── seed.ts              # local General-Secondary seed (idempotent)
│   ├── scripts/prepare-quiz-postman-e2e.ts   # populates the local Postman env
│   ├── postman/                 # collection + env template (+ ignored local env)
│   ├── docker-compose.yml       # postgres service (host 15432 -> container 5432)
│   ├── .env.example
│   ├── vitest.config.ts         # unit/integration (excludes *.e2e.test.ts)
│   └── vitest.e2e.config.ts     # E2E (*.e2e.test.ts, uses TEST_DATABASE_URL)
├── Frontend/
│   ├── src/
│   ├── .env.example             # VITE_API_BASE_URL
│   └── package.json
└── README.md
```

## 3. Prerequisites

- **Node.js** 20+ (the toolchain targets modern Node; tested on Node 22).
- **npm** (bundled with Node).
- **Docker Desktop** (for PostgreSQL via Docker Compose).
- **Git**.
- **Postman** (optional, for the API collection) and/or **Newman** via `npx newman`
  (no global install required).

> Versions other than Node are intentionally not pinned beyond "recent stable".

## 4. Clone and Install

```bash
# Bash / PowerShell
git clone <repository-url> Fahimni
cd Fahimni

# Backend deps
cd backend
npm install

# Frontend deps (separate terminal or after)
cd ../Frontend
npm install
```

`npm install` installs dependencies (changes `node_modules`, not the database).
Safe to rerun.

## 5. Environment Configuration

Copy the example env files and fill in local values. **Never commit `.env`** (it is
git-ignored; only `*.env.example` is tracked).

```bash
# Bash — from repo root
cp backend/.env.example backend/.env
cp Frontend/.env.example Frontend/.env
```

```powershell
# PowerShell — from repo root
Copy-Item backend/.env.example backend/.env
Copy-Item Frontend/.env.example Frontend/.env
```

Backend `.env` (key variables; secrets marked):

| Variable | Purpose | Secret |
|---|---|---|
| `PORT` | Backend port (default 3000) | no |
| `NODE_ENV` | `development` locally | no |
| `DATABASE_URL` | Dev DB, e.g. `postgresql://postgres:postgres@localhost:15432/final_project` | yes |
| `TEST_DATABASE_URL` | Isolated E2E DB, e.g. `.../final_project_test` (must be local, separate) | yes |
| `JWT_SECRET` / `JWT_REFRESH_SECRET` | Auth signing keys (≥64 chars) | yes |
| `JWT_EXPIRES_IN` / `JWT_REFRESH_EXPIRES_IN` | Token lifetimes | no |
| `ADMIN_*` | Seeded admin defaults | yes (password) |
| `CLOUDINARY_*`, `SUPABASE_*`, `EMAIL_*` | Media/storage/email integrations | yes |
| `GEMINI_API_KEY` | Gemini key for AI quiz generation + embeddings | yes |
| `GEMINI_GENERATION_MODEL` / `GEMINI_EMBEDDING_MODEL` | Models (must match the pgvector dimension) | no |
| `SEED_LOCAL_PASSWORD` | Deterministic password for local seed/Postman accounts | yes |

Frontend `.env`:

| Variable | Purpose |
|---|---|
| `VITE_API_BASE_URL` | Backend base URL (default `http://localhost:3000/api`) |

`DATABASE_URL` and `TEST_DATABASE_URL` **must point to different databases**. The
backend validates required env at startup (`src/config/env.ts`).

## 6. Start Infrastructure (PostgreSQL)

All from `backend/`. Service name: `postgres`; container: `backend-postgres-1`.

```bash
docker compose up -d postgres     # start PostgreSQL (creates volume on first run); data-bearing
docker compose ps                 # status (read-only)
docker compose logs -f postgres   # follow logs (read-only)
docker compose stop postgres      # stop container, KEEP data
docker compose down               # remove containers, KEEP the named volume (data preserved)
```

> Do **not** run `docker compose down -v` for a normal stop — `-v` deletes the
> `postgres_data` volume and **destroys all local data**.

## 7. First-Time Database Setup (empty local database)

From `backend/`, in order:

```bash
docker compose up -d postgres          # 1. start PostgreSQL
npm install                            # 2. backend deps (if not done)
cp .env.example .env                   # 3. env (PowerShell: Copy-Item .env.example .env)
# 4. set DATABASE_URL in .env to the local dev DB
npm run db:generate                    # 5. generate Prisma Client (code only; no DB change)
npx prisma migrate deploy              # 6. apply all committed migrations (creates schema)
npx prisma migrate status              # 7. confirm "Database schema is up to date!"
npm run db:seed                        # 8. seed local fixtures (idempotent, local-only)
npm run postman:prepare:quiz-e2e       # 9. (optional) populate the local Postman env
```

Database command meanings:

| Command | What it does | DB impact | Rerun-safe |
|---|---|---|---|
| `npm run db:generate` (`prisma generate`) | Regenerates the typed Prisma Client | none (code only) | yes |
| `npx prisma migrate deploy` | Applies committed migrations not yet recorded | creates/alters schema; preserves data unless a migration is destructive | yes (no-op when up to date) |
| `npx prisma migrate status` | Reports applied/pending/failed/drift | none (read-only) | yes |
| `npm run db:seed` | Upserts local dev fixtures (refuses non-local DB) | inserts/updates fixture rows | yes (idempotent) |
| `npm run db:seed:verify` | Read-only assertions on seeded data | none | yes |
| `npm run db:reset-seed` | **Drops and recreates** the local dev DB (`prisma migrate reset --force`), then reseeds | destroys all current data, then reapplies migrations + fixtures | yes, but destructive each time |

To fully reset your local dev database back to a clean, fully-seeded state (e.g. after pulling schema changes, or if your local data has drifted), from `backend/`:

```bash
npm run db:reset-seed
```

This is equivalent to `npx prisma migrate reset --force && npm run db:seed` — the `reset` step already re-runs the seed automatically (via the `prisma.seed` config in `package.json`), and the explicit `db:seed` afterward is a redundant safety net in case that ever changes. Only run this against your **local** `DATABASE_URL` — it refuses non-local hosts (see `assertLocalDatabase` in the seed script) but there's no substitute for checking `.env` first.

---

## ⚠️ Upgrading an Existing Database Created with Older Migrations

**Read this if you already ran Fahimni locally, your PostgreSQL already has data,
the database was created from older migrations, new migrations were added since, and
you want to keep your data.** This workflow is non-destructive.

> **Before you start: back up the database and confirm which database
> `DATABASE_URL` targets.**

### Step 1 — Stop application writes
Stop the backend (`Ctrl+C` on `npm run dev`, and any `npm start`). This prevents new
writes while the schema changes are applied.

### Step 2 — Back up the existing database
From `backend/` (container `backend-postgres-1`, user `postgres`, DB `final_project`):

```bash
# Bash
docker exec -t backend-postgres-1 pg_dump -U postgres -d final_project > backup_$(date +%Y%m%d_%H%M%S).sql
```
```powershell
# PowerShell
docker exec -t backend-postgres-1 pg_dump -U postgres -d final_project > "backup_$(Get-Date -Format yyyyMMdd_HHmmss).sql"
```
Backups are **strongly recommended** before applying migrations. Verify the file
exists and is non-empty before continuing. (Adjust container/user/DB names if your
setup differs; do not put real passwords in committed files.)

### Step 3 — Pull the latest code and install dependencies
```bash
git pull
cd backend && npm install
```

### Step 4 — Verify the target database
Open `backend/.env` and confirm `DATABASE_URL` points to the **intended local**
database. Optionally check which DB you are connected to:
```bash
docker exec -it backend-postgres-1 psql -U postgres -d final_project -c "SELECT current_database();"
```
> **Never run migration commands until you confirm which database `DATABASE_URL`
> targets.**

### Step 5 — Inspect migration status
```bash
npx prisma migrate status     # from backend/, read-only
```
Interpretation:
- *"Database schema is up to date"* → nothing to apply.
- *"following migrations have not yet been applied"* → pending migrations (Step 6).
- *History divergence / "applied but missing locally"* → branch mismatch; inspect before acting.
- *"failed migration"* → go to **Step 11**.
- *Schema drift* → go to **Step 12**.

### Step 6 — Apply pending migrations safely
For an existing, data-bearing database, use **deploy** (not `migrate dev`):
```bash
npx prisma migrate deploy     # from backend/
```
- Applies committed migrations that are not yet recorded as applied.
- Does **not** create new migration files.
- Preserves existing data unless a migration itself contains destructive SQL.

Distinguish the commands:
- `prisma migrate deploy` — apply committed migrations to an existing/shared DB (use this for upgrades).
- `prisma migrate dev` (`npm run db:migrate`) — **authoring only**: diffs the schema and may create/apply a new migration and can prompt to reset on drift. Do **not** use it to upgrade a data-bearing database.
- `prisma migrate status` — read-only report.
- `prisma generate` — regenerate the client; no DB change.

### Step 7 — Regenerate the Prisma Client
```bash
npm run db:generate    # (prisma generate) updates generated client code; no data change
```

### Step 8 — Verify after migration
```bash
npx prisma migrate status   # expect up to date
npm run build               # tsc typecheck/compile
npm run dev                 # start backend
curl http://localhost:3000/health   # expect {"status":"ok"}
```
Spot-check that important rows are still present (e.g. `SELECT count(*) FROM "User";`).

### Step 9 — Seed only when appropriate
- Seeding is **not** automatically required after a migration.
- Do not run the seed blindly on a DB containing real local data.
- The Fahimni seed is **idempotent and local-only** (it refuses non-local hosts) and
  upserts development fixtures; it does not wipe data. Postman preparation
  (`postman:prepare:quiz-e2e`) is separate from schema migration.

### Step 10 — What NOT to do during a normal upgrade
> Do **not** run any of these on a data-bearing database:
> `prisma migrate reset`, `prisma db push --force-reset`, `DROP DATABASE`,
> `DROP TABLE`, `TRUNCATE`, or `docker compose down -v`. They can destroy data.

### Step 11 — If migration status reports a FAILED migration
1. Stop. Do not rerun random migration commands.
2. Inspect the failed migration SQL and the actual database state.
3. Back up the database (Step 2).
4. Review the `_prisma_migrations` records and the live schema.
5. Use `npx prisma migrate resolve` **only** once you understand the real state — to
   mark a migration `--applied` if it was genuinely completed manually, or
   `--rolled-back` if it was reverted. Never mark a migration applied just to hide an
   error.
6. Document the exact situation before changing migration history.

### Step 12 — If Prisma reports schema DRIFT
- Drift = the live schema differs from the committed migration history.
- Do not immediately reset a database with data.
- Inspect the diff:
  ```bash
  npx prisma migrate diff --from-migrations ./prisma/migrations --to-schema-datamodel ./prisma/schema.prisma --script
  ```
- Determine whether the DB was changed manually.
- Reconcile with a **new forward-only** migration when required. Never edit an
  already-applied migration to hide drift. Validate against a fresh temporary/test
  database first. Escalate if it cannot be reconciled safely.

### Step 13 — If the database is very old (many pending migrations)
1. Back up. 2. Confirm all migration files are present. 3. `npx prisma migrate status`.
4. `npx prisma migrate deploy` (applies all pending **in order** — do not skip any).
5. Verify the result and `npm run db:generate`. 6. Run smoke checks. 7. Confirm data intact.

### Step 14 — If a new migration fails because existing data violates a new constraint
Do **not** auto-delete conflicting rows. Inspect them (duplicate rows for a new unique
constraint, nulls for a new NOT NULL, invalid FKs, removed enum values), back up, fix
the data intentionally, rerun the migration, and document the manual remediation.

### Step 15 — Development vs test vs production databases
- `DATABASE_URL` → your local **development** database.
- `TEST_DATABASE_URL` → an **isolated local E2E** database (e.g. `final_project_test`).
- E2E tests must **never** use the development or production database.
- Validate migrations against an isolated DB first where practical. Destructive
  commands are not part of the normal workflow.

### Step 16 — Quick upgrade sequence (existing database)
> **Back up the database and verify `DATABASE_URL` before running these.**
```bash
cd backend
npm install
npx prisma migrate status
npx prisma migrate deploy
npm run db:generate
npx prisma migrate status
npm run build
npm run dev
```

---

## 8. Run the Backend

```bash
cd backend
npm run dev      # tsx watch, hot reload, port 3000
```
- API base: `http://localhost:3000/api`
- Health: `http://localhost:3000/health` → `{"status":"ok"}`

## 9. Run the Frontend

```bash
cd Frontend
npm run dev      # Vite dev server, port 5173
```
- App: `http://localhost:5173`
- Backend URL via `VITE_API_BASE_URL` (default `http://localhost:3000/api`).

Run backend and frontend in **separate terminals**.

## 10. Recommended First-Time Setup Order (empty DB)

```bash
cd backend && npm install
cp .env.example .env            # then edit DATABASE_URL / TEST_DATABASE_URL / secrets
docker compose up -d postgres
npm run db:generate
npx prisma migrate deploy
npx prisma migrate status
npm run db:seed
npm run dev                     # terminal 1
# terminal 2:
cd Frontend && npm install && cp .env.example .env && npm run dev
```

## 11. Existing Database Upgrade Order (preserve data)

Use the **⚠️ Upgrading an Existing Database** section above (Step 16 quick sequence).
Do **not** combine it with first-time setup or run the seed blindly.

## 12. Daily Development Startup

```bash
cd backend && docker compose up -d postgres && npm run dev   # terminal 1
cd Frontend && npm run dev                                   # terminal 2
```
After pulling changes that include new migrations, run `npx prisma migrate deploy`
then `npm run db:generate` from `backend/` before `npm run dev`.

## 13. Available Commands Reference

| Command | Directory | Purpose | When to use | DB impact |
|---|---|---|---|---|
| `npm run dev` | backend | Start API (hot reload, :3000) | development | reads/writes via API |
| `npm run build` | backend | `tsc` compile + typecheck | verify/build | none |
| `npx tsc --noEmit` | backend | Typecheck only (no script alias) | verify | none |
| `npm start` | backend | Run compiled `dist/server.js` | production-like | reads/writes via API |
| `npm test` | backend | Vitest unit/integration (excludes E2E) | verify | none (DB mocked) |
| `npx prisma validate` | backend | Validate `schema.prisma` | verify | none |
| `npm run db:generate` | backend | Generate Prisma Client | after schema/migration changes | none |
| `npx prisma migrate status` | backend | Migration report | before/after upgrades | none |
| `npx prisma migrate deploy` | backend | Apply committed migrations | new/existing DB upgrade | schema (data preserved) |
| `npm run db:migrate` (`prisma migrate dev`) | backend | **Author** a new migration | creating migrations only | schema + may prompt reset |
| `npm run db:seed` | backend | Seed local fixtures (idempotent, local-only) | local data | inserts/updates fixtures |
| `npm run db:reset-seed` | backend | **Drop + recreate** local DB, then reseed | full local reset | destroys then reseeds |
| `npm run db:seed:verify` | backend | Read-only seed checks | after seeding | none |
| `npm run test:e2e:story48` | backend | Quiz E2E (needs TEST DB + Gemini) | E2E | writes to **test** DB only |
| `npm run test:e2e:story53` | backend | Promo redemption E2E (needs TEST DB) | E2E | writes to **test** DB only |
| `npm run postman:prepare:quiz-e2e` | backend | Populate local Postman env from DB | before Postman/Newman | inserts/updates local fixtures |
| `npm run dev` | Frontend | Vite dev server (:5173) | development | none |
| `npm run build` | Frontend | `tsc -b && vite build` | build | none |
| `npm run lint` | Frontend | ESLint | verify | none |
| `npm test` | Frontend | Vitest (unit) | verify | none |

> The **backend has no `lint` or `typecheck` npm script**; use `npm run build`
> (or `npx tsc --noEmit`) for typechecking. Linting is configured on the **frontend**.

## 14. Testing

```bash
# Backend unit/integration (no server; DB mocked) — from backend/
npm test

# Backend E2E — needs Docker PostgreSQL + a migrated TEST database:
docker exec -i backend-postgres-1 psql -U postgres -c "CREATE DATABASE final_project_test"   # once, if missing
# Bash:
DATABASE_URL="$TEST_DATABASE_URL" npx prisma migrate deploy
# PowerShell:
#   $env:DATABASE_URL=$env:TEST_DATABASE_URL; npx prisma migrate deploy
npm run test:e2e:story53     # promo redemption (no Gemini needed)
npm run test:e2e:story48     # quiz generation/submission (needs a working GEMINI_API_KEY)
```

Test prerequisites:

| Test | PostgreSQL | Test DB | Backend server | Gemini | Docker |
|---|---|---|---|---|---|
| `npm test` (backend) | no (mocked) | no | no | no | no |
| `test:e2e:story53` | yes | yes | in-process | no | yes |
| `test:e2e:story48` | yes | yes | in-process | yes | yes |
| Frontend `npm test` | no | no | no | no | no |

## 15. STORY-53 Promo-Code Verification

- **Endpoint:** `POST /api/promo-codes/redeem` (student role; HttpOnly cookie auth).
- **Body:** `{ "code": "ABCDEFGH", "chapterId": "<uuid>" }`
- **Headers:** `Content-Type: application/json`, optional `Accept-Language: ar|en`.
- **Success (201):** creates an `ACTIVE` enrollment with `paymentMethod = PROMO`,
  marks the code used (`isUsed`, `usedAt`, `usedByStudentId`), returns
  `{ enrollment, promoCode }`. The chapter then appears in
  `GET /api/content/student/my-courses`.
- **Errors (400, localized):** invalid code → «الكود غير صالح» / "Invalid code";
  used code → «تم استخدام هذا الكود من قبل» / "Code already used"; already enrolled →
  «أنت مشترك بالفعل في هذا الفصل» / "Already enrolled in this chapter".
  Also `401` unauthenticated, `403` non-student, `404` chapter not found.
- **Postman folder:** `STORY-53 — Promo Code Redemption` in the collection below.
- **Fixture prep:** `npm run postman:prepare:quiz-e2e` (backend dir).
- **Newman:**
  ```bash
  npx newman run postman/Fahimni_Quiz_Generation_Submission_E2E.postman_collection.json \
    -e postman/Fahimni_Quiz_Generation_Submission.local.postman_environment.json \
    --folder "STORY-53 — Promo Code Redemption" --delay-request 300
  ```

## 16. Postman Setup

1. Start PostgreSQL and the backend (`docker compose up -d postgres`, `npm run dev`).
2. Seed + prepare the local environment:
   ```bash
   cd backend
   npm run db:seed
   npm run postman:prepare:quiz-e2e
   ```
3. In Postman, **Import** the collection:
   `backend/postman/Fahimni_Quiz_Generation_Submission_E2E.postman_collection.json`
4. **Import** the **populated, git-ignored** environment:
   `backend/postman/Fahimni_Quiz_Generation_Submission.local.postman_environment.json`
   (generated by the prepare command).
5. Do **not** use the tracked template
   (`...template.postman_environment.json`) as your runtime environment — it has
   empty credentials by design.
6. **Select** the imported local environment (top-right).
7. Open the **`STORY-53 — Promo Code Redemption`** folder and **Run** it (Collection
   Runner). The `RUN DIRECT — Quiz Generation and Submission E2E` folder is also
   available.
8. Review the assertions (all green when fixtures are prepared and the backend runs).

Auto-filled at run time: login uses the HttpOnly cookie jar (no token variables),
and `createdPromoCode`, `secondPromoCode`, `createdEnrollmentId` are captured by
test scripts. Emails/passwords/chapter ids are filled by the prepare command.

## 17. Build and Production Run

```bash
# Backend
cd backend
npm run build      # tsc -> dist/
npm start          # node dist/server.js (needs generated Prisma Client + env + DB)

# Frontend
cd Frontend
npm run build      # -> dist/ static assets
npm run preview    # preview the production build locally
```

## 18. Database Safety

- Always verify which database `DATABASE_URL`/`TEST_DATABASE_URL` targets before running migrations.
- Always back up before upgrading an existing, data-bearing database.
- Use the isolated `TEST_DATABASE_URL` database for E2E — never dev/production.
- Do not use `migrate reset`, `db push --force-reset`, `DROP`/`TRUNCATE`, or `down -v` in a normal workflow.
- Do not edit already-applied migrations; reconcile drift with new forward-only migrations.
- Apply committed pending migrations in order with `prisma migrate deploy`.

## 19. Troubleshooting

| Symptom | Likely cause | Diagnostic | Safe solution |
|---|---|---|---|
| Backend can't connect to DB | PostgreSQL not running | `docker compose ps` | `docker compose up -d postgres` |
| Port 3000/5173/15432 in use | another process bound | check the listener | stop the other process or change the port |
| `@prisma/client did not initialize` | client not generated | — | `npm run db:generate` (backend) |
| Missing table/column after pulling | new pending migrations | `npx prisma migrate status` | `npx prisma migrate deploy` then `npm run db:generate` |
| Failed migration reported | partial/failed apply | `npx prisma migrate status` | follow **Step 11** (do not reset) |
| Schema drift reported | manual DB change | `prisma migrate diff ...` | follow **Step 12** (new forward migration) |
| Old local DB far behind | many pending migrations | `npx prisma migrate status` | back up, then `migrate deploy` (Step 13) |
| New migration fails on existing data | constraint vs existing rows | inspect offending rows | fix data, rerun (Step 14) — never auto-delete |
| Frontend can't reach backend | wrong/missing `VITE_API_BASE_URL` or backend down | check `Frontend/.env`, `/health` | set `VITE_API_BASE_URL`, start backend |
| Postman `{{var}}` unresolved | environment not selected/populated | check top-right env | select the **local** env; run `postman:prepare:quiz-e2e` |
| Populated env empty | prepare not run / wrong file imported | inspect env values | run prepare; import the `.local.` env, not the template |
| E2E fails: TEST DB | `TEST_DATABASE_URL` unset or not migrated | `npx prisma migrate status` against it | set it; create + `migrate deploy` the test DB |
| Quiz generation 422/timeout | Gemini latency/quota/model | backend logs | retry; ensure a working `GEMINI_API_KEY`/model |

> Reset is **not** a first-line fix. Prefer status → deploy → generate.

## 20. Security Notes

- Never commit `.env` (any), populated Postman environments, tokens, cookies, real
  passwords, or API keys. `*.env.example` and `*.template.postman_environment.json`
  contain placeholders only.
- The populated local Postman environment
  (`*.local.postman_environment.json`) and seed manifests (`*.local.json`) are
  git-ignored. Keep them local.
- The local seed/Postman password comes from `SEED_LOCAL_PASSWORD` and is written
  only into the git-ignored populated environment.

## 21. Git Workflow

The repository uses feature branches merged via pull requests into the default
branch. Use clear branch names and PRs; this README does not mandate a specific
policy beyond not committing secrets.
