/**
 * Reproduce required-quiz progression gate against local dev DB.
 * Run: DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:15432/final_project npx tsx scripts/repro-quiz-gate.ts
 */
import bcrypt from "bcryptjs";
import { prisma } from "../src/config/database.js";
import {
  evaluateChapterLessons,
  evaluateLessonAccess,
} from "../src/modules/progression/lesson-progression.js";
import { loadChapterProgressionContext } from "../src/modules/progression/progression-context.js";

const LESSON_A1 = "1bd1585a-4edf-5ee8-880f-268b13dbde36";
const QUIZ_Q1 = "ecdab4d1-8fb9-4888-9aba-f6436d9447e0";
const CHAPTER = "75d866c5-e9a7-563b-8916-73f79a404ca8";
const STUDENT_EMAIL = "chem.student04@fahimni.test";

async function main() {
  const student = await prisma.user.findFirst({
    where: { email: STUDENT_EMAIL },
    select: { id: true, email: true },
  });
  if (!student) throw new Error(`Student not found: ${STUDENT_EMAIL}`);

  const lessons = await prisma.lesson.findMany({
    where: { chapterId: CHAPTER, deletedAt: null },
    orderBy: { sortOrder: "asc" },
    select: { id: true, title: true, sortOrder: true, requiredQuizId: true },
  });
  console.log("Lessons before gate setup:", lessons);

  const a1 = lessons[0]!;
  const a2 = lessons[1]!;

  // Ensure clean progress for student
  await prisma.lessonProgress.deleteMany({
    where: { studentId: student.id, lessonId: { in: [a1.id, a2.id] } },
  });
  await prisma.quizAttempt.deleteMany({
    where: { studentId: student.id, quizId: QUIZ_Q1 },
  });

  // Scenario 1: optional quiz only (requiredQuizId null)
  await prisma.lesson.update({
    where: { id: a1.id },
    data: { requiredQuiz: { disconnect: true } },
  });

  let ctx = await loadChapterProgressionContext(student.id, CHAPTER, 0);
  await prisma.lessonProgress.create({
    data: { studentId: student.id, lessonId: a1.id, completed: true },
  });
  ctx = await loadChapterProgressionContext(student.id, CHAPTER, 0);
  const optionalEval = evaluateChapterLessons(ctx);
  console.log("\n=== OPTIONAL QUIZ (requiredQuizId null) after A1 complete ===");
  console.log("A1 nextLessonId:", optionalEval[0]?.nextLessonId);
  console.log("A2 isUnlocked:", optionalEval[1]?.isUnlocked, "lock:", optionalEval[1]?.lockReason);

  await prisma.lessonProgress.deleteMany({
    where: { studentId: student.id, lessonId: a1.id },
  });

  // Scenario 2: requiredQuizId set
  await prisma.lesson.update({
    where: { id: a1.id },
    data: { requiredQuiz: { connect: { id: QUIZ_Q1 } } },
  });

  await prisma.lessonProgress.create({
    data: { studentId: student.id, lessonId: a1.id, completed: true },
  });
  ctx = await loadChapterProgressionContext(student.id, CHAPTER, 0);
  const requiredEval = evaluateChapterLessons(ctx);
  console.log("\n=== REQUIRED QUIZ after A1 complete (no attempt) ===");
  console.log("A1 requiredQuizId:", requiredEval[0]?.requiredQuizId);
  console.log("A1 nextLessonId:", requiredEval[0]?.nextLessonId);
  console.log("A2 isUnlocked:", requiredEval[1]?.isUnlocked, "lock:", requiredEval[1]?.lockReason);

  // Restore optional for manual DB state (don't leave test mutation)
  await prisma.lesson.update({
    where: { id: a1.id },
    data: { requiredQuiz: { disconnect: true } },
  });
  await prisma.lessonProgress.deleteMany({
    where: { studentId: student.id, lessonId: { in: [a1.id, a2.id] } },
  });

  console.log("\nRestored lesson.requiredQuizId to null");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
