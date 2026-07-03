/**
 * Creates an isolated local E2E database and applies migrations.
 * Does NOT touch final_project or other existing databases.
 *
 * Usage:
 *   npx tsx scripts/provision-e2e-db.ts
 *   npx tsx scripts/provision-e2e-db.ts --db=fahimni_e2e_quiz_visibility
 */
import { spawnSync } from "node:child_process";
import pg from "pg";
import { assertLocalDatabase } from "../src/seed/local-guard.js";

const DEFAULT_DB = "fahimni_e2e_quiz_visibility";
const ADMIN_URL =
  process.env.E2E_ADMIN_DATABASE_URL ??
  "postgresql://postgres:postgres@127.0.0.1:15432/postgres";

function dbNameFromArgs(): string {
  const arg = process.argv.find((a) => a.startsWith("--db="));
  return arg?.split("=")[1]?.trim() || DEFAULT_DB;
}

async function main() {
  const dbName = dbNameFromArgs();
  if (!/^[a-z0-9_]+$/.test(dbName)) {
    throw new Error("Invalid database name");
  }

  assertLocalDatabase({
    nodeEnv: process.env.NODE_ENV ?? "development",
    databaseUrl: ADMIN_URL,
  });

  const admin = new pg.Client({ connectionString: ADMIN_URL });
  await admin.connect();

  const exists = await admin.query(
    "SELECT 1 FROM pg_database WHERE datname = $1",
    [dbName],
  );

  if (exists.rowCount === 0) {
    await admin.query(`CREATE DATABASE "${dbName}"`);
    console.log(`Created database: ${dbName}`);
  } else {
    console.log(`Database already exists: ${dbName}`);
  }

  await admin.end();

  const targetUrl = `postgresql://postgres:postgres@127.0.0.1:15432/${dbName}`;
  assertLocalDatabase({
    nodeEnv: process.env.NODE_ENV ?? "development",
    databaseUrl: targetUrl,
  });

  const migrate = spawnSync(
    process.platform === "win32" ? "npx.cmd" : "npx",
    ["prisma", "migrate", "deploy"],
    {
      env: { ...process.env, DATABASE_URL: targetUrl },
      stdio: "inherit",
      shell: true,
    },
  );

  if (migrate.status !== 0) {
    process.exit(migrate.status ?? 1);
  }

  console.log("");
  console.log("E2E database ready.");
  console.log(`TEST_DATABASE_URL=${targetUrl}`);
  console.log(`DATABASE_URL=${targetUrl}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
