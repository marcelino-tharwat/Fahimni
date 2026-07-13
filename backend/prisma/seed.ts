import "dotenv/config";
import { prisma } from "../src/config/database.js";
import { assertLocalDatabase } from "../src/seed/local-guard.js";
import { runLargeSeed } from "./seeds/large-seed.js";

/**
 * Fahimni — Production Seed
 *
 * Populates the database with comprehensive, realistic Arabic data:
 *   - 5 Admins, 10 Operations, 30 Teachers, 500 Students
 *   - 3 Stages × 10 Chapters × 5 Lessons = 150 Lessons
 *   - 60+ Quizzes with 300+ Questions (Arabic content)
 *   - 5000+ Enrollments with PaymentTransactions
 *   - 3000+ LessonProgress records
 *   - 2000+ QuizAttempts
 *   - 5000+ Notifications
 *   - Platform Promo Codes, Teacher Subscriptions, Audit Logs
 *
 * Idempotent: safe to re-run via `npx prisma db seed`.
 * Local-only: refuses to run against non-local databases.
 */
async function main() {
  console.log("┌─────────────────────────────────────────────┐");
  console.log("│  Fahimni — Database Seed                    │");
  console.log("│  Environment: " + (process.env.NODE_ENV ?? "development"));
  console.log("└─────────────────────────────────────────────┘\n");

  assertLocalDatabase({
    nodeEnv: process.env.NODE_ENV,
    databaseUrl: process.env.DATABASE_URL,
  });

  try {
    await runLargeSeed(prisma);

    console.log("✅ Seed completed successfully!");
    console.log("\nDefault login credentials:");
    console.log("  Admin:    admin@fahimni.com / Pass@1234");
    console.log("  Teachers: See users created in seed");
    console.log("  Students: See users created in seed");
  } catch (error) {
    console.error("❌ Seed failed:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
