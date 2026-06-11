import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, Role } from "../src/generated/prisma/client.js";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});

const prisma = new PrismaClient({ adapter });

async function main() {
  const email = process.env.ADMIN_EMAIL ?? "admin@example.com";
  const password = process.env.ADMIN_PASSWORD ?? "Admin@123456";
  const fullName = process.env.ADMIN_FULL_NAME ?? "System Administrator";
  const mobile = process.env.ADMIN_MOBILE ?? "01000000000";

  const hashedPassword = await bcrypt.hash(password, 10);

  const admin = await prisma.user.upsert({
    where: { email },
    update: {
      fullName,
      mobile,
      password: hashedPassword,
      role: Role.ADMIN,
    },
    create: {
      email,
      fullName,
      mobile,
      password: hashedPassword,
      role: Role.ADMIN,
    },
  });

  console.log(`Admin account ready: ${admin.email} (${admin.role})`);
}

main()
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
