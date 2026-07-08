import { describe, it, expect } from 'vitest';
import { partitionQuizzesByScope } from './partitionQuizzesByScope';
import type {
  QuizItem,
  StudentQuizzesData,
} from '@/features/student/types/studentQuiz';

function quiz(overrides: Partial<QuizItem> = {}): QuizItem {
  return {
    id: 'q1',
    title: 'Quiz',
    questionCount: 5,
    points: 10,
    durationMinutes: 30,
    difficulty: 'medium',
    status: 'new',
    ...overrides,
  };
}

function data(chapters: StudentQuizzesData['chapters']): StudentQuizzesData {
  const all = chapters.flatMap((c) => c.quizzes);
  return {
    totalCount: all.length,
    completedCount: all.filter((q) => q.status === 'passed' || q.status === 'failed').length,
    newCount: all.filter((q) => q.status === 'new').length,
    chapters,
  };
}

describe('partitionQuizzesByScope', () => {
  it('splits quizzes into three scope buckets', () => {
    const result = partitionQuizzesByScope(
      data([
        {
          id: 'c1',
          title: 'Chapter 1',
          stage: 'Stage',
          defaultOpen: true,
          quizzes: [
            quiz({ id: 'full', sourceScope: 'FULL_CURRICULUM' }),
            quiz({ id: 'multi', sourceScope: 'MULTI_CHAPTER' }),
            quiz({ id: 'single', sourceScope: 'SINGLE_CHAPTER' }),
          ],
        },
      ]),
    );

    expect(result.fullCurriculum.map((q) => q.id)).toEqual(['full']);
    expect(result.multiChapter.map((q) => q.id)).toEqual(['multi']);
    expect(result.chapters).toHaveLength(1);
    expect(result.chapters[0].quizzes.map((q) => q.id)).toEqual(['single']);
  });

  it('places each quiz in exactly one bucket (no duplication)', () => {
    const result = partitionQuizzesByScope(
      data([
        {
          id: 'c1',
          title: 'Chapter 1',
          stage: 'Stage',
          defaultOpen: true,
          quizzes: [
            quiz({ id: 'full', sourceScope: 'FULL_CURRICULUM' }),
            quiz({ id: 'multi', sourceScope: 'MULTI_CHAPTER' }),
            quiz({ id: 'single', sourceScope: 'SINGLE_CHAPTER' }),
          ],
        },
      ]),
    );

    const ids = [
      ...result.fullCurriculum,
      ...result.multiChapter,
      ...result.chapters.flatMap((c) => c.quizzes),
    ].map((q) => q.id);
    expect(ids).toHaveLength(3);
    expect(new Set(ids).size).toBe(3);
  });

  it('treats a missing sourceScope as a single-chapter legacy fallback', () => {
    const result = partitionQuizzesByScope(
      data([
        {
          id: 'c1',
          title: 'Chapter 1',
          stage: 'Stage',
          defaultOpen: true,
          quizzes: [quiz({ id: 'legacy' })], // no sourceScope
        },
      ]),
    );

    expect(result.fullCurriculum).toHaveLength(0);
    expect(result.multiChapter).toHaveLength(0);
    expect(result.chapters[0].quizzes.map((q) => q.id)).toEqual(['legacy']);
  });

  it('drops chapters left empty after pulling out top-level quizzes', () => {
    const result = partitionQuizzesByScope(
      data([
        {
          id: 'c1',
          title: 'Chapter 1',
          stage: 'Stage',
          defaultOpen: true,
          quizzes: [quiz({ id: 'full', sourceScope: 'FULL_CURRICULUM' })],
        },
        {
          id: 'c2',
          title: 'Chapter 2',
          stage: 'Stage',
          defaultOpen: true,
          quizzes: [quiz({ id: 'single', sourceScope: 'SINGLE_CHAPTER' })],
        },
      ]),
    );

    expect(result.chapters.map((c) => c.id)).toEqual(['c2']);
  });

  it('preserves chapter metadata (id/title/stage/defaultOpen)', () => {
    const result = partitionQuizzesByScope(
      data([
        {
          id: 'c1',
          title: 'Algebra',
          stage: 'Grade 10',
          defaultOpen: false,
          quizzes: [quiz({ id: 'single', sourceScope: 'SINGLE_CHAPTER' })],
        },
      ]),
    );

    expect(result.chapters[0]).toMatchObject({
      id: 'c1',
      title: 'Algebra',
      stage: 'Grade 10',
      defaultOpen: false,
    });
  });
});
