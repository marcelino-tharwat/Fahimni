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
  const password = process.env.ADMIN_PASSWORD ?? "YOUR_ADMIN_PASSWORD";
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

  // ─── Teacher ───────────────────────────────────────────────────────
  const teacherEmail = "teacher@example.com";
  const teacherPassword = "Teacher@123456";

  const teacherUser = await prisma.user.upsert({
    where: { email: teacherEmail },
    update: {},
    create: {
      fullName: "Ahmed Hassan",
      email: teacherEmail,
      mobile: "01100000000",
      password: await bcrypt.hash(teacherPassword, 10),
      role: Role.OPERATION,
      teacherProfile: {
        create: {
          subject: "Mathematics",
          bio: "Experienced math teacher with 10 years of teaching experience.",
        },
      },
    },
    include: { teacherProfile: true },
  });

  console.log(`Teacher account ready: ${teacherUser.email}`);

  // ─── Stages (School Grade Levels) ──────────────────────────────────
  const stagesData = [
    { name: "First Preparatory", description: "First year of preparatory school", sortOrder: 1 },
    { name: "Second Preparatory", description: "Second year of preparatory school", sortOrder: 2 },
    { name: "Third Preparatory", description: "Third year of preparatory school", sortOrder: 3 },
    { name: "First Secondary", description: "First year of secondary school", sortOrder: 4 },
    { name: "Second Secondary", description: "Second year of secondary school", sortOrder: 5 },
    { name: "Third Secondary", description: "Third year of secondary school", sortOrder: 6 },
  ];

  const stages = [];
  for (const s of stagesData) {
    const stage = await prisma.stage.upsert({
      where: { id: `seed-stage-${s.sortOrder}` },
      update: { name: s.name, description: s.description },
      create: {
        id: `seed-stage-${s.sortOrder}`,
        name: s.name,
        description: s.description,
        sortOrder: s.sortOrder,
        teacherId: teacherUser.id,
      },
    });
    stages.push(stage);
    console.log(`Stage created: ${stage.name}`);
  }

  // ─── Chapters ──────────────────────────────────────────────────────
  const chaptersData = [
    { name: "Algebra", description: "Algebraic concepts and operations", sortOrder: 1, price: null, stageIdx: 0 },
    { name: "Geometry", description: "Geometric shapes and theorems", sortOrder: 2, price: 49.99, stageIdx: 0 },
    { name: "Algebra", description: "Algebraic concepts and operations", sortOrder: 1, price: null, stageIdx: 1 },
    { name: "Geometry", description: "Geometric shapes and theorems", sortOrder: 2, price: 49.99, stageIdx: 1 },
    { name: "Algebra", description: "Algebraic concepts and operations", sortOrder: 1, price: null, stageIdx: 2 },
    { name: "Geometry", description: "Geometric shapes and theorems", sortOrder: 2, price: 49.99, stageIdx: 2 },
    { name: "Algebra", description: "Algebraic concepts and operations", sortOrder: 1, price: null, stageIdx: 3 },
    { name: "Geometry", description: "Geometric shapes and theorems", sortOrder: 2, price: 49.99, stageIdx: 3 },
    { name: "Algebra", description: "Algebraic concepts and operations", sortOrder: 1, price: null, stageIdx: 4 },
    { name: "Geometry", description: "Geometric shapes and theorems", sortOrder: 2, price: 49.99, stageIdx: 4 },
    { name: "Algebra", description: "Algebraic concepts and operations", sortOrder: 1, price: null, stageIdx: 5 },
    { name: "Geometry", description: "Geometric shapes and theorems", sortOrder: 2, price: 49.99, stageIdx: 5 },
  ];

  for (const ch of chaptersData) {
    const chapter = await prisma.chapter.upsert({
      where: { id: `seed-chapter-${stages[ch.stageIdx].id}-${ch.sortOrder}` },
      update: { name: ch.name, description: ch.description, price: ch.price },
      create: {
        id: `seed-chapter-${stages[ch.stageIdx].id}-${ch.sortOrder}`,
        name: ch.name,
        description: ch.description,
        sortOrder: ch.sortOrder,
        price: ch.price,
        stageId: stages[ch.stageIdx].id,
      },
    });
    console.log(`Chapter created: ${chapter.name}`);
  }
}

main()
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
