// Apply the add_rejection_mode migration to the test database
import { PrismaClient } from "./src/generated/prisma/client.js";

const prisma = new PrismaClient({
  datasources: { db: { url: process.env.TEST_DATABASE_URL || "postgresql://postgres:postgres@localhost:15432/final_project_test" } },
});

async function main() {
  // Create enum if not exists
  try {
    await prisma.$executeRawUnsafe("CREATE TYPE \"RejectionMode\" AS ENUM ('EDIT_ALLOWED', 'FINAL_REJECTION')");
    console.log("Enum created");
  } catch (e: any) {
    console.log("Enum may already exist:", e.message?.slice(0, 80));
  }

  // Add column if not exists
  try {
    await prisma.$executeRawUnsafe("ALTER TABLE teacher_registration_requests ADD COLUMN \"rejectionMode\" \"RejectionMode\"");
    console.log("Column added");
  } catch (e: any) {
    console.log("Column may already exist:", e.message?.slice(0, 80));
  }

  await prisma.$disconnect();
}

main().catch(console.error);
