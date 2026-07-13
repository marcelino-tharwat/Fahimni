import type { PrismaClient } from "../../src/generated/prisma/client.js";
import { assertLocalDatabase } from "../../src/seed/local-guard.js";
import { TEACHER_PLANS } from "../../src/modules/teacher-plans/teacher-plan.seed-data.js";
import { seedId } from "./ids.js";
import { withCountLog, getPasswordHash } from "./helpers.js";
import { seedUsers } from "./users.seed.js";
import { seedContent } from "./content.seed.js";
import { seedQuizzes } from "./quizzes.seed.js";
import { seedEnrollments } from "./enrollments.seed.js";
import { seedProgress } from "./progress.seed.js";
import { seedNotifications } from "./notifications.seed.js";
import { SCALE } from "./constants.js";

/**
 * Large-scale seed orchestrator.
 *
 * Populates the database with production-quality Arabic data:
 *   - 5 Admins, 10 Operations, 30 Teachers, 500 Students
 *   - 3 Stages × 10 Chapters × 5 Lessons = 150 Lessons
 *   - 60+ Quizzes with 300+ Questions
 *   - 5000+ Enrollments with PaymentTransactions
 *   - 3000+ LessonProgress records
 *   - 2000+ QuizAttempts
 *   - 5000+ Notifications
 *
 * Idempotent: uses skipDuplicates on every createMany.
 */
export async function runLargeSeed(prisma: PrismaClient) {
  console.log("\n═══════════════════════════════════════════════════════");
  console.log("  Fahimni — Large-Scale Production Seed");
  console.log("═══════════════════════════════════════════════════════\n");

  // ── Safety: local-only ──
  assertLocalDatabase({
    nodeEnv: process.env.NODE_ENV,
    databaseUrl: process.env.DATABASE_URL,
  });

  // ── Phase 0: Teacher Plans ──
  await withCountLog("Seed Teacher Plans", async () => {
    for (const plan of TEACHER_PLANS) {
      await prisma.teacherPlan.upsert({
        where: { code: plan.code },
        create: {
          code: plan.code,
          name: plan.name,
          displayName: plan.displayName,
          description: plan.description,
          monthlyPrice: plan.monthlyPrice,
          yearlyPrice: plan.yearlyPrice,
          currency: plan.currency,
          billingInterval: plan.billingInterval,
          isActive: plan.isActive,
          isRecommended: plan.isRecommended,
          sortOrder: plan.sortOrder,
          features: plan.features,
          limits: plan.limits,
        },
        update: {
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
  });

  // ── Phase 1: Stages (must exist before users with student profiles) ──
  // Create minimal stages first so student profiles can reference them
  const stageData = [
    { id: seedId("stage-0"), name: "الصف الأول الثانوي", nameAr: "الصف الأول الثانوي", nameEn: "First Secondary", sortOrder: 1 },
    { id: seedId("stage-1"), name: "الصف الثاني الثانوي", nameAr: "الصف الثاني الثانوي", nameEn: "Second Secondary", sortOrder: 2 },
    { id: seedId("stage-2"), name: "الصف الثالث الثانوي", nameAr: "الصف الثالث الثانوي", nameEn: "Third Secondary", sortOrder: 3 },
  ];
  await withCountLog("Seed Stages (3)", async () => {
    for (const s of stageData) {
      await prisma.stage.upsert({
        where: { id: s.id },
        create: {
          ...s,
          description: `المرحلة الثانوية العامة — ${s.name}.`,
          descriptionAr: `المرحلة الثانوية العامة — ${s.name}.`,
          descriptionEn: `Egyptian general secondary education — ${s.nameEn}.`,
        },
        update: { name: s.name, nameAr: s.nameAr, nameEn: s.nameEn },
      });
    }
  });

  // ── Phase 2: Users ──
  const users = await withCountLog(
    `Seed Users (${SCALE.ADMINS} admins, ${SCALE.OPERATIONS} ops, ${SCALE.TEACHERS} teachers, ${SCALE.STUDENTS} students)`,
    async () => seedUsers(prisma),
  );

  // ── Phase 3: Content ──
  const teacherIds = users.teachers
    .filter(t => t.teacherApprovalState === "APPROVED")
    .map(t => t.id);
  const allTeacherIds = users.teachers.map(t => t.id);

  const content = await withCountLog(
    `Seed Content (3 stages, ${SCALE.CHAPTERS_PER_STAGE * SCALE.STAGES} chapters, ${SCALE.CHAPTERS_PER_STAGE * SCALE.STAGES * SCALE.LESSONS_PER_CHAPTER} lessons)`,
    async () => seedContent(prisma, teacherIds.length > 0 ? teacherIds : allTeacherIds.slice(0, 5)),
  );

  // ── Phase 4: Quizzes + Questions ──
  const quizResult = await withCountLog(
    "Seed Quizzes & Questions",
    async () => seedQuizzes(prisma, content.chapters, teacherIds.length > 0 ? teacherIds : allTeacherIds.slice(0, 5)),
  );

  // ── Phase 5: Enrollments + Payments ──
  await withCountLog(
    "Seed Enrollments & Payments",
    async () => {
      const chapterPrices = content.chapters.map(ch => ({
        id: ch.id,
        price: Math.random() > 0.3 ? Math.round(30 + Math.random() * 70) : null,
        stageId: ch.stageId,
      }));
      await seedEnrollments(prisma, users.students.map(s => s.id), chapterPrices, teacherIds);
    },
  );

  // ── Phase 6: Progress + Quiz Attempts ──
  const chapterLessons = content.lessons.map(l => ({
    chapterId: l.chapterId,
    lessonId: l.id,
  }));
  await withCountLog(
    "Seed Progress & Quiz Attempts",
    async () => seedProgress(
      prisma,
      users.students.map(s => s.id),
      chapterLessons,
      quizResult.quizzes.map(q => ({
        id: q.id,
        chapterId: q.chapterId,
        questionCount: 5,
        totalPoints: 10,
        status: "PUBLISHED",
      })),
    ),
  );

  // ── Phase 7: Notifications ──
  await withCountLog(
    "Seed Notifications",
    async () => seedNotifications(
      prisma,
      users.students.map(s => s.id),
      content.chapters.map(ch => ({ id: ch.id, name: ch.name })),
    ),
  );

  // ── Phase 8: Platform Promo Codes ──
  await withCountLog("Seed Platform Promo Codes", async () => {
    const adminId = users.admins[0]!.id;
    const now = new Date();
    const promos = [
      { code: "WELCOME10", discountType: "PERCENTAGE" as const, discountValue: 10, isActive: true },
      { code: "WELCOME20", discountType: "PERCENTAGE" as const, discountValue: 20, isActive: true },
      { code: "FLAT50", discountType: "FIXED_AMOUNT" as const, discountValue: 50, isActive: true },
      { code: "STUDENT15", discountType: "PERCENTAGE" as const, discountValue: 15, isActive: true },
      { code: "EXPIRED25", discountType: "PERCENTAGE" as const, discountValue: 25, isActive: false },
    ];
    for (const p of promos) {
      await prisma.platformPromoCode.upsert({
        where: { code: p.code },
        create: {
          code: p.code,
          scope: "COURSE_PURCHASE",
          discountType: p.discountType,
          discountValue: p.discountValue,
          currency: "EGP",
          isActive: p.isActive,
          maxUses: 1000,
          usedCount: 0,
          perUserLimit: 3,
          createdById: adminId,
        },
        update: { isActive: p.isActive, discountValue: p.discountValue },
      });
    }
  });

  // ── Phase 9: Teacher Subscriptions ──
  await withCountLog("Seed Teacher Subscriptions", async () => {
    const proPlan = await prisma.teacherPlan.findUnique({ where: { code: "PRO" } });
    const basicPlan = await prisma.teacherPlan.findUnique({ where: { code: "BASIC" } });
    if (!proPlan || !basicPlan) return;

    const approvedTeachers = users.teachers.filter(t => t.teacherApprovalState === "APPROVED");
    const now = new Date();

    for (let i = 0; i < Math.min(10, approvedTeachers.length); i++) {
      const teacher = approvedTeachers[i]!;
      const plan = i < 5 ? proPlan : basicPlan;
      const status = i < 7 ? "ACTIVE" : i < 9 ? "TRIALING" : "EXPIRED";

      await prisma.teacherSubscription.upsert({
        where: { id: seedId(`sub-${teacher.id}`) },
        create: {
          id: seedId(`sub-${teacher.id}`),
          teacherId: teacher.id,
          planId: plan.id,
          status: status as any,
          billingInterval: "MONTHLY",
          startedAt: new Date(now.getTime() - 15 * 86400000),
          currentPeriodStart: new Date(now.getTime() - 5 * 86400000),
          currentPeriodEnd: new Date(now.getTime() + 25 * 86400000),
        },
        update: { status: status as any },
      });
    }
  });

  // ── Phase 10: Audit Logs ──
  await withCountLog("Seed Audit Logs", async () => {
    const adminId = users.admins[0]!.id;
    const auditData = [];
    const actions = ["USER_CREATED", "CHAPTER_UPDATED", "QUIZ_PUBLISHED", "TEACHER_APPROVED", "PROMO_CREATED"];

    for (let i = 0; i < 50; i++) {
      auditData.push({
        id: seedId(`audit-${i}`),
        action: actions[i % actions.length]!,
        resourceType: ["User", "Chapter", "Quiz", "Teacher", "PromoCode"][i % 5]!,
        resourceId: seedId(`resource-audit-${i}`),
        userId: adminId,
        details: { action: actions[i % actions.length], timestamp: new Date().toISOString() },
      });
    }

    await prisma.auditLog.createMany({ data: auditData, skipDuplicates: true });
  });

  console.log("\n═══════════════════════════════════════════════════════");
  console.log("  ✓ Large-Scale Seed Completed Successfully");
  console.log("═══════════════════════════════════════════════════════\n");
}
