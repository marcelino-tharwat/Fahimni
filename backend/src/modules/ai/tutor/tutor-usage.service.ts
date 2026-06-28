import { prisma as defaultPrisma } from "../../../config/database.js";
import { env } from "../../../config/env.js";

type PrismaLike = typeof defaultPrisma;

/** Read-only snapshot of a student's usage for the current server day. */
export interface UsageSnapshot {
  used: number;
  limit: number;
  remaining: number;
  resetsAt: string;
}

/**
 * STORY-64/65 — per-student daily AI-tutor quota accounting.
 *
 * One row per student per UTC calendar day in `ai_tutor_usage`. `tryClaim`
 * performs an **atomic** insert-or-conditional-increment: the row's unique
 * constraint serializes concurrent requests so two simultaneous calls at the
 * final slot cannot both succeed. `refund` reverses a claim when the tutor fails
 * with a transient/reversible error so quota is not permanently consumed.
 *
 * STORY-65 adds the teacher-configured effective cap resolution, the
 * server-calendar reset timestamp, and a read-only usage snapshot.
 */
export class TutorUsageService {
  private readonly prisma: PrismaLike;
  private readonly defaultLimit: number;

  constructor(
    prisma: PrismaLike = defaultPrisma,
    defaultLimit: number = env.AI_TUTOR_DAILY_QUERY_LIMIT,
  ) {
    this.prisma = prisma;
    this.defaultLimit = defaultLimit;
  }

  /** Current UTC calendar day as `YYYY-MM-DD`. */
  public utcDateString(now: Date = new Date()): string {
    return now.toISOString().slice(0, 10);
  }

  /**
   * Start of the next server (UTC) calendar day as an ISO-8601 timestamp — the
   * moment today's date-keyed usage row stops applying and a fresh day begins.
   * This is a calendar boundary, not a rolling 24h window.
   */
  public resetsAt(now: Date = new Date()): string {
    const next = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1),
    );
    return next.toISOString();
  }

  /**
   * Resolve the student's effective daily cap from teacher settings. A student
   * may be enrolled under multiple teachers sharing one global per-student
   * counter; we apply the MAX configured cap among their ACTIVE-enrollment
   * teachers so a stricter teacher never blocks access to another teacher's paid
   * content. Falls back to the platform default when no teacher value applies.
   */
  public async resolveEffectiveLimit(studentId: string): Promise<number> {
    const enrollments = await this.prisma.enrollment.findMany({
      where: {
        studentId,
        status: "ACTIVE",
        chapter: { deletedAt: null, stage: { deletedAt: null } },
      },
      select: {
        chapter: {
          select: {
            stage: {
              select: {
                teacher: {
                  select: {
                    teacherProfile: {
                      select: { aiTutorDailyQueryLimit: true },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    const caps = enrollments
      .map((e) => e.chapter.stage.teacher.teacherProfile?.aiTutorDailyQueryLimit)
      .filter((n): n is number => typeof n === "number");

    return caps.length > 0 ? Math.max(...caps) : this.defaultLimit;
  }

  /**
   * Read-only usage snapshot for the current server day. Never creates a row and
   * never increments. `used` is 0 when no row exists yet.
   */
  public async getToday(
    studentId: string,
    limit: number,
    now: Date = new Date(),
  ): Promise<UsageSnapshot> {
    const date = this.utcDateString(now);
    const row = await this.prisma.aiTutorUsage.findUnique({
      where: {
        studentId_usageDate: {
          studentId,
          usageDate: new Date(`${date}T00:00:00.000Z`),
        },
      },
      select: { count: true },
    });
    const used = row?.count ?? 0;
    return {
      used,
      limit,
      remaining: Math.max(limit - used, 0),
      resetsAt: this.resetsAt(now),
    };
  }

  /**
   * Atomically claim one quota slot for the day. Returns true if the request is
   * within `limit` (slot claimed), false if the limit is already reached.
   *
   * The single statement inserts a fresh row (count = 1) or, on conflict,
   * increments only while `count < limit`. When the limit is reached the
   * conditional UPDATE matches nothing and RETURNING yields no row → denied.
   */
  public async tryClaim(
    studentId: string,
    limit: number,
    date: string = this.utcDateString(),
  ): Promise<boolean> {
    const rows = await this.prisma.$queryRaw<Array<{ count: number }>>`
      INSERT INTO ai_tutor_usage (id, "studentId", "usageDate", count, "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, ${studentId}, ${date}::date, 1, NOW(), NOW())
      ON CONFLICT ("studentId", "usageDate")
      DO UPDATE SET count = ai_tutor_usage.count + 1, "updatedAt" = NOW()
      WHERE ai_tutor_usage.count < ${limit}
      RETURNING count
    `;
    return rows.length > 0;
  }

  /** Reverse a previously claimed slot (never drops below zero). */
  public async refund(
    studentId: string,
    date: string = this.utcDateString(),
  ): Promise<void> {
    await this.prisma.$executeRaw`
      UPDATE ai_tutor_usage
      SET count = GREATEST(count - 1, 0), "updatedAt" = NOW()
      WHERE "studentId" = ${studentId} AND "usageDate" = ${date}::date
    `;
  }
}

export const tutorUsageService = new TutorUsageService();
