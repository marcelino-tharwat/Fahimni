import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { EssayAiGradingService } from "./essay-ai-grading.service.js";
import { TeacherPlanPolicyService } from "../teacher-plans/teacher-plan-policy.service.js";

const ATTEMPT = "attempt-1";
const TEACHER = "teacher-1";
const E1 = "eeeeeeee-1111-4111-8111-111111111111";

function makeAttempt(answers: unknown[], status = "COMPLETED") {
  return {
    id: ATTEMPT,
    status,
    quizId: "quiz-1",
    answers,
    quiz: { createdBy: TEACHER },
  };
}

function makePrisma(attempt: unknown, questions: unknown[]) {
  return {
    quizAttempt: {
      findUnique: vi.fn().mockResolvedValue(attempt),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    question: { findMany: vi.fn().mockResolvedValue(questions) },
  };
}

const essayResult = {
  questionId: E1,
  type: "ESSAY",
  answer: "student essay",
  result: "pending",
  awardedPoints: null,
  maxPoints: 5,
  feedback: null,
};
const essayQuestion = { id: E1, text: "Explain", points: 5, explanation: "model answer" };

describe("EssayAiGradingService.suggestForAttempt", () => {
  let prisma: ReturnType<typeof makePrisma>;
  beforeEach(() => {
    prisma = makePrisma(makeAttempt([{ ...essayResult }]), [essayQuestion]);
    vi.spyOn(TeacherPlanPolicyService.prototype, "checkAiUsageQuota").mockResolvedValue(undefined);
    vi.spyOn(TeacherPlanPolicyService.prototype, "recordAiUsage").mockResolvedValue(undefined);
    vi.spyOn(TeacherPlanPolicyService.prototype, "getTeacherEffectivePlan").mockResolvedValue({
      planId: "free", planCode: "FREE", limits: {},
    });
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("stores an AI suggestion without touching awardedPoints (stays pending)", async () => {
    const generate = vi.fn().mockResolvedValue('{"suggestedScore": 4, "feedback": "جيد"}');
    const svc = new EssayAiGradingService(prisma as never, generate);

    const out = await svc.suggestForAttempt(ATTEMPT, TEACHER);
    expect(out.aiAvailable).toBe(true);
    expect(out.suggestions[0]!.status).toBe("AI_SUGGESTED");
    expect(out.suggestions[0]!.suggestedScore).toBe(4);

    // Persisted answers keep awardedPoints null and result pending.
    const data = prisma.quizAttempt.updateMany.mock.calls[0]![0].data;
    const stored = data.answers as Array<Record<string, unknown>>;
    expect(stored[0]!.awardedPoints).toBeNull();
    expect(stored[0]!.result).toBe("pending");
    expect(stored[0]!.aiSuggestedPoints).toBe(4);
    expect(stored[0]!.aiSuggestedFeedback).toBe("جيد");
    // Guarded on COMPLETED so a concurrent grade cannot be clobbered.
    expect(prisma.quizAttempt.updateMany.mock.calls[0]![0].where.status).toBe("COMPLETED");
  });

  it("degrades gracefully to AI_UNAVAILABLE when the model call fails", async () => {
    const generate = vi.fn().mockRejectedValue(new Error("gemini down"));
    const svc = new EssayAiGradingService(prisma as never, generate);

    const out = await svc.suggestForAttempt(ATTEMPT, TEACHER);
    expect(out.aiAvailable).toBe(false);
    expect(out.suggestions[0]!.status).toBe("AI_UNAVAILABLE");
    // Nothing persisted when no suggestion was produced.
    expect(prisma.quizAttempt.updateMany).not.toHaveBeenCalled();
  });

  it("rejects a teacher who does not own the quiz", async () => {
    const svc = new EssayAiGradingService(prisma as never, vi.fn());
    await expect(svc.suggestForAttempt(ATTEMPT, "other-teacher")).rejects.toThrow(
      /do not own/i,
    );
  });

  it("does not overwrite an already-graded essay", async () => {
    prisma = makePrisma(
      makeAttempt([{ ...essayResult, awardedPoints: 3, result: "graded" }], "GRADED"),
      [essayQuestion],
    );
    const generate = vi.fn();
    const svc = new EssayAiGradingService(prisma as never, generate);

    const out = await svc.suggestForAttempt(ATTEMPT, TEACHER);
    expect(out.suggestions[0]!.status).toBe("ALREADY_GRADED");
    expect(generate).not.toHaveBeenCalled();
    expect(prisma.quizAttempt.updateMany).not.toHaveBeenCalled();
  });
});
