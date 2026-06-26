/**
 * E2E setup — runs before the test module imports the app.
 *
 * Points the app at the isolated local test database (TEST_DATABASE_URL) and
 * refuses to run against a non-local host so the normal development database is
 * never touched.
 */
import "dotenv/config";
import { extractHost } from "../seed/local-guard.js";

const testUrl = process.env.TEST_DATABASE_URL;
if (!testUrl) {
  throw new Error("E2E aborted: TEST_DATABASE_URL is not set.");
}

const LOCAL_HOSTS = new Set([
  "localhost",
  "127.0.0.1",
  "::1",
  "postgres",
  "db",
  "host.docker.internal",
]);
const host = extractHost(testUrl);
if (!host || !LOCAL_HOSTS.has(host)) {
  throw new Error("E2E aborted: TEST_DATABASE_URL must point to a local host.");
}

// Redirect the app's Prisma client to the test DB (dotenv won't override this).
process.env.DATABASE_URL = testUrl;
process.env.NODE_ENV = "test";
