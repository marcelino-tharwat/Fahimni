import type { QuestionResult } from '@/features/student/types/quizResults';

export type ResultVisualTone = 'correct' | 'incorrect' | 'pending';

/** Map backend per-question status to the three summary buckets the UI uses. */
export function resolveResultTone(
  result: Pick<QuestionResult, 'status' | 'awardedPoints'>,
): ResultVisualTone {
  if (result.status === 'pending') return 'pending';
  if (result.status === 'incorrect') return 'incorrect';
  if (result.status === 'correct') return 'correct';
  if (result.status === 'graded') {
    return (result.awardedPoints ?? 0) > 0 ? 'correct' : 'incorrect';
  }
  return 'pending';
}

export function summarizeQuizResults(results: QuestionResult[]) {
  let correctCount = 0;
  let wrongCount = 0;
  let pendingCount = 0;

  for (const result of results) {
    const tone = resolveResultTone(result);
    if (tone === 'correct') correctCount++;
    else if (tone === 'incorrect') wrongCount++;
    else pendingCount++;
  }

  return { correctCount, wrongCount, pendingCount };
}
