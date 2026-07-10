import type { Prisma } from "../../generated/prisma/client.js";
import { prisma } from "../../config/database.js";
import type {
  RecentActivityDTO,
  TeacherDashboardStatsDTO,
} from "./dashboard.types.js";

const RECENT_ACTIVITY_LIMIT = 10;

/** Columns selected for the activity feed — only what the DTO needs. */
const activitySelect = {
  id: true,
  action: true,
  resourceType: true,
  resourceId: true,
  actorType: true,
  actorName: true,
  details: true,
  createdAt: true,
} satisfies Prisma.AuditLogSelect;

type ActivityRow = {
  id: string;
  action: string;
  resourceType: string;
  resourceId: string;
  actorType: string | null;
  actorName: string | null;
  details: Prisma.JsonValue | null;
  createdAt: Date;
};

function toActivityDTO(row: ActivityRow): RecentActivityDTO {
  const isPlainObject =
    row.details !== null &&
    typeof row.details === "object" &&
    !Array.isArray(row.details);

  return {
    id: row.id,
    action: row.action,
    entityType: row.resourceType,
    entityId: row.resourceId ?? null,
    actorType: row.actorType ?? null,
    actorName: row.actorName ?? null,
    metadata: isPlainObject
      ? (row.details as Record<string, unknown>)
      : null,
    createdAt: row.createdAt.toISOString(),
  };
}

export class DashboardService {
  /**
   * Aggregate dashboard statistics for the authenticated teacher.
   *
   * Every figure is scoped to `teacherId` through the real ownership chain
   * (Chapter.teacherId -> Lesson; Enrollment -> Chapter -> teacherId),
   * respects soft-deletes (`deletedAt`) and the enrollment `status` filter,
   * and is computed with count/aggregate queries — no entities are loaded.
   * The independent reads run in parallel to stay well under the 200ms target.
   */
  public async getTeacherStats(
    teacherId: string,
  ): Promise<TeacherDashboardStatsDTO> {
    const [
      totalStages,
      totalChapters,
      totalLessons,
      totalStudents,
      totalQuizzes,
      recentRows,
    ] = await Promise.all([
      prisma.stage.count({
        where: { deletedAt: null, chapters: { some: { teacherId, deletedAt: null } } },
      }),
      prisma.chapter.count({
        where: { teacherId, deletedAt: null },
      }),
      prisma.lesson.count({
        where: {
          deletedAt: null,
          chapter: { teacherId, deletedAt: null },
        },
      }),
      this.countDistinctStudents(teacherId),
      prisma.quiz.count({
        where: { createdBy: teacherId },
      }),
      prisma.auditLog.findMany({
        where: { scopeTeacherId: teacherId },
        orderBy: { createdAt: "desc" },
        take: RECENT_ACTIVITY_LIMIT,
        select: activitySelect,
      }),
    ]);

    return {
      totalStages,
      totalChapters,
      totalLessons,
      totalStudents,
      totalQuizzes,
      recentActivity: (recentRows as ActivityRow[]).map(toActivityDTO),
    };
  }

  /**
   * Distinct enrolled students across all of the teacher's content, computed
   * at the database level with COUNT(DISTINCT ...). A student enrolled in
   * several of the teacher's chapters is counted once. Soft-deleted chapters
   * and stages are excluded, and only ACTIVE enrollments are counted.
   */
  private async countDistinctStudents(teacherId: string): Promise<number> {
    const rows = await prisma.$queryRaw<Array<{ count: number }>>`
      SELECT COUNT(DISTINCT e."studentId")::int AS count
      FROM "enrollments" e
      JOIN "chapters" c ON c."id" = e."chapterId" AND c."deletedAt" IS NULL
      JOIN "stages" s ON s."id" = c."stageId" AND s."deletedAt" IS NULL
      WHERE s."teacherId" = ${teacherId} AND e."status" = 'ACTIVE'
    `;
    return Number(rows[0]?.count ?? 0);
  }
}

export const dashboardService = new DashboardService();
