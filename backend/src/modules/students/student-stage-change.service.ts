import { prisma } from "../../config/database.js";
import { AppError } from "../../shared/utils/AppError.js";

// ───────────────────────────────────────────────────────────────────────────────
// Academic year logic — injectable `now` for testing
// ───────────────────────────────────────────────────────────────────────────────

const WINDOW_START_MONTH = 6; // July (0-indexed)
const WINDOW_START_DAY = 1;
const WINDOW_END_MONTH = 7; // August (0-indexed)
const WINDOW_END_DAY = 31;

/**
 * Academic year key based on the July–August window year.
 * July 1 2026 → Aug 31 2026 => "2026"
 * Outside window => null (not currently in any window).
 */
export function getCurrentAcademicYear(now?: Date): string | null {
  const d = now ?? new Date();
  const month = d.getMonth(); // 0-indexed
  const year = d.getFullYear();

  if (month === WINDOW_START_MONTH && d.getDate() >= WINDOW_START_DAY) {
    return String(year);
  }
  if (month === WINDOW_END_MONTH && d.getDate() <= WINDOW_END_DAY) {
    return String(year);
  }
  return null;
}

/** Check if the current date is inside the July 1 – Aug 31 window. */
export function isWithinChangeWindow(now?: Date): boolean {
  return getCurrentAcademicYear(now) !== null;
}

/** Return window boundaries for the current/next academic year. */
export function getChangeWindowDates(now?: Date): {
  windowStart: Date;
  windowEnd: Date;
  academicYear: string;
} {
  const d = now ?? new Date();
  const year = d.getFullYear();
  return {
    windowStart: new Date(year, WINDOW_START_MONTH, WINDOW_START_DAY),
    windowEnd: new Date(year, WINDOW_END_MONTH, WINDOW_END_DAY),
    academicYear: String(year),
  };
}

// ───────────────────────────────────────────────────────────────────────────────
// Types
// ───────────────────────────────────────────────────────────────────────────────

export interface StageChangePolicyDTO {
  currentStage: { id: string; name: string; sortOrder: number } | null;
  availableStages: Array<{ id: string; name: string; sortOrder: number }>;
  canChangeStage: boolean;
  reason: string | null;
  windowStart: string;
  windowEnd: string;
  academicYear: string | null;
  alreadyChangedThisYear: boolean;
}

// ───────────────────────────────────────────────────────────────────────────────
// Policy query
// ───────────────────────────────────────────────────────────────────────────────

export async function getStageChangePolicy(
  studentId: string,
  now?: Date,
): Promise<StageChangePolicyDTO> {
  const currentDate = now ?? new Date();
  const academicYear = getCurrentAcademicYear(currentDate);
  const window = getChangeWindowDates(currentDate);

  // Fetch student profile with current stage
  const profile = await prisma.studentProfile.findUnique({
    where: { userId: studentId },
    select: {
      stageId: true,
      stage: { select: { id: true, name: true, sortOrder: true } },
    },
  });
  if (!profile) {
    throw new AppError("Student profile not found", 404);
  }

  // All active stages sorted by sortOrder
  const allActiveStages = await prisma.stage.findMany({
    where: { isActive: true, deletedAt: null },
    select: { id: true, name: true, sortOrder: true },
    orderBy: { sortOrder: "asc" },
  });

  const currentSortOrder = profile.stage.sortOrder;

  // Forward stages only: sortOrder > current
  const forwardStages = allActiveStages.filter(
    (s) => s.sortOrder > currentSortOrder,
  );

  // Check if student already changed this year (SELF only)
  let alreadyChangedThisYear = false;
  if (academicYear) {
    const existingLog = await prisma.studentStageChangeLog.findFirst({
      where: {
        studentId,
        changeType: "SELF",
        academicYear,
      },
    });
    alreadyChangedThisYear = existingLog !== null;
  }

  // Determine canChangeStage + reason
  let canChangeStage = false;
  let reason: string | null = null;

  if (!academicYear) {
    reason =
      "تغيير المرحلة متاح سنويًا فقط من 1 يوليو إلى 31 أغسطس.";
  } else if (alreadyChangedThisYear) {
    reason =
      "لقد قمت بتغيير المرحلة الدراسية بالفعل هذا العام.";
  } else if (forwardStages.length === 0) {
    reason =
      "لا توجد مرحلة أعلى متاحة للتغيير إليها.";
  } else {
    canChangeStage = true;
  }

  return {
    currentStage: profile.stage,
    availableStages: forwardStages,
    canChangeStage,
    reason,
    windowStart: window.windowStart.toISOString(),
    windowEnd: window.windowEnd.toISOString(),
    academicYear,
    alreadyChangedThisYear,
  };
}

// ───────────────────────────────────────────────────────────────────────────────
// Stage change execution
// ───────────────────────────────────────────────────────────────────────────────

export async function changeStudentStage(
  studentId: string,
  newStageId: string,
  now?: Date,
): Promise<void> {
  const currentDate = now ?? new Date();
  const academicYear = getCurrentAcademicYear(currentDate);

  // 1. Window check
  if (!academicYear) {
    throw new AppError(
      "تغيير المرحلة متاح سنويًا فقط من 1 يوليو إلى 31 أغسطس.",
      400,
      "STUDENT_STAGE_CHANGE_WINDOW_CLOSED",
    );
  }

  // 2. Fetch current profile + stage
  const profile = await prisma.studentProfile.findUnique({
    where: { userId: studentId },
    select: {
      stageId: true,
      stage: { select: { id: true, sortOrder: true } },
    },
  });
  if (!profile) {
    throw new AppError("Student profile not found", 404);
  }

  // 3. Already changed check (SELF only)
  const existingLog = await prisma.studentStageChangeLog.findFirst({
    where: {
      studentId,
      changeType: "SELF",
      academicYear,
    },
  });
  if (existingLog) {
    throw new AppError(
      "لقد قمت بتغيير المرحلة الدراسية بالفعل هذا العام.",
      400,
      "STUDENT_STAGE_ALREADY_CHANGED_THIS_YEAR",
    );
  }

  // 4. Target stage must exist and be active
  const targetStage = await prisma.stage.findUnique({
    where: { id: newStageId },
    select: { id: true, sortOrder: true, isActive: true, deletedAt: true },
  });
  if (!targetStage || targetStage.isActive === false || targetStage.deletedAt !== null) {
    throw new AppError(
      "المرحلة الدراسية غير صحيحة أو غير متاحة.",
      400,
      "INVALID_STUDENT_STAGE",
    );
  }

  // 5. Must be different from current
  if (profile.stageId === newStageId) {
    throw new AppError(
      "المرحلة الدراسية غير صحيحة أو غير متاحة.",
      400,
      "INVALID_STUDENT_STAGE",
    );
  }

  // 6. No step-back: target sortOrder must be > current
  if (targetStage.sortOrder <= profile.stage.sortOrder) {
    throw new AppError(
      "لا يمكن الرجوع إلى مرحلة دراسية سابقة.",
      400,
      "STUDENT_STAGE_STEP_BACK_NOT_ALLOWED",
    );
  }

  // 7. Atomic: update profile + create log
  await prisma.$transaction(async (tx) => {
    await tx.studentProfile.update({
      where: { userId: studentId },
      data: { stageId: newStageId },
    });

    await tx.studentStageChangeLog.create({
      data: {
        studentId,
        oldStageId: profile.stageId,
        newStageId,
        changedByUserId: studentId,
        changedByRole: "STUDENT",
        changeType: "SELF",
        academicYear,
      },
    });
  });
}

// ───────────────────────────────────────────────────────────────────────────────
// Admin override (called from admin-users.service)
// ───────────────────────────────────────────────────────────────────────────────

export async function logAdminStageOverride(
  studentId: string,
  oldStageId: string,
  newStageId: string,
  adminId: string,
  now?: Date,
): Promise<void> {
  const academicYear = getCurrentAcademicYear(now);
  // Admin overrides are always logged regardless of window
  await prisma.studentStageChangeLog.create({
    data: {
      studentId,
      oldStageId,
      newStageId,
      changedByUserId: adminId,
      changedByRole: "ADMIN",
      changeType: "ADMIN_OVERRIDE",
      academicYear: academicYear ?? "UNKNOWN",
    },
  });
}
