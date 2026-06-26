import { prisma } from '../../config/database.js';
import type { QuestionResult } from './quizzes.types.js';

export class QuizzesRepository {
  async getQuizWithQuestions(quizId: string) {
    return prisma.quiz.findUnique({
      where: { id: quizId },
      include: { questions: true },
    });
  }

  async saveAttemptWithAnswers(
    quizId: string,
    studentId: string,
    status: 'graded' | 'partial',
    score: number,
    totalPoints: number,
    percentage: number,
    results: QuestionResult[],
  ) {
    return prisma.$transaction(async (tx) => {
      const attempt = await tx.quizAttempt.create({
        data: {
          quizId,
          studentId,
          status,
          score,
          totalPoints,
          percentage,
        },
      });

      await tx.questionAnswer.createMany({
        data: results.map((r) => ({
          attemptId: attempt.id,
          questionId: r.questionId,
          submittedAnswer: r.submittedAnswer,
          isCorrect: r.isCorrect,
          points: r.points,
        })),
      });

      return attempt;
    });
  }

  async getAttemptById(attemptId: string) {
    return prisma.quizAttempt.findUnique({
      where: { id: attemptId },
      include: { answers: true },
    });
  }
}
