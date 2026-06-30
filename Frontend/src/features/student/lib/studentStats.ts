import type { MyCourse } from '@/features/student/types/studentContent';

/**
 * Overall completion across all enrolled courses, weighted by each course's
 * lesson count so a 100%-complete 2-lesson chapter doesn't outweigh a 10%
 * 40-lesson chapter. Returns an integer 0-100.
 *
 * The backend exposes progress only per enrolled chapter
 * (`MyCourse.completionProgress`), so this is the only honest way to derive a
 * single "overall" number — there is no aggregate endpoint.
 */
export function overallProgress(courses: MyCourse[] | undefined): number {
  if (!courses || courses.length === 0) return 0;

  let weightedSum = 0;
  let totalLessons = 0;
  for (const course of courses) {
    const lessons = course.lessonCount ?? 0;
    weightedSum += (course.completionProgress ?? 0) * lessons;
    totalLessons += lessons;
  }

  // No lessons to weight by (e.g. brand-new chapters): fall back to a plain
  // average so the number is still meaningful rather than 0.
  if (totalLessons === 0) {
    const avg =
      courses.reduce((sum, c) => sum + (c.completionProgress ?? 0), 0) / courses.length;
    return Math.round(avg);
  }

  return Math.round(weightedSum / totalLessons);
}
