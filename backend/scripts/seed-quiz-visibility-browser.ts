/**
 * Seeds deterministic quiz-visibility fixtures for browser/manual E2E.
 * Safe for isolated E2E DB only — uses assertLocalDatabase.
 *
 * Usage:
 *   DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:15432/fahimni_e2e_quiz_visibility npx tsx scripts/seed-quiz-visibility-browser.ts
 */
import "dotenv/config";
import { assertLocalDatabase } from "../src/seed/local-guard.js";
import {
  E2E_QV_EMAILS,
  E2E_QV_PASSWORD,
  seedQuizVisibilityE2EFixture,
} from "../src/test/fixtures/quiz-visibility-e2e.fixture.js";

async function main() {
  assertLocalDatabase({
    nodeEnv: process.env.NODE_ENV ?? "development",
    databaseUrl: process.env.DATABASE_URL,
  });

  const fx = await seedQuizVisibilityE2EFixture();

  console.log("Quiz visibility browser fixtures ready.");
  console.log(JSON.stringify({ emails: E2E_QV_EMAILS, password: "[REDACTED]" }, null, 2));
  console.log(JSON.stringify(fx, null, 2));
  console.log("");
  console.log("Login password for all E2E QV users is configured in E2E_QV_PASSWORD (see fixture module).");
  console.log("Login with fixture emails and the E2E fixture password from quiz-visibility-e2e.fixture.ts");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
