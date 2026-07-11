import "dotenv/config";
import bcrypt from "bcryptjs";
import { v5 as uuidv5 } from "uuid";
import { prisma } from "../src/config/database.js";
import { logger } from "../src/config/logger.js";
import { SUBJECT_CATALOG } from "../src/modules/subjects/subjects.js";
import { TEACHER_PLANS } from "../src/modules/teacher-plans/teacher-plan.seed-data.js";

const BCRYPT_ROUNDS = 12;
const SEED_NAMESPACE = "f5a0b1c2-d3e4-4f6a-a8bc-9d0e1f2a3b4c";
const LOCAL_PASSWORD = process.env.SEED_LOCAL_PASSWORD ?? "Fahimni@123456";
const LOCAL_PASSWORD_SOURCE = process.env.SEED_LOCAL_PASSWORD ? "env:SEED_LOCAL_PASSWORD" : "fallback";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? "Fahimni@123456";
const ADMIN_PASSWORD_SOURCE = process.env.ADMIN_PASSWORD ? "env:ADMIN_PASSWORD" : "fallback";
const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? "admin@fahimni.local";

function sid(key: string): string {
  return uuidv5(`fahimni-minimal-seed:${key}`, SEED_NAMESPACE);
}

function requireLocalSeedSafety(): void {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Refusing destructive local seed cleanup in production.");
  }

  const url = process.env.DATABASE_URL ?? "";
  const looksLocal =
    /localhost|127\.0\.0\.1|host\.docker\.internal|final_project|fahimni/i.test(url) &&
    !/prod|production/i.test(url);

  if (!looksLocal) {
    throw new Error("Refusing destructive local seed cleanup: DATABASE_URL does not look local/dev.");
  }
}

function subject(code: string): string {
  const entry = SUBJECT_CATALOG.find((item) => item.code === code);
  if (!entry) throw new Error(`Missing subject catalog entry: ${code}`);
  return entry.displayName;
}

const stages = [
  {
    id: sid("stage-first-secondary"),
    nameAr: "الصف الأول الثانوي",
    nameEn: "First Secondary",
    descriptionAr: "محتوى الصف الأول الثانوي",
    descriptionEn: "First secondary content",
    sortOrder: 1,
  },
  {
    id: sid("stage-second-secondary"),
    nameAr: "الصف الثاني الثانوي",
    nameEn: "Second Secondary",
    descriptionAr: "محتوى الصف الثاني الثانوي",
    descriptionEn: "Second secondary content",
    sortOrder: 2,
  },
  {
    id: sid("stage-third-secondary"),
    nameAr: "الصف الثالث الثانوي",
    nameEn: "Third Secondary",
    descriptionAr: "محتوى الصف الثالث الثانوي",
    descriptionEn: "Third secondary content",
    sortOrder: 3,
  },
];

const teachers = [
  { key: "arabic", email: "teacher.arabic@fahimni.local", fullName: "مدرس اللغة العربية", mobile: "01010000001", subject: subject("ARABIC") },
  { key: "english", email: "teacher.english@fahimni.local", fullName: "English Teacher", mobile: "01010000002", subject: subject("ENGLISH") },
  { key: "math", email: "teacher.math@fahimni.local", fullName: "مدرس الرياضيات", mobile: "01010000003", subject: subject("MATH") },
  { key: "physics", email: "teacher.physics@fahimni.local", fullName: "مدرس الفيزياء", mobile: "01010000004", subject: subject("PHYSICS") },
];

const students = [
  { email: "student1@fahimni.local", fullName: "Student One", mobile: "01020000001", stageIndex: 0 },
  { email: "student2@fahimni.local", fullName: "Student Two", mobile: "01020000002", stageIndex: 0 },
  { email: "student3@fahimni.local", fullName: "Student Three", mobile: "01020000003", stageIndex: 1 },
  { email: "student4@fahimni.local", fullName: "Student Four", mobile: "01020000004", stageIndex: 1 },
  { email: "student5@fahimni.local", fullName: "Student Five", mobile: "01020000005", stageIndex: 2 },
];

const chapterImage = (name: string) =>
  `https://placehold.co/960x540/0e7490/ffffff?text=${encodeURIComponent(name)}`;

async function main(): Promise<void> {
  requireLocalSeedSafety();

  const localPasswordHash = await bcrypt.hash(LOCAL_PASSWORD, BCRYPT_ROUNDS);
  const adminPasswordHash = await bcrypt.hash(ADMIN_PASSWORD, BCRYPT_ROUNDS);

  await prisma.$executeRawUnsafe(`
    DO $$
    DECLARE
      table_list text;
    BEGIN
      SELECT string_agg(format('%I.%I', schemaname, tablename), ', ')
      INTO table_list
      FROM pg_tables
      WHERE schemaname = 'public'
        AND tablename <> '_prisma_migrations';

      IF table_list IS NOT NULL THEN
        EXECUTE 'TRUNCATE TABLE ' || table_list || ' RESTART IDENTITY CASCADE';
      END IF;
    END $$;
  `);

  await prisma.user.create({
    data: {
      id: sid("admin"),
      fullName: process.env.ADMIN_FULL_NAME ?? "Fahimni Admin",
      email: ADMIN_EMAIL,
      mobile: process.env.ADMIN_MOBILE ?? "01000000000",
      password: adminPasswordHash,
      role: "ADMIN",
      status: "ACTIVE",
      teacherApprovalState: "NONE",
      locale: "ar",
    },
  });

  for (const stage of stages) {
    await prisma.stage.create({
      data: {
        id: stage.id,
        name: stage.nameAr,
        nameAr: stage.nameAr,
        nameEn: stage.nameEn,
        description: stage.descriptionAr,
        descriptionAr: stage.descriptionAr,
        descriptionEn: stage.descriptionEn,
        sortOrder: stage.sortOrder,
        teacherId: null,
        isActive: true,
      },
    });
  }

  for (const teacher of teachers) {
    await prisma.user.create({
      data: {
        id: sid(`teacher-${teacher.key}`),
        fullName: teacher.fullName,
        email: teacher.email,
        mobile: teacher.mobile,
        password: localPasswordHash,
        role: "OPERATION",
        status: "ACTIVE",
        teacherApprovalState: "APPROVED",
        locale: "ar",
        teacherProfile: {
          create: {
            id: sid(`teacher-profile-${teacher.key}`),
            subject: teacher.subject,
            bio: `${teacher.fullName} - ${teacher.subject}`,
          },
        },
      },
    });
  }

  for (const student of students) {
    await prisma.user.create({
      data: {
        id: sid(`student-${student.email}`),
        fullName: student.fullName,
        email: student.email,
        mobile: student.mobile,
        password: localPasswordHash,
        role: "STUDENT",
        status: "ACTIVE",
        teacherApprovalState: "NONE",
        locale: "ar",
        studentProfile: {
          create: {
            id: sid(`student-profile-${student.email}`),
            stageId: stages[student.stageIndex]!.id,
          },
        },
      },
    });
  }

  for (const plan of TEACHER_PLANS) {
    await prisma.teacherPlan.create({
      data: {
        id: plan.id,
        code: plan.code,
        name: plan.name,
        displayName: plan.displayName,
        description: plan.description,
        monthlyPrice: plan.monthlyPrice,
        yearlyPrice: plan.yearlyPrice,
        isActive: plan.isActive,
        isRecommended: plan.isRecommended,
        sortOrder: plan.sortOrder,
        features: plan.features,
        limits: plan.limits,
      },
    });
  }

  await prisma.platformPromoCode.createMany({
    data: [
      {
        id: sid("teacher-plan-free-promo"),
        code: "TEACHERFREE100",
        scope: "TEACHER_PLAN",
        discountType: "PERCENTAGE",
        discountValue: 100,
        currency: "EGP",
        maxUses: 100,
        usedCount: 0,
        perUserLimit: 1,
        billingInterval: "ALL",
        isActive: true,
        createdById: sid("admin"),
      },
      {
        id: sid("teacher-plan-half-promo"),
        code: "TEACHERHALF50",
        scope: "TEACHER_PLAN",
        discountType: "PERCENTAGE",
        discountValue: 50,
        currency: "EGP",
        maxUses: 100,
        usedCount: 0,
        perUserLimit: 1,
        billingInterval: "ALL",
        isActive: true,
        createdById: sid("admin"),
      },
    ],
  });

  const chapterSpecs = [
    { key: "first-arabic", stage: 0, teacher: "arabic", name: "اللغة العربية - الترم الأول", term: "FIRST_TERM", visible: true },
    { key: "first-english", stage: 0, teacher: "english", name: "English - First Term", term: "FIRST_TERM", visible: true },
    { key: "first-math", stage: 0, teacher: "math", name: "الرياضيات - الترم الثاني", term: "SECOND_TERM", visible: true },
    { key: "first-physics", stage: 0, teacher: "physics", name: "الفيزياء - الترم الثاني", term: "SECOND_TERM", visible: true },
    { key: "first-hidden", stage: 0, teacher: "math", name: "فصل مخفي للتجربة", term: "FIRST_TERM", visible: false },
    { key: "second-arabic", stage: 1, teacher: "arabic", name: "عربي الصف الثاني", term: "FIRST_TERM", visible: true },
    { key: "second-physics", stage: 1, teacher: "physics", name: "Physics Second Secondary", term: "SECOND_TERM", visible: true },
    { key: "third-math", stage: 2, teacher: "math", name: "Math Third Secondary", term: "FIRST_TERM", visible: true },
  ] as const;

  for (let i = 0; i < chapterSpecs.length; i += 1) {
    const spec = chapterSpecs[i]!;
    const teacher = teachers.find((item) => item.key === spec.teacher)!;
    const chapterId = sid(`chapter-${spec.key}`);
    await prisma.chapter.create({
      data: {
        id: chapterId,
        name: spec.name,
        description: `${spec.name} demo chapter`,
        sortOrder: i + 1,
        price: spec.visible ? 100 : 0,
        imageUrl: chapterImage(spec.name),
        term: spec.term,
        isVisible: spec.visible,
        stageId: stages[spec.stage].id,
        teacherId: sid(`teacher-${teacher.key}`),
        lessons: {
          create: {
            id: sid(`lesson-${spec.key}`),
            title: `${spec.name} - الدرس الأول`,
            description: "درس تجريبي للاختبار المحلي",
            durationMinutes: 30,
            youtubeUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
            sortOrder: 1,
          },
        },
      },
    });
  }

  const counts = {
    admins: await prisma.user.count({ where: { role: "ADMIN" } }),
    teachers: await prisma.user.count({ where: { role: "OPERATION" } }),
    students: await prisma.user.count({ where: { role: "STUDENT" } }),
    stages: await prisma.stage.count(),
    chapters: await prisma.chapter.count(),
    lessons: await prisma.lesson.count(),
  };

  logger.info("minimal_seed_complete", {
    counts,
    admin: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD, passwordSource: ADMIN_PASSWORD_SOURCE },
    teachers: teachers.map((teacher) => ({
      email: teacher.email,
      subject: teacher.subject,
      password: LOCAL_PASSWORD,
      passwordSource: LOCAL_PASSWORD_SOURCE,
    })),
    students: students.map((student) => ({
      email: student.email,
      stage: stages[student.stageIndex]!.nameEn,
      password: LOCAL_PASSWORD,
      passwordSource: LOCAL_PASSWORD_SOURCE,
    })),
  });
}

main()
  .catch((error) => {
    logger.error("minimal_seed_failed", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
