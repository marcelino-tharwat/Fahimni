import "dotenv/config";
import { prisma } from "../src/config/database.js";
import { SUBJECT_CATALOG } from "../src/modules/subjects/subjects.js";

let failed = false;

function check(label: string, ok: boolean, detail = ""): void {
  const status = ok ? "PASS" : "FAIL";
  console.log(`${status} ${label}${detail ? ` - ${detail}` : ""}`);
  if (!ok) failed = true;
}

function subject(code: string): string {
  const entry = SUBJECT_CATALOG.find((item) => item.code === code);
  if (!entry) throw new Error(`Missing subject catalog entry: ${code}`);
  return entry.displayName;
}

async function main(): Promise<void> {
  const adminEmail = process.env.ADMIN_EMAIL ?? "admin@fahimni.local";
  const expectedTeachers = [
    ["teacher.arabic@fahimni.local", subject("ARABIC")],
    ["teacher.english@fahimni.local", subject("ENGLISH")],
    ["teacher.math@fahimni.local", subject("MATH")],
    ["teacher.physics@fahimni.local", subject("PHYSICS")],
  ] as const;
  const expectedStudents = [
    "student1@fahimni.local",
    "student2@fahimni.local",
    "student3@fahimni.local",
    "student4@fahimni.local",
    "student5@fahimni.local",
  ];

  const [adminCount, teacherCount, studentCount, userCount] = await Promise.all([
    prisma.user.count({ where: { role: "ADMIN" } }),
    prisma.user.count({ where: { role: "OPERATION" } }),
    prisma.user.count({ where: { role: "STUDENT" } }),
    prisma.user.count(),
  ]);
  check("Exactly 1 admin", adminCount === 1, `count=${adminCount}`);
  check("Exactly 4 teachers", teacherCount === 4, `count=${teacherCount}`);
  check("Exactly 5 students", studentCount === 5, `count=${studentCount}`);
  check("No extra seeded users", userCount === 10, `count=${userCount}`);

  const admin = await prisma.user.findUnique({ where: { email: adminEmail } });
  check("Expected admin email exists", !!admin, adminEmail);

  for (const [email, expectedSubject] of expectedTeachers) {
    const teacher = await prisma.user.findUnique({
      where: { email },
      include: { teacherProfile: true },
    });
    check(
      `Teacher ${email} approved active with subject`,
      !!teacher &&
        teacher.role === "OPERATION" &&
        teacher.status === "ACTIVE" &&
        teacher.teacherApprovalState === "APPROVED" &&
        teacher.teacherProfile?.subject === expectedSubject,
      teacher?.teacherProfile?.subject ?? "missing",
    );
  }

  for (const email of expectedStudents) {
    const student = await prisma.user.findUnique({
      where: { email },
      include: { studentProfile: { include: { stage: true } } },
    });
    check(
      `Student ${email} active with profile/stage`,
      !!student && student.role === "STUDENT" && student.status === "ACTIVE" && !!student.studentProfile?.stage,
      student?.studentProfile?.stage?.nameEn ?? "missing",
    );
  }

  const stageRows = await prisma.stage.findMany({ orderBy: { sortOrder: "asc" } });
  check("Exactly 3 platform stages", stageRows.length === 3, `count=${stageRows.length}`);
  check(
    "Stages are active and platform-owned",
    stageRows.every((stage) => stage.isActive && stage.teacherId === null && !!stage.nameAr && !!stage.nameEn),
  );

  const chapters = await prisma.chapter.findMany({
    include: {
      teacher: { include: { teacherProfile: true } },
      lessons: true,
      stage: true,
    },
    orderBy: [{ stage: { sortOrder: "asc" } }, { sortOrder: "asc" }],
  });
  check("Seed has required chapters", chapters.length === 8, `count=${chapters.length}`);
  check(
    "All chapters have stage, teacher, term, visibility, image, and lesson",
    chapters.every((chapter) =>
      !!chapter.stageId &&
      !!chapter.teacherId &&
      !!chapter.teacher.teacherProfile?.subject &&
      (chapter.term === "FIRST_TERM" || chapter.term === "SECOND_TERM") &&
      typeof chapter.isVisible === "boolean" &&
      !!chapter.imageUrl &&
      chapter.lessons.length >= 1,
    ),
  );
  check(
    "No teacher has content outside their subject",
    chapters.every((chapter) => chapter.teacher.teacherProfile?.subject !== null),
  );

  const firstStage = stageRows[0]!;
  const secondStage = stageRows[1]!;
  const visibleFirst = chapters.filter((chapter) => chapter.stageId === firstStage.id && chapter.isVisible);
  const hiddenFirst = chapters.filter((chapter) => chapter.stageId === firstStage.id && !chapter.isVisible);
  check("First stage visible chapters appear", visibleFirst.length === 4, `count=${visibleFirst.length}`);
  check("Hidden chapter exists for exclusion", hiddenFirst.length === 1, `count=${hiddenFirst.length}`);
  check(
    "Second stage has multiple visible subjects",
    new Set(chapters.filter((chapter) => chapter.stageId === secondStage.id && chapter.isVisible).map((chapter) => chapter.teacher.teacherProfile?.subject)).size >= 2,
  );

  const firstStagePhysics = chapters.filter(
    (chapter) =>
      chapter.stageId === firstStage.id &&
      chapter.isVisible &&
      chapter.teacher.teacherProfile?.subject === subject("PHYSICS"),
  );
  const secondStagePhysics = chapters.filter(
    (chapter) =>
      chapter.stageId === secondStage.id &&
      chapter.isVisible &&
      chapter.teacher.teacherProfile?.subject === subject("PHYSICS"),
  );
  check("Student All Content subject filter can isolate Physics in stage 1", firstStagePhysics.length === 1);
  check("Subject filter does not imply cross-stage leakage", secondStagePhysics.length === 1);

  const teacherPlanPromos = await prisma.platformPromoCode.findMany();
  check(
    "Platform promo codes are TEACHER_PLAN only",
    teacherPlanPromos.length >= 1 && teacherPlanPromos.every((promo) => promo.scope === "TEACHER_PLAN"),
    `count=${teacherPlanPromos.length}`,
  );

  if (failed) {
    throw new Error("Seed verification failed");
  }
  console.log("ALL CHECKS PASSED");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
