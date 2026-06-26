import { AppError } from '../../shared/utils/AppError.js';
import { QuizzesRepository } from './quizzes.repository.js';
import type { SubmitAttemptInput, AttemptResult, QuestionResult } from './quizzes.types.js';

export class QuizzesService {
  constructor(private readonly repository = new QuizzesRepository()) {}

  async submitAttempt(input: SubmitAttemptInput): Promise<AttemptResult> {
    const quiz = await this.repository.getQuizWithQuestions(input.quizId);

    if (!quiz) {
      throw new AppError('Quiz not found', 404);
    }

    const questionMap = new Map(quiz.questions.map((q) => [q.id, q]));

    let score = 0;
    let totalPoints = 0;
    let hasEssayQuestions = false;
    const results: QuestionResult[] = [];

    for (const answer of input.answers) {
      const question = questionMap.get(answer.questionId);

      if (!question) {
        throw new AppError(`Invalid question id: ${answer.questionId}`, 400);
      }

      let isCorrect: boolean | null = null;
      let points = 0;

      if (question.type === 'essay') {
        hasEssayQuestions = true;
        isCorrect = null;
        points = 0;
      } else {
        const submitted = answer.submittedAnswer?.trim().toLowerCase() ?? '';
        const correct = question.correctAnswer?.toLowerCase() ?? '';

        if (question.type === 'mcq') {
          if (!['a', 'b', 'c', 'd'].includes(submitted)) {
            throw new AppError(`Invalid MCQ answer for question ${answer.questionId}`, 400);
          }
          isCorrect = submitted === correct;
          points = isCorrect ? question.points : 0;
        } else if (question.type === 'true_false') {
          if (!['true', 'false'].includes(submitted)) {
            throw new AppError(`Invalid True/False answer for question ${answer.questionId}`, 400);
          }
          isCorrect = submitted === correct;
          points = isCorrect ? question.points : 0;
        }

        score += points;
        totalPoints += question.points;
      }

      results.push({
        questionId: question.id,
        type: question.type as 'mcq' | 'true_false' | 'essay',
        submittedAnswer: answer.submittedAnswer,
        correctAnswer: question.correctAnswer,
        isCorrect,
        points,
      });
    }

    const percentage = totalPoints > 0 ? (score / totalPoints) * 100 : 0;
    const status = hasEssayQuestions ? 'partial' : 'graded';

    const attempt = await this.repository.saveAttemptWithAnswers(
      quiz.id,
      input.studentId,
      status,
      score,
      totalPoints,
      percentage,
      results,
    );

    return {
      attemptId: attempt.id,
      quizId: quiz.id,
      status: attempt.status as 'graded' | 'partial',
      score: attempt.score,
      totalPoints: attempt.totalPoints,
      percentage: attempt.percentage,
      results,
    };
  }
}
