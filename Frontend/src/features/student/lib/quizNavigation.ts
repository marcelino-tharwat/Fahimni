import type { QuizItem } from '@/features/student/types/studentQuiz';

export type QuizStudentAction = 'start' | 'resume' | 'viewResult' | 'retake';

/** Decide which action the student should take for a quiz row/card. */
export function resolveQuizStudentAction(quiz: QuizItem): QuizStudentAction {
  if (quiz.retakeAllowed && quiz.status === 'failed') return 'retake';
  if (quiz.status === 'new') return 'start';
  if (quiz.status === 'passed' || quiz.status === 'failed') return 'viewResult';
  if (quiz.status === 'pending') {
    if (quiz.attemptStatus === 'IN_PROGRESS') return 'resume';
    if (quiz.attemptId) return 'viewResult';
  }
  return 'start';
}
