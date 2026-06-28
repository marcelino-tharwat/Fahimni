import type { EnrollmentStatus } from '@/features/student/types/studentContent';

/**
 * Normalized chapter shape the payment surface renders. Built from a node in the
 * student content tree (the authoritative source for price, stage name, lessons
 * and `enrollmentStatus`) since there is no single-chapter endpoint.
 */
export interface ChapterData {
  id: string;
  name: string;
  description?: string | null;
  price: number | null;
  lessonCount: number;
  stageName: string;
  enrollmentStatus: EnrollmentStatus;
  /** First lesson id, used to deep-link into the course after enrollment. */
  firstLessonId: string | null;
}
