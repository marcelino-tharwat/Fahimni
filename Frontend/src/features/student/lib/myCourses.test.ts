import { describe, it, expect } from 'vitest';
import {
  courseContinueDestination,
  STUDENT_CONTENT_ROUTE,
} from './myCourses';
import type { StudentContentTreeItem } from '@/features/student/types/studentContent';

/** Realistic tree fixture shaped exactly like GET /content/student/tree. */
function treeFixture(): StudentContentTreeItem[] {
  return [
    {
      stage: { id: 'stage-1', name: 'الصف الأول الثانوي', sortOrder: 1, chapterCount: 1 },
      chapters: [
        {
          chapter: {
            id: 'chapter-a',
            name: 'الجبر',
            description: null,
            sortOrder: 1,
            price: null,
            lessonCount: 2,
            enrollmentStatus: 'free',
          },
          // Intentionally out of order to prove we sort by sortOrder.
          lessons: [
            { id: 'lesson-a2', title: 'الدرس الثاني', sortOrder: 2 },
            { id: 'lesson-a1', title: 'الدرس الأول', sortOrder: 1 },
          ],
        },
      ],
    },
    {
      stage: { id: 'stage-2', name: 'الصف الثاني الثانوي', sortOrder: 2, chapterCount: 1 },
      chapters: [
        {
          chapter: {
            id: 'chapter-empty',
            name: 'فصل بلا دروس',
            description: null,
            sortOrder: 1,
            price: null,
            lessonCount: 0,
            enrollmentStatus: 'free',
          },
          lessons: [],
        },
      ],
    },
  ];
}

describe('courseContinueDestination', () => {
  it('deep-links to the chapter\'s first lesson by its real id (sorted by sortOrder)', () => {
    const dest = courseContinueDestination({ id: 'chapter-a' }, treeFixture());
    expect(dest).toBe('/student/lessons/lesson-a1');
  });

  it('uses the real lesson id from the response, not a hardcoded value', () => {
    const tree = treeFixture();
    // Mutate the fixture id to ensure the function reads the actual data.
    tree[0]!.chapters[0]!.lessons[1]!.id = 'real-lesson-xyz';
    expect(courseContinueDestination({ id: 'chapter-a' }, tree)).toBe(
      '/student/lessons/real-lesson-xyz',
    );
  });

  it('falls back to the real content hub when the tree is not loaded', () => {
    expect(courseContinueDestination({ id: 'chapter-a' }, undefined)).toBe(
      STUDENT_CONTENT_ROUTE,
    );
  });

  it('falls back to the content hub when the chapter has no lessons', () => {
    expect(courseContinueDestination({ id: 'chapter-empty' }, treeFixture())).toBe(
      STUDENT_CONTENT_ROUTE,
    );
  });

  it('falls back to the content hub when the chapter is not in the tree', () => {
    expect(courseContinueDestination({ id: 'unknown' }, treeFixture())).toBe(
      STUDENT_CONTENT_ROUTE,
    );
  });

  it('never targets the legacy /student/courses page and never uses mock data', () => {
    const dest = courseContinueDestination({ id: 'chapter-a' }, treeFixture());
    expect(dest).not.toBe('/student/courses');
    expect(dest.toLowerCase()).not.toContain('mock');
    expect(STUDENT_CONTENT_ROUTE).toBe('/student/content');
  });
});
