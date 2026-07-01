import { AppError } from "../../shared/utils/AppError.js";

/** Resolve quiz duration for a new attempt; rejects unconfigured quizzes. */
export function resolveQuizDurationMinutes(
  durationMinutes: number | null | undefined,
): number {
  if (
    durationMinutes == null ||
    !Number.isInteger(durationMinutes) ||
    durationMinutes <= 0
  ) {
    throw new AppError(
      "Quiz duration is not configured",
      400,
      "QUIZ_DURATION_NOT_CONFIGURED",
    );
  }
  return durationMinutes;
}

export function computeExpiresAt(
  startedAt: Date,
  durationMinutes: number,
): Date {
  return new Date(startedAt.getTime() + durationMinutes * 60_000);
}

export function isAttemptExpired(
  expiresAt: Date | null | undefined,
  now: Date = new Date(),
): boolean {
  if (!expiresAt) {
    return false;
  }
  return now.getTime() >= expiresAt.getTime();
}

export function buildAttemptTimingResponse(
  startedAt: Date,
  durationMinutesSnapshot: number,
  expiresAt: Date,
) {
  return {
    durationMinutes: durationMinutesSnapshot,
    startedAt: startedAt.toISOString(),
    expiresAt: expiresAt.toISOString(),
    serverTime: new Date().toISOString(),
  };
}
