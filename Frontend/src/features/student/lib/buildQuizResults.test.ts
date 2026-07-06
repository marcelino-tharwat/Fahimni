import { describe, it, expect } from 'vitest';
import { buildQuizResults, type SubmitAttemptResponse } from '@/features/student/api/quiz';

function baseResponse(over: Partial<SubmitAttemptResponse> = {}): SubmitAttemptResponse {
  return {
    attemptId: 'a1',
    quizId: 'q1',
    quizTitle: 'Quiz',
    status: 'GRADED',
    score: 8,
    totalPoints: 10,
    percentage: 80,
    pendingEssayCount: 0,
    isFinal: true,
    results: [
      {
        questionId: 'm1',
        type: 'MCQ',
        questionText: 'Q1',
        options: ['a', 'b'],
        studentAnswer: 'a',
        correctAnswer: 'b',
        result: 'incorrect',
        awardedPoints: 0,
        maxPoints: 2,
      },
    ],
    ...over,
  };
}

describe('buildQuizResults — respects hidden fields from the policy', () => {
  it('maps a full (legacy) response unchanged', () => {
    const r = buildQuizResults(baseResponse());
    expect(r.score).toBe(8);
    expect(r.finalScoreHidden).toBe(false);
    expect(r.results[0]!.correctAnswer).toBe('b');
    expect(r.results[0]!.studentAnswer).toBe('a');
    expect(r.reviewMessage).toBeNull();
  });

  it('flags finalScoreHidden when score is null', () => {
    const r = buildQuizResults(
      baseResponse({ score: null, totalPoints: null, percentage: null }),
    );
    expect(r.finalScoreHidden).toBe(true);
    expect(r.score).toBe(0);
  });

  it('renders no correct answer when the field is omitted', () => {
    const r = buildQuizResults(
      baseResponse({
        results: [
          {
            questionId: 'm1',
            type: 'MCQ',
            questionText: 'Q1',
            options: ['a', 'b'],
            result: 'incorrect',
            // studentAnswer / correctAnswer / awardedPoints omitted by policy
          },
        ],
      }),
    );
    expect(r.results[0]!.correctAnswer).toBeUndefined();
    expect(r.results[0]!.studentAnswer).toBe('');
    expect(r.results[0]!.awardedPoints).toBeNull();
  });

  it('flags correctnessHidden and neutralizes results when correctness is off', () => {
    const r = buildQuizResults(
      baseResponse({
        resultVisibility: {
          configured: true,
          showCorrectAnswers: false,
          showPerQuestionScores: false,
          showFinalScore: true,
          showStudentAnswers: true,
          showExplanations: false,
          pendingEssayResultMode: 'SHOW_OBJECTIVE_WITH_PENDING_MESSAGE',
        },
        results: [
          {
            questionId: 'm1',
            type: 'MCQ',
            questionText: 'Q1',
            options: ['a', 'b'],
            studentAnswer: 'a',
            // correctAnswer / awardedPoints / maxPoints omitted by the policy
            result: 'answered',
          },
        ],
      }),
    );
    expect(r.correctnessHidden).toBe(true);
    expect(r.results[0]!.status).toBe('answered');
    expect(r.results[0]!.studentAnswer).toBe('a');
    expect(r.results[0]!.correctAnswer).toBeUndefined();
    expect(r.results[0]!.scoreVisible).toBe(false);
    // No correct/wrong buckets when correctness is hidden.
    expect(r.correctCount).toBe(0);
    expect(r.wrongCount).toBe(0);
  });

  it('does not flag correctnessHidden when correct answers are shown', () => {
    const r = buildQuizResults(
      baseResponse({
        resultVisibility: {
          configured: true,
          showCorrectAnswers: true,
          showPerQuestionScores: false,
          showFinalScore: true,
          showStudentAnswers: true,
          showExplanations: false,
          pendingEssayResultMode: 'SHOW_OBJECTIVE_WITH_PENDING_MESSAGE',
        },
      }),
    );
    expect(r.correctnessHidden).toBe(false);
  });

  it('treats legacy (no resultVisibility) as correctness-visible', () => {
    const r = buildQuizResults(baseResponse());
    expect(r.correctnessHidden).toBe(false);
    expect(r.results[0]!.scoreVisible).toBe(true);
  });

  it('carries the pending review message and flag', () => {
    const r = buildQuizResults(
      baseResponse({
        isFinal: false,
        hasPendingEssayReview: true,
        message: 'النتيجة النهائية قيد المراجعة',
        score: null,
        totalPoints: null,
        percentage: null,
        results: [],
      }),
    );
    expect(r.hasPendingEssayReview).toBe(true);
    expect(r.reviewMessage).toBe('النتيجة النهائية قيد المراجعة');
    expect(r.results).toHaveLength(0);
  });
});
