import "dotenv/config";
import { writeFileSync } from "node:fs";
import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, Role } from "../src/generated/prisma/client.js";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});

const prisma = new PrismaClient({ adapter });

// Track what the seed reused vs created vs updated (for the local data file).
const changes: { reused: string[]; created: string[]; updated: string[] } = {
  reused: [],
  created: [],
  updated: [],
};

async function userExists(email: string): Promise<boolean> {
  return (
    (await prisma.user.findUnique({ where: { email }, select: { id: true } })) !==
    null
  );
}
async function stageExists(id: string): Promise<boolean> {
  return (
    (await prisma.stage.findUnique({ where: { id }, select: { id: true } })) !==
    null
  );
}
async function chapterExists(id: string): Promise<boolean> {
  return (
    (await prisma.chapter.findUnique({ where: { id }, select: { id: true } })) !==
    null
  );
}
async function lessonExists(id: string): Promise<boolean> {
  return (
    (await prisma.lesson.findUnique({ where: { id }, select: { id: true } })) !==
    null
  );
}

async function main() {
  // ─── Admin (existing) ──────────────────────────────────────────────
  const email = process.env.ADMIN_EMAIL ?? "admin@example.com";
  const password = process.env.ADMIN_PASSWORD ?? "Admin@123456";
  const fullName = process.env.ADMIN_FULL_NAME ?? "System Administrator";
  const mobile = process.env.ADMIN_MOBILE ?? "01000000000";

  const hashedPassword = await bcrypt.hash(password, 10);

  const adminExisted = await userExists(email);
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
  (adminExisted ? changes.updated : changes.created).push(
    `Admin user (${admin.email})`,
  );
  console.log(`Admin account ready: ${admin.email} (${admin.role})`);

  // ─── Teacher A (existing) ──────────────────────────────────────────
  const teacherEmail = "teacher@example.com";
  const teacherPassword = "Teacher@123456";

  const teacherAExisted = await userExists(teacherEmail);
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
  (teacherAExisted ? changes.reused : changes.created).push(
    `Teacher A user (${teacherUser.email})`,
  );
  console.log(`Teacher A account ready: ${teacherUser.email}`);

  // ─── Teacher A Stages (existing) ───────────────────────────────────
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
    const id = `seed-stage-${s.sortOrder}`;
    const existed = await stageExists(id);
    const stage = await prisma.stage.upsert({
      where: { id },
      update: { name: s.name, description: s.description },
      create: {
        id,
        name: s.name,
        description: s.description,
        sortOrder: s.sortOrder,
        teacherId: teacherUser.id,
      },
    });
    stages.push(stage);
    (existed ? changes.reused : changes.created).push(
      `Teacher A stage "${stage.name}" (${stage.id})`,
    );
    console.log(`Stage ready: ${stage.name}`);
  }

  // ─── Teacher A Chapters (existing) ─────────────────────────────────
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
    const id = `seed-chapter-${stages[ch.stageIdx]!.id}-${ch.sortOrder}`;
    const existed = await chapterExists(id);
    const chapter = await prisma.chapter.upsert({
      where: { id },
      update: { name: ch.name, description: ch.description, price: ch.price },
      create: {
        id,
        name: ch.name,
        description: ch.description,
        sortOrder: ch.sortOrder,
        price: ch.price,
        stageId: stages[ch.stageIdx]!.id,
      },
    });
    (existed ? changes.reused : changes.created).push(
      `Teacher A chapter "${chapter.name}" (${chapter.id})`,
    );
    console.log(`Chapter ready: ${chapter.name}`);
  }

  // Designated Teacher A chapters (stage 1 = "First Preparatory"):
  //  - Algebra  (price null  / free) → will hold multiple lessons
  //  - Geometry (price 49.99 / paid) → kept empty (no lessons)
  const multiLessonChapterId = `seed-chapter-${stages[0]!.id}-1`; // Algebra (free)
  const emptyChapterId = `seed-chapter-${stages[0]!.id}-2`; // Geometry (paid)

  // ─── Teacher A Lessons (NEW) ───────────────────────────────────────
  // Stored sortOrder values are intentionally varied. pdfUrls hold S3
  // object KEYS only (never full/presigned URLs). Nullable fields are
  // exercised on lesson 2.
  const teacherALessons = [
    {
      sortOrder: 1,
      title: "Introduction to Algebra",
      description: "Variables, expressions and basic operations.",
      durationMinutes: 25,
      youtubeUrl: "https://www.youtube.com/watch?v=algebra1",
      pdfUrls: [
        `lessons/${multiLessonChapterId}/intro-slides.pdf`,
        `lessons/${multiLessonChapterId}/intro-exercises.pdf`,
      ] as string[] | null,
    },
    {
      sortOrder: 2,
      title: "Linear Equations",
      description: null, // nullable description
      durationMinutes: 40,
      youtubeUrl: "https://youtu.be/linear2", // youtu.be host
      pdfUrls: null, // nullable pdfUrls
    },
    {
      sortOrder: 3,
      title: "Quadratic Equations",
      description: "Solving quadratics by factoring and the formula.",
      durationMinutes: 55,
      youtubeUrl: "https://m.youtube.com/watch?v=quad3", // m.youtube.com host
      pdfUrls: [`lessons/${multiLessonChapterId}/quadratics.pdf`] as
        | string[]
        | null,
    },
  ];

  for (const l of teacherALessons) {
    const id = `seed-lesson-${multiLessonChapterId}-${l.sortOrder}`;
    const existed = await lessonExists(id);
    const lesson = await prisma.lesson.upsert({
      where: { id },
      update: {
        title: l.title,
        description: l.description,
        durationMinutes: l.durationMinutes,
        youtubeUrl: l.youtubeUrl,
        sortOrder: l.sortOrder,
        pdfUrls: l.pdfUrls ?? undefined,
      },
      create: {
        id,
        title: l.title,
        description: l.description,
        durationMinutes: l.durationMinutes,
        youtubeUrl: l.youtubeUrl,
        sortOrder: l.sortOrder,
        pdfUrls: l.pdfUrls ?? undefined,
        chapterId: multiLessonChapterId,
      },
    });
    (existed ? changes.reused : changes.created).push(
      `Teacher A lesson "${lesson.title}" (${lesson.id})`,
    );
    console.log(`Lesson ready: ${lesson.title}`);
  }

  // ─── Teacher B (NEW) — for ownership / isolation testing ───────────
  const teacherBEmail = "teacher-b@example.com";
  const teacherBPassword = "Teacher@123456";

  const teacherBExisted = await userExists(teacherBEmail);
  const teacherBUser = await prisma.user.upsert({
    where: { email: teacherBEmail },
    update: {},
    create: {
      fullName: "Sara Ali",
      email: teacherBEmail,
      mobile: "01200000000",
      password: await bcrypt.hash(teacherBPassword, 10),
      role: Role.OPERATION,
      teacherProfile: {
        create: {
          subject: "Physics",
          bio: "Physics teacher for preparatory and secondary stages.",
        },
      },
    },
    include: { teacherProfile: true },
  });
  (teacherBExisted ? changes.reused : changes.created).push(
    `Teacher B user (${teacherBUser.email})`,
  );
  console.log(`Teacher B account ready: ${teacherBUser.email}`);

  // Teacher B stage
  const stageBId = "seed-stage-b-1";
  const stageBExisted = await stageExists(stageBId);
  const stageB = await prisma.stage.upsert({
    where: { id: stageBId },
    update: { name: "Physics Track", description: "Teacher B stage" },
    create: {
      id: stageBId,
      name: "Physics Track",
      description: "Teacher B stage",
      sortOrder: 1,
      teacherId: teacherBUser.id,
    },
  });
  (stageBExisted ? changes.reused : changes.created).push(
    `Teacher B stage "${stageB.name}" (${stageB.id})`,
  );

  // Teacher B chapter
  const chapterBId = `seed-chapter-${stageBId}-1`;
  const chapterBExisted = await chapterExists(chapterBId);
  const chapterB = await prisma.chapter.upsert({
    where: { id: chapterBId },
    update: { name: "Mechanics", description: "Teacher B chapter", price: null },
    create: {
      id: chapterBId,
      name: "Mechanics",
      description: "Teacher B chapter",
      sortOrder: 1,
      price: null,
      stageId: stageBId,
    },
  });
  (chapterBExisted ? changes.reused : changes.created).push(
    `Teacher B chapter "${chapterB.name}" (${chapterB.id})`,
  );

  // Teacher B lesson
  const lessonBId = `seed-lesson-${chapterBId}-1`;
  const lessonBExisted = await lessonExists(lessonBId);
  const lessonB = await prisma.lesson.upsert({
    where: { id: lessonBId },
    update: {
      title: "Newton's Laws",
      description: "The three laws of motion.",
      durationMinutes: 35,
      youtubeUrl: "https://www.youtube.com/watch?v=newton",
      sortOrder: 1,
      pdfUrls: [`lessons/${chapterBId}/newton.pdf`],
    },
    create: {
      id: lessonBId,
      title: "Newton's Laws",
      description: "The three laws of motion.",
      durationMinutes: 35,
      youtubeUrl: "https://www.youtube.com/watch?v=newton",
      sortOrder: 1,
      pdfUrls: [`lessons/${chapterBId}/newton.pdf`],
      chapterId: chapterBId,
    },
  });
  (lessonBExisted ? changes.reused : changes.created).push(
    `Teacher B lesson "${lessonB.title}" (${lessonB.id})`,
  );
  console.log(`Teacher B content ready: stage/chapter/lesson`);

  // ─── Generate seed-data.local.json from the ACTUAL DB state ────────
  const teacherAFull = await prisma.user.findUnique({
    where: { email: teacherEmail },
    select: {
      id: true,
      fullName: true,
      email: true,
      mobile: true,
      role: true,
    },
  });
  const teacherBFull = await prisma.user.findUnique({
    where: { email: teacherBEmail },
    select: {
      id: true,
      fullName: true,
      email: true,
      mobile: true,
      role: true,
    },
  });
  const adminFull = await prisma.user.findUnique({
    where: { email },
    select: { id: true, fullName: true, email: true, mobile: true, role: true },
  });

  const teacherAStages = await prisma.stage.findMany({
    where: { teacherId: teacherAFull!.id, deletedAt: null },
    orderBy: { sortOrder: "asc" },
    select: { id: true, name: true, sortOrder: true },
  });
  const multiLessonChapter = await prisma.chapter.findUnique({
    where: { id: multiLessonChapterId },
    select: { id: true, name: true, price: true, stageId: true },
  });
  const emptyChapter = await prisma.chapter.findUnique({
    where: { id: emptyChapterId },
    select: { id: true, name: true, price: true, stageId: true },
  });
  const teacherALessonRows = await prisma.lesson.findMany({
    where: { chapterId: multiLessonChapterId },
    orderBy: { sortOrder: "asc" },
    select: {
      id: true,
      title: true,
      sortOrder: true,
      durationMinutes: true,
      youtubeUrl: true,
      description: true,
      pdfUrls: true,
    },
  });
  const teacherBStage = await prisma.stage.findUnique({
    where: { id: stageBId },
    select: { id: true, name: true },
  });
  const teacherBChapter = await prisma.chapter.findUnique({
    where: { id: chapterBId },
    select: { id: true, name: true, price: true },
  });
  const teacherBLesson = await prisma.lesson.findUnique({
    where: { id: lessonBId },
    select: { id: true, title: true, sortOrder: true },
  });

  const seedData = {
    generatedAt: new Date().toISOString(),
    seedSummary: {
      existingRecordsReused: changes.reused.length > 0,
      newDataAdded: changes.created.length > 0,
    },
    changes,
    credentials: {
      note: "Local development only. Plaintext shown for testing convenience.",
      admin: { email, password, role: "ADMIN" },
      teacherA: { email: teacherEmail, password: teacherPassword, role: "OPERATION" },
      teacherB: { email: teacherBEmail, password: teacherBPassword, role: "OPERATION" },
    },
    teacherA: {
      user: teacherAFull,
      stages: teacherAStages,
      chapters: {
        multiLesson: multiLessonChapter, // free (price null) + has lessons
        empty: emptyChapter, // paid + no lessons
        free: multiLessonChapter, // price === null
        paid: emptyChapter, // price > 0
      },
      lessons: teacherALessonRows,
    },
    teacherB: {
      user: teacherBFull,
      stage: teacherBStage,
      chapter: teacherBChapter,
      lesson: teacherBLesson,
    },
    students: [], // none required by current Chapter/Lesson test scenarios
    admin: adminFull,
    manualTestingTargets: {
      ownershipDeniedFor: "Teacher B accessing any Teacher A resource (expect 404)",
      chapterDeleteBlocked: multiLessonChapterId, // has lessons -> 409
      chapterSoftDeletable: emptyChapterId, // no lessons -> soft delete OK
      lessonForGetUpdateDelete: teacherALessonRows[0]?.id ?? null,
    },
  };

  writeFileSync(
    new URL("../seed-data.local.json", import.meta.url),
    JSON.stringify(seedData, null, 2),
  );
  console.log("Wrote seed-data.local.json");
  console.log(
    `Seed summary -> reused: ${changes.reused.length}, created: ${changes.created.length}, updated: ${changes.updated.length}`,
  );
}

main()
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
