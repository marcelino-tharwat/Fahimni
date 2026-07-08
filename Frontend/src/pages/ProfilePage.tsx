import { useTeacherProfile } from '@/features/teacher/hooks/useTeacherProfile';
import { useTeacherDashboardStats } from '@/features/teacher/hooks/useTeacherDashboardStats';
import { TeachingStatsCard } from '@/components/profile/TeachingStatsCard';
import { RecentActivityCard } from '@/components/profile/RecentActivityCard';
import { StudentEngagementCard } from '@/components/profile/StudentEngagementCard';
import { ProfileInfoCard } from '@/components/profile/ProfileInfoCard';
import { AcademicIdentityCard } from '@/components/profile/AcademicIdentityCard';
import { SupportSettingsCard } from '@/components/profile/SupportSettingsCard';
import type { TeacherProfile } from '@/features/teacher/types/teacher';
import type { RecentActivity } from '@/features/teacher/types/dashboard';
import type { ActivityItem } from '@/types/profile.types';

const ACTION_KEY_MAP: Record<string, ActivityItem['actionKey']> = {
  LESSON_CREATED: 'upload',
  STUDENT_ENROLLED: 'enrollment',
  LESSON_UPDATED: 'edit',
  CHAPTER_UPDATED: 'edit',
  STAGE_UPDATED: 'edit',
  QUIZ_UPDATED: 'edit',
  LESSON_DELETED: 'delete',
  CHAPTER_DELETED: 'delete',
  STAGE_DELETED: 'delete',
  QUIZ_DELETED: 'delete',
};

function actionKeyFromAction(action: string): ActivityItem['actionKey'] {
  return ACTION_KEY_MAP[action] ?? 'edit';
}

function extractTitle(_action: string, entityType: string, metadata: Record<string, unknown> | null): string | undefined {
  if (!metadata) return undefined;
  const nameKeyMap: Record<string, string[]> = {
    LESSON: ['lessonName', 'name', 'title'],
    CHAPTER: ['chapterName', 'name', 'title'],
    STAGE: ['stageName', 'name'],
    QUIZ: ['quizName', 'name', 'title'],
    ENROLLMENT: ['stageName', 'count'],
  };
  const keys = nameKeyMap[entityType] ?? ['name', 'title'];
  for (const key of keys) {
    const val = metadata[key];
    if (typeof val === 'string') return val;
  }
  return undefined;
}

function extractCount(metadata: Record<string, unknown> | null): number | undefined {
  if (!metadata) return undefined;
  const val = metadata.count ?? metadata.studentCount;
  return typeof val === 'number' ? val : undefined;
}

function formatRelativeTime(isoString: string): string {
  const now = Date.now();
  const date = new Date(isoString).getTime();
  const diffMs = now - date;
  if (diffMs < 0) return 'Just now';

  const seconds = Math.floor(diffMs / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  const weeks = Math.floor(days / 7);

  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days}d ago`;
  if (weeks === 1) return '1 week ago';
  return `${weeks}w ago`;
}

function toActivityItem(activity: RecentActivity): ActivityItem {
  const actionKey = actionKeyFromAction(activity.action);
  const entityName = extractTitle(activity.action, activity.entityType, activity.metadata);
  const count = extractCount(activity.metadata);

  let title: string | undefined;
  if (entityName) {
    if (actionKey === 'upload') title = `New lesson uploaded: ${entityName}`;
    else if (actionKey === 'edit') title = `${activity.entityType.toLowerCase()} updated: ${entityName}`;
    else if (actionKey === 'delete') title = `${activity.entityType.toLowerCase()} removed: ${entityName}`;
    else if (actionKey === 'enrollment' && count) title = `${count} new students joined`;
    else title = entityName;
  }

  return {
    id: activity.id,
    actionKey,
    timestamp: 'upload',
    title,
    formattedTime: formatRelativeTime(activity.createdAt),
  };
}

function mapRecentActivities(activities: RecentActivity[]): ActivityItem[] {
  return activities.slice(0, 5).map(toActivityItem);
}

function mapProfileData(
  data: TeacherProfile | undefined,
  dashboardData: { stages: number; chapters: number; students: number; lessons: number } | undefined,
) {
  return {
    profile: data ?? null,
    reviewCount: 32,
    stats: dashboardData ?? { stages: 0, chapters: 0, students: 0, lessons: 0 },
    completion: { rate: 0, completed: 0, total: dashboardData?.students ?? 0 },
    engagement: { total: 390, trend: 20 },
    grades: [
      { labelKey: 'studentEngagement.grades.first', count: 12, percentage: 65, barColor: 'bg-cyan-500' },
      { labelKey: 'studentEngagement.grades.second', count: 18, percentage: 85, barColor: 'bg-purple-500' },
      { labelKey: 'studentEngagement.grades.third', count: 9, percentage: 45, barColor: 'bg-success-500' },
    ] as const,
  };
}

export function ProfilePage() {
  const { data, isLoading: profileLoading } = useTeacherProfile();
  const { data: dashboardData, isLoading: dashboardLoading } = useTeacherDashboardStats();
  const isLoading = profileLoading || dashboardLoading;

  const mapped = mapProfileData(data, dashboardData ? {
    stages: dashboardData.totalStages,
    chapters: dashboardData.totalChapters,
    students: dashboardData.totalStudents,
    lessons: dashboardData.totalLessons,
  } : undefined);

  const activities = dashboardData?.recentActivity
    ? mapRecentActivities(dashboardData.recentActivity)
    : [];

  return (
    <div className="grid grid-cols-[320px_1fr] gap-6 items-start">
      <div className="flex flex-col gap-6">
        <ProfileInfoCard
          isLoading={isLoading}
          profile={mapped.profile}
          reviewCount={mapped.reviewCount}
        />
        <AcademicIdentityCard
          isLoading={isLoading}
          profile={mapped.profile}
        />
      </div>
      <div className="flex flex-col gap-6">
        <TeachingStatsCard
          isLoading={isLoading}
          stats={mapped.stats}
          completion={mapped.completion}
        />
        <RecentActivityCard
          isLoading={isLoading}
          activities={activities}
        />
        <StudentEngagementCard
          isLoading={isLoading}
          totalEnrolled={mapped.engagement.total}
          trend={mapped.engagement.trend}
          grades={mapped.grades}
        />
        <SupportSettingsCard
          isLoading={isLoading}
          profile={mapped.profile}
        />
      </div>
    </div>
  );
}
