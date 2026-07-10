/**
 * Quiz unlock-by-lesson-completion demo seed.
 *
 * Self-contained + idempotent. Creates one chapter with 3 lessons, two lesson
 * quizzes (after lesson 1 and lesson 2) and a chapter-end quiz, plus five
 * students spread across the unlock states so My Quizzes shows both locked and
 * unlocked quizzes:
 *
 *   s0 — nothing completed            → lesson-1 quiz LOCKED
 *   s1 — lesson 1 completed           → lesson-1 quiz UNLOCKED, lesson-2 LOCKED
 *   s2 — lessons 1-2 + quiz 1 passed  → lesson-2 quiz UNLOCKED, chapter LOCKED
 *   s3 — all lessons, no quizzes      → chapter quiz LOCKED (previous quiz)
 *   s4 — all lessons + quizzes 1-2    → chapter quiz UNLOCKED
 *
 * All accounts use the demo email domain and are ACTIVE so the existing
 * seed-verify "all active-lifecycle accounts" invariant still holds.
 */
import bcrypt from "bcryptjs";
import { prisma } from "../src/config/database.js";
import { TF_OPTIONS, TF_TRUE } from "../src/modules/quizzes/quiz-generation.mapping.js";

const DEMO_EMAIL_DOMAIN = "@fahimni.local";
const PW_HASH_ROUNDS = 12;

export const QUIZ_UNLOCK_IDS = {
  teacher: "seed-qunlock-teacher",
  stage: "seed-qunlock-stage",
  chapter: "seed-qunlock-chapter",
  l1: "seed-qunlock-l1",
  l2: "seed-qunlock-l2",
  l3: "seed-qunlock-l3",
  qL1: "seed-qunlock-quiz-l1",
  qL2: "seed-qunlock-quiz-l2",
  qCh: "seed-qunlock-quiz-ch",
  qL1Question: "seed-qunlock-q-l1",
  qL2Question: "seed-qunlock-q-l2",
  qChQuestion: "seed-qunlock-q-ch",
} as const;

export const QUIZ_UNLOCK_STUDENT_EMAILS = {
  s0: "student.qunlock0" + DEMO_EMAIL_DOMAIN,
  s1: "student.qunlock1" + DEMO_EMAIL_DOMAIN,
  s2: "student.qunlock2" + DEMO_EMAIL_DOMAIN,
  s3: "student.qunlock3" + DEMO_EMAIL_DOMAIN,
  s4: "student.qunlock4" + DEMO_EMAIL_DOMAIN,
} as const;

let mobileSeq = 5_000_000;
function mobile(): string {
  mobileSeq += 1;
  return `0108${String(mobileSeq).slice(-7)}`;
}

async function upsertPublishedQuiz(
  id: string,
  questionId: string,
  title: string,
  contentScope: "CHAPTER" | "SELECTED_LESSONS",
  teacherId: string,
  lessonIds: string[],
): Promise<void> {
  await prisma.quiz.upsert({
    where: { id },
    create: {
      id,
      title,
      chapterId: QUIZ_UNLOCK_IDS.chapter,
      status: "PUBLISHED",
      contentScope,
      questionCount: 1,
      totalPoints: 1,
      durationMinutes: 15,
      passingScore: 50,
      createdBy: teacherId,
      publishedAt: new Date(),
    },
    update: {
      chapterId: QUIZ_UNLOCK_IDS.chapter,
      status: "PUBLISHED",
      contentScope,
      passingScore: 50,
    },
  });
  await prisma.question.upsert({
    where: { id: questionId },
    create: {
      id: questionId,
      quizId: id,
      type: "TRUE_FALSE",
      text: `${title} — سؤال`,
      options: [...TF_OPTIONS],
      correctAnswer: TF_TRUE,
      points: 1,
      sortOrder: 1,
    },
    update: { quizId: id, options: [...TF_OPTIONS], correctAnswer: TF_TRUE },
  });
  await prisma.quizLesson.deleteMany({ where: { quizId: id } });
  for (const lessonId of lessonIds) {
    await prisma.quizLesson.create({ data: { quizId: id, lessonId } });
  }
}

async function upsertStudent(email: string, stageId: string): Promise<string> {
  const pwHash = await bcrypt.hash("Student@1234", PW_HASH_ROUNDS);
  const u = await prisma.user.upsert({
    where: { email },
    create: {
      email,
      fullName: `طالب اختبارات — ${email}`,
      mobile: mobile(),
      password: pwHash,
      role: "STUDENT",
      status: "ACTIVE",
    },
    update: { status: "ACTIVE" },
  });
  await prisma.studentProfile.upsert({
    where: { userId: u.id },
    create: { userId: u.id, stageId },
    update: { stageId },
  });
  await prisma.enrollment.upsert({
    where: { studentId_chapterId: { studentId: u.id, chapterId: QUIZ_UNLOCK_IDS.chapter } },
    create: {
      studentId: u.id,
      chapterId: QUIZ_UNLOCK_IDS.chapter,
      status: "ACTIVE",
      price: 0,
      paymentMethod: "FREE",
    },
    update: { status: "ACTIVE" },
  });
  return u.id;
}

async function completeLessons(studentId: string, lessonIds: string[]): Promise<void> {
  for (const lessonId of lessonIds) {
    await prisma.lessonProgress.upsert({
      where: { studentId_lessonId: { studentId, lessonId } },
      create: { studentId, lessonId, completed: true },
      update: { completed: true },
    });
  }
}

async function passQuiz(studentId: string, quizId: string): Promise<void> {
  // A GRADED, full-score attempt satisfies the existing quiz-requirement policy.
  await prisma.quizAttempt.deleteMany({ where: { studentId, quizId } });
  await prisma.quizAttempt.create({
    data: {
      quizId,
      studentId,
      answers: [],
      status: "GRADED",
      score: 1,
      totalPoints: 1,
      startedAt: new Date(),
      completedAt: new Date(),
    },
  });
}

/** Seed the quiz-unlock demo scenario. Idempotent. */
export async function seedQuizUnlockScenario(): Promise<void> {
  const pwHash = await bcrypt.hash("Teacher@1234", PW_HASH_ROUNDS);
  const teacher = await prisma.user.upsert({
    where: { email: "teacher.qunlock" + DEMO_EMAIL_DOMAIN },
    create: {
      id: QUIZ_UNLOCK_IDS.teacher,
      email: "teacher.qunlock" + DEMO_EMAIL_DOMAIN,
      fullName: "معلم تجربة فتح الاختبارات",
      mobile: mobile(),
      password: pwHash,
      role: "OPERATION",
      status: "ACTIVE",
      teacherApprovalState: "APPROVED",
    },
    update: { status: "ACTIVE", teacherApprovalState: "APPROVED" },
  });
  const teacherId = teacher.id;

  await prisma.stage.upsert({
    where: { id: QUIZ_UNLOCK_IDS.stage },
    create: {
      id: QUIZ_UNLOCK_IDS.stage,
      name: "مرحلة تجربة فتح الاختبارات",
      sortOrder: 8000,
      teacherId,
    },
    update: { teacherId, deletedAt: null },
  });

  await prisma.chapter.upsert({
    where: { id: QUIZ_UNLOCK_IDS.chapter },
    create: {
      id: QUIZ_UNLOCK_IDS.chapter,
      name: "فصل تجربة فتح الاختبارات",
      sortOrder: 1,
      stageId: QUIZ_UNLOCK_IDS.stage,
      price: 0,
    },
    update: { deletedAt: null, stageId: QUIZ_UNLOCK_IDS.stage, price: 0 },
  });

  const lessons = [
    { id: QUIZ_UNLOCK_IDS.l1, sortOrder: 1 },
    { id: QUIZ_UNLOCK_IDS.l2, sortOrder: 2 },
    { id: QUIZ_UNLOCK_IDS.l3, sortOrder: 3 },
  ];
  for (const l of lessons) {
    await prisma.lesson.upsert({
      where: { id: l.id },
      create: {
        id: l.id,
        title: `الدرس ${l.sortOrder}`,
        sortOrder: l.sortOrder,
        durationMinutes: 10,
        chapterId: QUIZ_UNLOCK_IDS.chapter,
      },
      update: { chapterId: QUIZ_UNLOCK_IDS.chapter, deletedAt: null, requiredQuizId: null },
    });
  }

  await upsertPublishedQuiz(
    QUIZ_UNLOCK_IDS.qL1,
    QUIZ_UNLOCK_IDS.qL1Question,
    "اختبار الدرس الأول",
    "SELECTED_LESSONS",
    teacherId,
    [QUIZ_UNLOCK_IDS.l1],
  );
  await upsertPublishedQuiz(
    QUIZ_UNLOCK_IDS.qL2,
    QUIZ_UNLOCK_IDS.qL2Question,
    "اختبار الدرس الثاني",
    "SELECTED_LESSONS",
    teacherId,
    [QUIZ_UNLOCK_IDS.l2],
  );
  await upsertPublishedQuiz(
    QUIZ_UNLOCK_IDS.qCh,
    QUIZ_UNLOCK_IDS.qChQuestion,
    "اختبار نهاية الفصل",
    "CHAPTER",
    teacherId,
    [],
  );

  const [s0, s1, s2, s3, s4] = await Promise.all([
    upsertStudent(QUIZ_UNLOCK_STUDENT_EMAILS.s0, QUIZ_UNLOCK_IDS.stage),
    upsertStudent(QUIZ_UNLOCK_STUDENT_EMAILS.s1, QUIZ_UNLOCK_IDS.stage),
    upsertStudent(QUIZ_UNLOCK_STUDENT_EMAILS.s2, QUIZ_UNLOCK_IDS.stage),
    upsertStudent(QUIZ_UNLOCK_STUDENT_EMAILS.s3, QUIZ_UNLOCK_IDS.stage),
    upsertStudent(QUIZ_UNLOCK_STUDENT_EMAILS.s4, QUIZ_UNLOCK_IDS.stage),
  ]);

  // Reset per-student mutable state, then reapply deterministic scenarios.
  const allStudents = [s0, s1, s2, s3, s4];
  await prisma.lessonProgress.deleteMany({
    where: { studentId: { in: allStudents } },
  });
  await prisma.quizAttempt.deleteMany({
    where: {
      studentId: { in: allStudents },
      quizId: { in: [QUIZ_UNLOCK_IDS.qL1, QUIZ_UNLOCK_IDS.qL2, QUIZ_UNLOCK_IDS.qCh] },
    },
  });

  // s0: nothing.
  // s1: lesson 1 completed.
  await completeLessons(s1, [QUIZ_UNLOCK_IDS.l1]);
  // s2: lessons 1-2 completed + quiz 1 passed.
  await completeLessons(s2, [QUIZ_UNLOCK_IDS.l1, QUIZ_UNLOCK_IDS.l2]);
  await passQuiz(s2, QUIZ_UNLOCK_IDS.qL1);
  // s3: all lessons completed, no quizzes.
  await completeLessons(s3, [QUIZ_UNLOCK_IDS.l1, QUIZ_UNLOCK_IDS.l2, QUIZ_UNLOCK_IDS.l3]);
  // s4: all lessons + quizzes 1-2 passed → chapter quiz unlocked.
  await completeLessons(s4, [QUIZ_UNLOCK_IDS.l1, QUIZ_UNLOCK_IDS.l2, QUIZ_UNLOCK_IDS.l3]);
  await passQuiz(s4, QUIZ_UNLOCK_IDS.qL1);
  await passQuiz(s4, QUIZ_UNLOCK_IDS.qL2);
}
