/**
 * Deterministic quiz-visibility E2E fixture factory.
 * Used by E2E tests and browser seed script.
 */
import bcrypt from "bcryptjs";
import { prisma } from "../../config/database.js";
import { TF_FALSE, TF_OPTIONS, TF_TRUE } from "../../modules/quizzes/quiz-generation.mapping.js";

const Q2_QUESTION_ID = "e2e0a002-0002-4000-8000-000000000001";
const Q3_QUESTION_ID = "e2e0a002-0002-4000-8000-000000000002";

export const E2E_QV_PASSWORD = "E2EQuizVis@2026";

export const E2E_QV_EMAILS = {
  teacher1: "e2e.qv.teacher1@fahimni.test",
  teacher2: "e2e.qv.teacher2@fahimni.test",
  student1: "e2e.qv.student1@fahimni.test",
  student2: "e2e.qv.student2@fahimni.test",
} as const;

export interface QuizVisibilityE2EFixture {
  teacher1Id: string;
  teacher2Id: string;
  student1Id: string;
  student2Id: string;
  stageId: string;
  chapterAId: string;
  lessonA1Id: string;
  lessonA2Id: string;
  lessonA3Id: string;
  quizQ1Id: string;
  quizQ2Id: string;
  quizQ3Id: string;
  q2QuestionId: string;
  q2WrongAnswer: string;
  q2CorrectAnswer: string;
}

let mobileSeq = 0;
function mobile(): string {
  mobileSeq += 1;
  return `0109${String(mobileSeq).padStart(7, "0")}`;
}

export async function seedQuizVisibilityE2EFixture(): Promise<QuizVisibilityE2EFixture> {
  const pwHash = await bcrypt.hash(E2E_QV_PASSWORD, 12);

  const teacher1 = await prisma.user.upsert({
    where: { email: E2E_QV_EMAILS.teacher1 },
    create: {
      fullName: "E2E QV Teacher 1",
      email: E2E_QV_EMAILS.teacher1,
      mobile: mobile(),
      password: pwHash,
      role: "OPERATION",
      status: "ACTIVE",
    },
    update: { password: pwHash, status: "ACTIVE" },
  });

  const teacher2 = await prisma.user.upsert({
    where: { email: E2E_QV_EMAILS.teacher2 },
    create: {
      fullName: "E2E QV Teacher 2",
      email: E2E_QV_EMAILS.teacher2,
      mobile: mobile(),
      password: pwHash,
      role: "OPERATION",
      status: "ACTIVE",
    },
    update: { password: pwHash, status: "ACTIVE" },
  });

  const student1 = await prisma.user.upsert({
    where: { email: E2E_QV_EMAILS.student1 },
    create: {
      fullName: "E2E QV Student 1",
      email: E2E_QV_EMAILS.student1,
      mobile: mobile(),
      password: pwHash,
      role: "STUDENT",
      status: "ACTIVE",
    },
    update: { password: pwHash, status: "ACTIVE" },
  });

  const student2 = await prisma.user.upsert({
    where: { email: E2E_QV_EMAILS.student2 },
    create: {
      fullName: "E2E QV Student 2",
      email: E2E_QV_EMAILS.student2,
      mobile: mobile(),
      password: pwHash,
      role: "STUDENT",
      status: "ACTIVE",
    },
    update: { password: pwHash, status: "ACTIVE" },
  });

  const stage = await prisma.stage.upsert({
    where: { id: "e2e-qv-stage-a" },
    create: {
      id: "e2e-qv-stage-a",
      name: "E2E QV Stage A",
      sortOrder: 9001,
      teacherId: teacher1.id,
    },
    update: { teacherId: teacher1.id, deletedAt: null },
  });

  const chapter = await prisma.chapter.upsert({
    where: { id: "e2e-qv-chapter-a" },
    create: {
      id: "e2e-qv-chapter-a",
      name: "E2E QV Chapter A",
      sortOrder: 1,
      stageId: stage.id,
      price: 0,
    },
    update: { deletedAt: null, stageId: stage.id, price: 0 },
  });

  const lessonA1 = await prisma.lesson.upsert({
    where: { id: "e2e-qv-lesson-a1" },
    create: {
      id: "e2e-qv-lesson-a1",
      title: "E2E Lesson A1",
      sortOrder: 1,
      durationMinutes: 10,
      chapterId: chapter.id,
      requiredQuizId: null,
    },
    update: {
      title: "E2E Lesson A1",
      chapterId: chapter.id,
      deletedAt: null,
    },
  });

  const lessonA2 = await prisma.lesson.upsert({
    where: { id: "e2e-qv-lesson-a2" },
    create: {
      id: "e2e-qv-lesson-a2",
      title: "E2E Lesson A2",
      sortOrder: 2,
      durationMinutes: 10,
      chapterId: chapter.id,
    },
    update: { chapterId: chapter.id, deletedAt: null },
  });

  const lessonA3 = await prisma.lesson.upsert({
    where: { id: "e2e-qv-lesson-a3" },
    create: {
      id: "e2e-qv-lesson-a3",
      title: "E2E Lesson A3",
      sortOrder: 3,
      durationMinutes: 10,
      chapterId: chapter.id,
    },
    update: { chapterId: chapter.id, deletedAt: null },
  });

  const quizQ1 = await prisma.quiz.upsert({
    where: { id: "e2e-qv-quiz-q1" },
    create: {
      id: "e2e-qv-quiz-q1",
      title: "E2E Q1 Optional Lesson Quiz",
      chapterId: chapter.id,
      status: "PUBLISHED",
      contentScope: "SELECTED_LESSONS",
      questionCount: 1,
      totalPoints: 1,
      durationMinutes: 15,
      passingScore: 50,
      createdBy: teacher1.id,
      publishedAt: new Date(),
    },
    update: {
      chapterId: chapter.id,
      status: "PUBLISHED",
      contentScope: "SELECTED_LESSONS",
    },
  });

  await prisma.quizLesson.upsert({
    where: {
      quizId_lessonId: { quizId: quizQ1.id, lessonId: lessonA1.id },
    },
    create: { quizId: quizQ1.id, lessonId: lessonA1.id },
    update: {},
  });

  const quizQ2 = await prisma.quiz.upsert({
    where: { id: "e2e-qv-quiz-q2" },
    create: {
      id: "e2e-qv-quiz-q2",
      title: "E2E Q2 Required Gate Quiz",
      chapterId: chapter.id,
      status: "PUBLISHED",
      contentScope: "CHAPTER",
      questionCount: 1,
      totalPoints: 10,
      durationMinutes: 20,
      passingScore: 50,
      createdBy: teacher1.id,
      publishedAt: new Date(),
    },
    update: {
      chapterId: chapter.id,
      status: "PUBLISHED",
      durationMinutes: 20,
      passingScore: 50,
    },
  });

  await prisma.question.deleteMany({
    where: {
      OR: [
        { id: { in: ["e2e-qv-q2-question-1", "e2e-qv-q3-question-1"] } },
        { quizId: { in: ["e2e-qv-quiz-q2", "e2e-qv-quiz-q3"] } },
      ],
    },
  });

  const q2Question = await prisma.question.upsert({
    where: { id: Q2_QUESTION_ID },
    create: {
      id: Q2_QUESTION_ID,
      quizId: quizQ2.id,
      type: "TRUE_FALSE",
      text: "E2E gate question",
      options: [...TF_OPTIONS],
      correctAnswer: TF_TRUE,
      points: 10,
      sortOrder: 1,
    },
    update: {
      quizId: quizQ2.id,
      options: [...TF_OPTIONS],
      correctAnswer: TF_TRUE,
    },
  });

  const quizQ3 = await prisma.quiz.upsert({
    where: { id: "e2e-qv-quiz-q3" },
    create: {
      id: "e2e-qv-quiz-q3",
      title: "E2E Q3 Chapter Quiz",
      chapterId: chapter.id,
      status: "PUBLISHED",
      contentScope: "CHAPTER",
      questionCount: 1,
      totalPoints: 5,
      durationMinutes: 10,
      passingScore: 50,
      createdBy: teacher1.id,
      publishedAt: new Date(),
    },
    update: { chapterId: chapter.id, status: "PUBLISHED", contentScope: "CHAPTER" },
  });

  await prisma.question.upsert({
    where: { id: Q3_QUESTION_ID },
    create: {
      id: Q3_QUESTION_ID,
      quizId: quizQ3.id,
      type: "TRUE_FALSE",
      text: "Chapter quiz question",
      options: [...TF_OPTIONS],
      correctAnswer: TF_TRUE,
      points: 5,
      sortOrder: 1,
    },
    update: {
      quizId: quizQ3.id,
      options: [...TF_OPTIONS],
      correctAnswer: TF_TRUE,
    },
  });

  await prisma.lesson.update({
    where: { id: lessonA1.id },
    data: { requiredQuizId: quizQ2.id },
  });

  await prisma.studentProfile.upsert({
    where: { userId: student1.id },
    create: { userId: student1.id, stageId: stage.id },
    update: { stageId: stage.id },
  });

  await prisma.studentProfile.upsert({
    where: { userId: student2.id },
    create: { userId: student2.id, stageId: stage.id },
    update: { stageId: stage.id },
  });

  await prisma.enrollment.upsert({
    where: {
      studentId_chapterId: { studentId: student1.id, chapterId: chapter.id },
    },
    create: {
      studentId: student1.id,
      chapterId: chapter.id,
      status: "ACTIVE",
      price: 0,
      paymentMethod: "FREE",
    },
    update: { status: "ACTIVE" },
  });

  await prisma.enrollment.upsert({
    where: {
      studentId_chapterId: { studentId: student2.id, chapterId: chapter.id },
    },
    create: {
      studentId: student2.id,
      chapterId: chapter.id,
      status: "ACTIVE",
      price: 0,
      paymentMethod: "FREE",
    },
    update: { status: "ACTIVE" },
  });

  await prisma.lessonProgress.deleteMany({
    where: {
      studentId: { in: [student1.id, student2.id] },
      lessonId: { in: [lessonA1.id, lessonA2.id, lessonA3.id] },
    },
  });

  await prisma.quizAttempt.deleteMany({
    where: {
      studentId: { in: [student1.id, student2.id] },
      quizId: { in: [quizQ1.id, quizQ2.id, quizQ3.id] },
    },
  });

  return {
    teacher1Id: teacher1.id,
    teacher2Id: teacher2.id,
    student1Id: student1.id,
    student2Id: student2.id,
    stageId: stage.id,
    chapterAId: chapter.id,
    lessonA1Id: lessonA1.id,
    lessonA2Id: lessonA2.id,
    lessonA3Id: lessonA3.id,
    quizQ1Id: quizQ1.id,
    quizQ2Id: quizQ2.id,
    quizQ3Id: quizQ3.id,
    q2QuestionId: q2Question.id,
    q2CorrectAnswer: TF_TRUE,
    q2WrongAnswer: TF_FALSE,
  };
}
