import { describe, it, expect } from 'vitest';
import { mapApiQuestion } from '@/features/student/api/quiz';

/**
 * Students must never receive teacher-only generation metadata (source lesson,
 * source chapter, difficulty, generation source). The mapper whitelists fields,
 * so even if the API accidentally included such keys, they must not survive.
 */
describe('student question mapper hides teacher-only metadata', () => {
  it('drops any source/difficulty fields when mapping to a student question', () => {
    const rawWithLeak = {
      id: 'q1',
      type: 'MCQ',
      content: 'ما هي عاصمة مصر؟',
      options: { '1': 'القاهرة', '2': 'الجيزة' },
      points: 2,
      sortOrder: 1,
      // Fields that must NOT reach the student:
      sourceLessonId: 'L1',
      sourceLessonTitle: 'الدرس الأول',
      sourceChapterTitle: 'الباب الأول',
      difficulty: 'HARD',
      correctAnswer: 'القاهرة',
    } as unknown as Parameters<typeof mapApiQuestion>[0];

    const mapped = mapApiQuestion(rawWithLeak, 0, 'ar');
    const keys = Object.keys(mapped);

    expect(keys).not.toContain('sourceLessonId');
    expect(keys).not.toContain('sourceLessonTitle');
    expect(keys).not.toContain('sourceChapterTitle');
    expect(keys).not.toContain('difficulty');
    expect(keys).not.toContain('correctAnswer');
    // The legitimate student-facing fields survive.
    expect(mapped.id).toBe('q1');
    expect(mapped.points).toBe(2);
  });
});
