import type {
  MyCourse,
  StudentContentTreeItem,
} from '@/features/student/types/studentContent';

/** Real student dashboard route (fallback continuation target — the "All Content" hub). */
export const STUDENT_DASHBOARD_ROUTE = '/student/dashboard';

/**
 * Resolve the real "Continue" destination for an enrolled course (a chapter).
 *
 * The `GET /content/student/my-courses` contract does not return a next/last
 * lesson id, so we resolve the chapter's first lesson from the already-fetched
 * student content tree and deep-link to it by its real id
 * (`/student/lessons/:lessonId`). When the tree (or a lesson) is not available
 * we fall back to the real content hub — never to mock data or a fabricated id.
 */
export function courseContinueDestination(
  course: Pick<MyCourse, 'id'>,
  tree: StudentContentTreeItem[] | undefined,
): string {
  if (tree) {
    for (const stage of tree) {
      const match = stage.chapters.find((c) => c.chapter.id === course.id);
      if (match && match.lessons.length > 0) {
        const firstLesson = [...match.lessons].sort(
          (a, b) => a.sortOrder - b.sortOrder,
        )[0];
        if (firstLesson) {
          return `/student/lessons/${firstLesson.id}`;
        }
      }
    }
  }
  return STUDENT_DASHBOARD_ROUTE;
}
