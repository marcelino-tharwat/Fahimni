import { prisma as defaultPrisma } from "../../../config/database.js";

type PrismaLike = typeof defaultPrisma;

/**
 * STORY-64 — per-student daily AI-tutor quota accounting.
 *
 * One row per student per UTC calendar day in `ai_tutor_usage`. `tryClaim`
 * performs an **atomic** insert-or-conditional-increment: the row's unique
 * constraint serializes concurrent requests so two simultaneous calls at the
 * final slot cannot both succeed. `refund` reverses a claim when the tutor fails
 * with a transient/reversible error so quota is not permanently consumed.
 */
export class TutorUsageService {
  private readonly prisma: PrismaLike;

  constructor(prisma: PrismaLike = defaultPrisma) {
    this.prisma = prisma;
  }

  /** Current UTC calendar day as `YYYY-MM-DD`. */
  public utcDateString(now: Date = new Date()): string {
    return now.toISOString().slice(0, 10);
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
