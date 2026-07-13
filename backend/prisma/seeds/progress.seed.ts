import type { PrismaClient } from "../../src/generated/prisma/client.js";
import { seedId } from "./ids.js";
import { randomChoice, randomInt, daysAgo, weightedRandom } from "./helpers.js";
import { PROGRESS_DISTRIBUTION, PROGRESS_WEIGHTS, BATCH_SIZE } from "./constants.js";

export async function seedProgress(
  prisma: PrismaClient,
  studentIds: string[],
  chapterLessons: { chapterId: string; lessonId: string }[],
  quizzes: { id: string; chapterId: string; questionCount: number; totalPoints: number; status: string }[],
) {
  // ── Lesson Progress ──
  const progressData: {
    id: string; studentId: string; lessonId: string;
    completed: boolean; createdAt: Date;
  }[] = [];

  const seenProgress = new Set<string>();

  for (const studentId of studentIds) {
    // Each student progresses through some lessons
    const numLessons = randomInt(5, 30);
    const selectedLessons = chapterLessons
      .sort(() => Math.random() - 0.5)
      .slice(0, numLessons);

    for (const { lessonId } of selectedLessons) {
      const key = `${studentId}-${lessonId}`;
      if (seenProgress.has(key)) continue;
      seenProgress.add(key);

      const progressPct = PROGRESS_DISTRIBUTION[weightedRandom([...PROGRESS_WEIGHTS])]!;
      const completed = progressPct === 100;

      progressData.push({
        id: seedId(`progress-${studentId.slice(0, 8)}-${lessonId.slice(0, 8)}`),
        studentId,
        lessonId,
        completed,
        createdAt: daysAgo(randomInt(1, 30)),
      });
    }
  }

  const progressChunks = progressData.reduce(
    (acc, item, i) => {
      const chunkIndex = Math.floor(i / BATCH_SIZE);
      if (!acc[chunkIndex]) acc[chunkIndex] = [];
      acc[chunkIndex].push(item);
      return acc;
    },
    [] as typeof progressData[],
  );

  for (const chunk of progressChunks) {
    await prisma.lessonProgress.createMany({ data: chunk, skipDuplicates: true });
  }

  console.log(`  ✓ Lesson Progress: ${progressData.length} created`);

  // ── Quiz Attempts ──
  const attemptData: {
    id: string; quizId: string; studentId: string; answers: any;
    score: number | null; totalPoints: number;
    status: "COMPLETED" | "GRADED"; startedAt: Date;
    completedAt: Date; submissionReason: "MANUAL";
  }[] = [];

  const seenAttempts = new Set<string>();

  for (const studentId of studentIds) {
    // Each student attempts 2-8 quizzes
    const numAttempts = randomInt(2, 8);
    const studentQuizzes = quizzes
      .filter(q => q.status === "PUBLISHED")
      .sort(() => Math.random() - 0.5)
      .slice(0, numAttempts);

    for (const quiz of studentQuizzes) {
      const key = `${quiz.id}-${studentId}`;
      if (seenAttempts.has(key)) continue;
      seenAttempts.add(key);

      const hasEssay = quiz.questionCount > 0;
      const isGraded = Math.random() > 0.3;
      const score = isGraded
        ? Math.round(quiz.totalPoints * (0.3 + Math.random() * 0.7))
        : null;

      // Generate realistic answers JSON
      const answers: Record<string, any> = {};
      for (let q = 0; q < quiz.questionCount; q++) {
        answers[String(q)] = {
          selectedOption: randomChoice(["0", "1", "2", "3"]),
          text: q === quiz.questionCount - 1 ? "إجابة تفاعلية" : undefined,
        };
      }

      attemptData.push({
        id: seedId(`attempt-${quiz.id.slice(0, 8)}-${studentId.slice(0, 8)}`),
        quizId: quiz.id,
        studentId,
        answers,
        score,
        totalPoints: quiz.totalPoints,
        status: isGraded ? "GRADED" : "COMPLETED",
        startedAt: daysAgo(randomInt(1, 30)),
        completedAt: daysAgo(randomInt(1, 29)),
        submissionReason: "MANUAL",
      });
    }
  }

  const attemptChunks = attemptData.reduce(
    (acc, item, i) => {
      const chunkIndex = Math.floor(i / BATCH_SIZE);
      if (!acc[chunkIndex]) acc[chunkIndex] = [];
      acc[chunkIndex].push(item);
      return acc;
    },
    [] as typeof attemptData[],
  );

  for (const chunk of attemptChunks) {
    await prisma.quizAttempt.createMany({ data: chunk, skipDuplicates: true });
  }

  console.log(`  ✓ Quiz Attempts: ${attemptData.length} created`);
}
