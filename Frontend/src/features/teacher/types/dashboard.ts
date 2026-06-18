/**
 * Teacher dashboard statistics — mirrors the backend contract returned by
 * GET /dashboard/teacher/stats (see backend/src/modules/dashboard).
 *
 * Activity entries are structured (no pre-rendered sentences); the UI composes
 * localized text from `action` + `entityType` + `actorName` + safe `metadata`.
 */

export type ActivityActorType = 'TEACHER' | 'STUDENT' | 'SYSTEM';

export interface RecentActivity {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  actorType: ActivityActorType | string | null;
  actorName: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

export interface TeacherDashboardStats {
  totalStages: number;
  totalChapters: number;
  totalLessons: number;
  totalStudents: number;
  totalQuizzes: number;
  recentActivity: RecentActivity[];
}
