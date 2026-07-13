import "dotenv/config";
import { prisma } from "../src/config/database.js";

let failed = false;

function check(label: string, ok: boolean, detail = ""): void {
  const status = ok ? "PASS" : "FAIL";
  console.log(`${status} ${label}${detail ? ` - ${detail}` : ""}`);
  if (!ok) failed = true;
}

const EMAIL_DOMAIN = "@fahimni.com";

async function main(): Promise<void> {
  const adminEmail = "admin" + EMAIL_DOMAIN;
  const approvedTeachers = [
    ["ahmed.sami" + EMAIL_DOMAIN, "الكيمياء"],
    ["mona.farouk" + EMAIL_DOMAIN, "الفيزياء"],
  ] as const;
  const pendingTeacherEmail = "youssef.adel" + EMAIL_DOMAIN;
  const students = [
    { email: "mona.tarek" + EMAIL_DOMAIN, verified: true },
    { email: "youssef.hassan" + EMAIL_DOMAIN, verified: true },
    { email: "nour.ibrahim" + EMAIL_DOMAIN, verified: true },
    { email: "omar.khaled" + EMAIL_DOMAIN, verified: true },
    { email: "laila.mostafa" + EMAIL_DOMAIN, verified: false },
  ] as const;

  const [adminCount, teacherCount, studentCount] = await Promise.all([
    prisma.user.count({ where: { email: { in: [adminEmail] } } }),
    prisma.user.count({
      where: { email: { in: [...approvedTeachers.map((t) => t[0]), pendingTeacherEmail] } },
    }),
    prisma.user.count({ where: { email: { in: students.map((s) => s.email) } } }),
  ]);
  check("Exactly 1 realistic admin seeded", adminCount === 1, `count=${adminCount}`);
  check("Exactly 3 realistic teachers seeded", teacherCount === 3, `count=${teacherCount}`);
  check("Exactly 5 realistic students seeded", studentCount === 5, `count=${studentCount}`);

  const admin = await prisma.user.findUnique({ where: { email: adminEmail } });
  check("Admin account exists and is ADMIN/ACTIVE", !!admin && admin.role === "ADMIN" && admin.status === "ACTIVE", adminEmail);

  for (const [email, expectedSubject] of approvedTeachers) {
    const teacher = await prisma.user.findUnique({ where: { email }, include: { teacherProfile: true } });
    check(
      `Teacher ${email} is approved/active with subject`,
      !!teacher &&
        teacher.role === "OPERATION" &&
        teacher.status === "ACTIVE" &&
        teacher.teacherApprovalState === "APPROVED" &&
        teacher.teacherProfile?.subject === expectedSubject,
      teacher?.teacherProfile?.subject ?? "missing",
    );
  }

  const pendingTeacher = await prisma.user.findUnique({
    where: { email: pendingTeacherEmail },
    include: { teacherRegistrationRequest: true },
  });
  check(
    "Pending-review teacher exists with a linked PENDING request (tests the approval flow)",
    !!pendingTeacher &&
      pendingTeacher.teacherApprovalState === "PENDING_REVIEW" &&
      pendingTeacher.teacherRegistrationRequest?.status === "PENDING",
    pendingTeacher?.teacherRegistrationRequest?.status ?? "missing",
  );

  for (const s of students) {
    const student = await prisma.user.findUnique({
      where: { email: s.email },
      include: { studentProfile: { include: { stage: true } } },
    });
    check(
      `Student ${s.email} active with profile/stage and correct emailVerified`,
      !!student &&
        student.role === "STUDENT" &&
        student.status === "ACTIVE" &&
        student.emailVerified === s.verified &&
        !!student.studentProfile?.stage,
      student?.studentProfile?.stage?.nameAr ?? "missing",
    );
  }

  const stageRows = await prisma.stage.findMany({
    where: { nameEn: { in: ["First Secondary", "Second Secondary", "Third Secondary"] } },
    orderBy: { sortOrder: "asc" },
  });
  check("Exactly 3 realistic-seed stages", stageRows.length === 3, `count=${stageRows.length}`);
  check(
    "Stages are active, platform-owned (teacherId null), and bilingual",
    stageRows.every((s) => s.isActive && s.teacherId === null && !!s.nameAr && !!s.nameEn),
  );
  check(
    "Stages have sortOrder 1, 2, 3 (required for step-back prevention)",
    stageRows.map((s) => s.sortOrder).join(",") === "1,2,3",
    `sortOrders=${stageRows.map((s) => s.sortOrder).join(",")}`,
  );

  const chapters = await prisma.chapter.findMany({
    where: { stageId: { in: stageRows.map((s) => s.id) } },
    include: { lessons: true, teacher: { include: { teacherProfile: true } } },
  });
  check("Exactly 9 chapters across the 3 stages (4 custom + 5 chemistry-catalog)", chapters.length === 9, `count=${chapters.length}`);
  check(
    "Every chapter has a term, an image, and at least one lesson",
    chapters.every((c) => (c.term === "FIRST_TERM" || c.term === "SECOND_TERM") && !!c.imageUrl && c.lessons.length >= 1),
  );
  check(
    "Stage 1 has chapters from 2 different subjects (chemistry + physics)",
    new Set(
      chapters
        .filter((c) => c.stageId === stageRows[0]!.id)
        .map((c) => c.teacher.teacherProfile?.subject),
    ).size === 2,
  );

  const quizzes = await prisma.quiz.findMany({ where: { chapterId: { in: chapters.map((c) => c.id) } } });
  check("At least 12 quizzes seeded across the realistic-seed chapters", quizzes.length >= 12, `count=${quizzes.length}`);
  check(
    "Quiz sourceScope variety: single-chapter, multi-chapter, and full-curriculum all present",
    quizzes.some((q) => q.sourceScope === "SINGLE_CHAPTER") &&
      quizzes.some((q) => q.sourceScope === "MULTI_CHAPTER") &&
      quizzes.some((q) => q.sourceScope === "FULL_CURRICULUM"),
  );
  check(
    "Quiz status variety: both DRAFT and PUBLISHED present",
    quizzes.some((q) => q.status === "DRAFT") && quizzes.some((q) => q.status === "PUBLISHED"),
  );

  const questions = await prisma.question.count({
    where: { quizId: { in: quizzes.map((q) => q.id) }, explanation: { not: null } },
  });
  check("Every seeded question has a non-null explanation", questions === (await prisma.question.count({ where: { quizId: { in: quizzes.map((q) => q.id) } } })), `withExplanation=${questions}`);

  const platformPromoCodes = await prisma.platformPromoCode.findMany({
    where: { code: { in: ["WELCOME10", "SUMMER23", "OLDPROMO"] } },
  });
  check("All 3 platform promo-code states present (active/expired/disabled)", platformPromoCodes.length === 3, `count=${platformPromoCodes.length}`);
  const active = platformPromoCodes.find((p) => p.code === "WELCOME10");
  const expired = platformPromoCodes.find((p) => p.code === "SUMMER23");
  const disabled = platformPromoCodes.find((p) => p.code === "OLDPROMO");
  check("WELCOME10 is active with no expiry", !!active && active.isActive && !active.expiresAt);
  check("SUMMER23 is active=true but expired (expiresAt in the past)", !!expired && expired.isActive && !!expired.expiresAt && expired.expiresAt < new Date());
  check("OLDPROMO is disabled (isActive=false)", !!disabled && !disabled.isActive);

  const teacherPromoCodes = await prisma.promoCode.findMany({ where: { code: { in: ["AHMED001", "AHMED002"] } } });
  check("Teacher single-use promo codes seeded (1 used, 1 unused)", teacherPromoCodes.length === 2, `count=${teacherPromoCodes.length}`);
  check(
    "One teacher promo code is used, one is unused",
    teacherPromoCodes.some((p) => p.isUsed) && teacherPromoCodes.some((p) => !p.isUsed),
  );

  const enrollments = await prisma.enrollment.count({ where: { chapterId: { in: chapters.map((c) => c.id) } } });
  check("At least 4 enrollments seeded across students", enrollments >= 4, `count=${enrollments}`);
  const paymentMethods = await prisma.enrollment.findMany({
    where: { chapterId: { in: chapters.map((c) => c.id) } },
    select: { paymentMethod: true },
  });
  check(
    "Enrollment payment-method variety: FREE, PROMO, and PAYMOB all present",
    paymentMethods.some((e) => e.paymentMethod === "FREE") &&
      paymentMethods.some((e) => e.paymentMethod === "PROMO") &&
      paymentMethods.some((e) => e.paymentMethod === "PAYMOB"),
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
