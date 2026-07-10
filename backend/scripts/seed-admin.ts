import "dotenv/config";
import bcrypt from "bcryptjs";
import { v5 as uuidv5 } from "uuid";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client.js";

const SEED_NAMESPACE = "f5a0b1c2-d3e4-4f6a-a8bc-9d0e1f2a3b4c";
const sid = (key: string) => uuidv5(`fahimni-seed:${key}`, SEED_NAMESPACE);

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
});
const prisma = new PrismaClient({ adapter });

async function seedAdminOnly() {
  const email = process.env.ADMIN_EMAIL ?? "admin@example.com";
  const password = process.env.ADMIN_PASSWORD ?? "Admin@123456";
  const fullName = process.env.ADMIN_FULL_NAME ?? "System Administrator";
  const mobile = process.env.ADMIN_MOBILE ?? "01000000000";

  const passwordHash = await bcrypt.hash(password, 12);

  const admin = await prisma.user.upsert({
    where: { email },
    update: { status: "ACTIVE", fullName },
    create: {
      id: sid("admin"),
      email,
      fullName,
      mobile,
      password: passwordHash,
      role: "ADMIN",
      status: "ACTIVE",
    },
  });

  console.log(`Admin seeded: ${admin.email} / ${password}`);
  await prisma.$disconnect();
}

seedAdminOnly().catch((e) => {
  console.error("Failed to seed admin:", e);
  process.exitCode = 1;
  prisma.$disconnect();
});
