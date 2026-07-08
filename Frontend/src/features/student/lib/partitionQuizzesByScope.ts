import type {
  ChapterGroup,
  QuizItem,
  StudentQuizzesData,
} from '@/features/student/types/studentQuiz';

/**
 * The `/student/quizzes` list, re-organized into three top-level buckets by the
 * backend-resolved `sourceScope`. A quiz appears in exactly one bucket.
 *
 * - `fullCurriculum` — FULL_CURRICULUM quizzes
 * - `multiChapter` — MULTI_CHAPTER quizzes
 * - `chapters` — per-chapter accordions holding ONLY SINGLE_CHAPTER quizzes (or
 *   quizzes with a missing scope, as a legacy fallback). Chapters left with no
 *   quiz after partitioning are dropped so empty accordions never render.
 *
 * Scope is never trusted from the client; this only re-groups what the backend
 * projection already resolved.
 */
export interface PartitionedQuizzes {
  fullCurriculum: QuizItem[];
  multiChapter: QuizItem[];
  chapters: ChapterGroup[];
}

function scopeOf(quiz: QuizItem): 'FULL_CURRICULUM' | 'MULTI_CHAPTER' | 'SINGLE_CHAPTER' {
  // Missing scope → legacy quiz → treat as single-chapter (per-chapter accordion).
  if (quiz.sourceScope === 'FULL_CURRICULUM') return 'FULL_CURRICULUM';
  if (quiz.sourceScope === 'MULTI_CHAPTER') return 'MULTI_CHAPTER';
  return 'SINGLE_CHAPTER';
}

export function partitionQuizzesByScope(
  data: StudentQuizzesData,
): PartitionedQuizzes {
  const fullCurriculum: QuizItem[] = [];
  const multiChapter: QuizItem[] = [];

  const chapters = data.chapters
    .map((chapter): ChapterGroup => {
      const singleChapter: QuizItem[] = [];
      for (const quiz of chapter.quizzes) {
        switch (scopeOf(quiz)) {
          case 'FULL_CURRICULUM':
            fullCurriculum.push(quiz);
            break;
          case 'MULTI_CHAPTER':
            multiChapter.push(quiz);
            break;
          default:
            singleChapter.push(quiz);
        }
      }
      return { ...chapter, quizzes: singleChapter };
    })
    // A chapter whose quizzes were all pulled into the top sections must not
    // render as an empty accordion.
    .filter((chapter) => chapter.quizzes.length > 0);

  return { fullCurriculum, multiChapter, chapters };
}
