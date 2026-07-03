import { describe, expect, it } from "vitest";
import { resolveQuizStudentAction } from '@/features/student/lib/quizNavigation';
import type { StudentQuizVisibility } from '@/features/student/types/studentQuiz';

function visibilityFixture(
  overrides: Partial<StudentQuizVisibility> = {},
): StudentQuizVisibility {
  return {
    id: 'q1',
    title: 'Quiz',
    description: null,
    chapterId: 'ch1',
    contentScope: 'SELECTED_LESSONS',
    linkedLessonIds: ['l1'],
    isRequiredForProgression: false,
    requiredForLessonId: null,
    questionCount: 5,
    totalPoints: 10,
    durationMinutes: 30,
    displayStatus: 'new',
    attemptId: null,
    studentAttemptStatus: 'NOT_STARTED',
    ...overrides,
  };
}

describe('lesson quiz visibility mapping', () => {
  it('optional lesson-linked quiz uses start action when new', () => {
    const quiz = visibilityFixture();
    const action = resolveQuizStudentAction({
      id: quiz.id,
      title: quiz.title,
      questionCount: quiz.questionCount,
      points: quiz.totalPoints,
      durationMinutes: quiz.durationMinutes,
      difficulty: 'medium',
      status: quiz.displayStatus,
      attemptId: quiz.attemptId,
      attemptStatus: null,
    });
    expect(action).toBe('start');
  });

  it('required quiz in progress uses resume', () => {
    const quiz = visibilityFixture({
      displayStatus: 'pending',
      studentAttemptStatus: 'IN_PROGRESS',
      attemptId: 'a1',
      isRequiredForProgression: true,
    });
    const action = resolveQuizStudentAction({
      id: quiz.id,
      title: quiz.title,
      questionCount: quiz.questionCount,
      points: quiz.totalPoints,
      durationMinutes: quiz.durationMinutes,
      difficulty: 'medium',
      status: quiz.displayStatus,
      attemptId: quiz.attemptId,
      attemptStatus: 'IN_PROGRESS',
    });
    expect(action).toBe('resume');
  });
});
