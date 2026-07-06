import type { AiUsageType } from "../../generated/prisma/index.js";
import type { Prisma } from "../../generated/prisma/client.js";
import { TeacherPlanService } from "./teacher-plan.service.js";
import { getTeacherPlanMessage } from "./teacher-plan.i18n.js";
import { AppError } from "../../shared/utils/AppError.js";
import { DEFAULT_LIMITS } from "./teacher-plan.types.js";
import { prisma } from "../../config/database.js";
const planService = new TeacherPlanService();

function isUnlimited(limit: number): boolean {
  return limit < 0;
}

function getLimitValue(limits: Record<string, unknown>, key: string): number {
  const val = limits[key];
  if (val === undefined || val === null) {
    return (DEFAULT_LIMITS as Record<string, unknown>)[key] as number ?? 0;
  }
  return Number(val);
}

export class TeacherPlanPolicyService {

  async getTeacherEffectivePlan(teacherId: string) {
    const sub = await planService.getTeacherSubscription(teacherId);
    if (sub) {
      return {
        planId: sub.plan.id,
        planCode: sub.plan.code,
        limits: (sub.plan.limits as Record<string, unknown>) ?? {},
      };
    }
    const freePlan = await prisma.teacherPlan.findUnique({ where: { code: "FREE" } });
    return {
      planId: freePlan?.id ?? "free-default",
      planCode: "FREE",
      limits: freePlan ? ((freePlan.limits as Record<string, unknown>) ?? {}) : {},
    };
  }

  async checkAiUsageQuota(
    teacherId: string,
    usageType: AiUsageType,
    units: number = 1,
    locale: string = "ar",
  ): Promise<void> {
    const effectivePlan = await this.getTeacherEffectivePlan(teacherId);
    const limits = effectivePlan.limits;

    const limitKeyMap: Record<string, string> = {
      AI_QUIZ_GENERATION: "aiQuizGenerationsPerMonth",
      AI_ESSAY_GRADING: "aiEssayGradingsPerMonth",
      AI_CONTENT_GENERATION: "aiContentGenerationsPerMonth",
      AI_LESSON_SUMMARY: "aiLessonSummariesPerMonth",
      AI_QUESTION_EXPLANATION: "aiQuestionExplanationsPerMonth",
    };

    const limitKey = limitKeyMap[usageType];
    if (!limitKey) return;

    const monthlyLimit = getLimitValue(limits, limitKey);
    if (isUnlimited(monthlyLimit)) return;

    const now = new Date();
    const periodStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

    const used = await prisma.teacherAiUsageEvent.aggregate({
      where: {
        teacherId,
        usageType,
        createdAt: { gte: periodStart },
      },
      _sum: { units: true },
    });

    const currentUsage = used._sum.units ?? 0;

    if (currentUsage + units > monthlyLimit) {
      throw new AppError(getTeacherPlanMessage("QUOTA_EXCEEDED", locale), 403);
    }
  }

  async recordAiUsage(
    teacherId: string,
    usageType: AiUsageType,
    units: number = 1,
    metadata?: Record<string, unknown>,
  ): Promise<void> {
    const effectivePlan = await this.getTeacherEffectivePlan(teacherId);
    const sub = await planService.getTeacherSubscription(teacherId);

    await prisma.teacherAiUsageEvent.create({
      data: {
        teacherId,
        usageType,
        units,
        metadata: (metadata ?? {}) as Prisma.InputJsonValue,
        planId: effectivePlan.planId,
        subscriptionId: sub?.id ?? null,
      },
    });
  }

  async checkStudentLimit(teacherId: string, locale: string = "ar"): Promise<void> {
    const effectivePlan = await this.getTeacherEffectivePlan(teacherId);
    const studentLimit = getLimitValue(effectivePlan.limits, "maxStudents");
    if (isUnlimited(studentLimit)) return;

    const currentCount = await planService.countTeacherStudents(teacherId);
    if (currentCount >= studentLimit) {
      throw new AppError(getTeacherPlanMessage("STUDENT_LIMIT_EXCEEDED", locale), 403);
    }
  }

  async checkStorageLimit(
    teacherId: string,
    additionalBytes: number = 0,
    locale: string = "ar",
  ): Promise<void> {
    const effectivePlan = await this.getTeacherEffectivePlan(teacherId);
    const storageMbLimit = getLimitValue(effectivePlan.limits, "storageMb");
    if (isUnlimited(storageMbLimit)) return;

    const currentMb = await planService.computeStorageUsed(teacherId);
    const additionalMb = additionalBytes / (1024 * 1024);

    if (currentMb + additionalMb > storageMbLimit) {
      throw new AppError(getTeacherPlanMessage("STORAGE_LIMIT_EXCEEDED", locale), 403);
    }
  }

  async getUsageSummary(teacherId: string) {
    const effectivePlan = await this.getTeacherEffectivePlan(teacherId);
    return planService.computeUsageSummary(teacherId, effectivePlan.limits);
  }
}
