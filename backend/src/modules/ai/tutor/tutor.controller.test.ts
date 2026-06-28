import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Request, Response, NextFunction } from "express";

vi.hoisted(() => {
  process.env.GEMINI_API_KEY = "test-key";
});
vi.mock("../../../config/database.js", () => ({ prisma: {} }));

import { TutorController } from "./tutor.controller.js";
import {
  TutorNotEnrolledError,
  TutorTimeoutError,
  TutorSafetyBlockedError,
} from "./ai-tutor.errors.js";
import { TUTOR_NOT_FOUND_MESSAGE } from "../gemini/prompts/tutor-prompt.js";
import { logger } from "../../../config/logger.js";

const STUDENT = "student-1";
const RESETS_AT = "2026-06-29T00:00:00.000Z";

const flush = () => new Promise((r) => setImmediate(r));

function makeReqRes(body: unknown, user: { id: string; role?: string } | undefined = { id: STUDENT, role: "STUDENT" }) {
  const req = { body, user, headers: {} } as unknown as Request;
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
  } as unknown as Response;
  const next = vi.fn() as unknown as NextFunction;
  return { req, res, next };
}

function makeDeps(over: Record<string, unknown> = {}) {
  return {
    tutorService: { ask: vi.fn() },
    usageService: {
      utcDateString: vi.fn().mockReturnValue("2026-06-28"),
      tryClaim: vi.fn().mockResolvedValue(true),
      refund: vi.fn().mockResolvedValue(undefined),
      resolveEffectiveLimit: vi.fn().mockResolvedValue(5),
      resetsAt: vi.fn().mockReturnValue(RESETS_AT),
      getToday: vi.fn(),
    },
    enrollmentService: { hasActiveEnrollment: vi.fn().mockResolvedValue(true) },
    ...over,
  };
}

function answer() {
  return {
    answer: "الإجابة المختصرة",
    citations: [
      { lessonId: "L1", lessonTitle: "الدرس", chapterName: "الفصل", relevanceScore: 0.91 },
    ],
  };
}

describe("TutorController.ask", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 (not enrolled) and never calls the tutor or claims quota", async () => {
    const deps = makeDeps();
    deps.enrollmentService.hasActiveEnrollment.mockResolvedValue(false);
    const c = new TutorController(deps as never);
    const { req, res, next } = makeReqRes({ question: "سؤال صالح طويل" });

    c.ask(req, res, next);
    await flush();

    expect(next).toHaveBeenCalledWith(expect.any(TutorNotEnrolledError));
    expect(deps.usageService.tryClaim).not.toHaveBeenCalled();
    expect(deps.tutorService.ask).not.toHaveBeenCalled();
    expect(res.json).not.toHaveBeenCalled();
  });

  it("returns 429 with limit/remaining/resetsAt metadata when the quota is exceeded", async () => {
    const deps = makeDeps();
    deps.usageService.tryClaim.mockResolvedValue(false);
    const c = new TutorController(deps as never);
    const { req, res, next } = makeReqRes({ question: "سؤال صالح طويل" });

    c.ask(req, res, next);
    await flush();

    expect(res.status).toHaveBeenCalledWith(429);
    const body = (res.json as ReturnType<typeof vi.fn>).mock.calls[0]![0];
    expect(body).toMatchObject({
      success: false,
      statusCode: 429,
      limit: 5,
      remaining: 0,
      resetsAt: RESETS_AT,
    });
    expect(res.set).toHaveBeenCalledWith("Retry-After", expect.any(String));
    expect(deps.tutorService.ask).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  it("claims quota with the resolved effective limit and authenticated id", async () => {
    const deps = makeDeps();
    deps.usageService.resolveEffectiveLimit.mockResolvedValue(7);
    deps.tutorService.ask.mockResolvedValue(answer());
    const c = new TutorController(deps as never);
    const { req, res, next } = makeReqRes({ question: "سؤال صالح طويل", studentId: "evil" });

    c.ask(req, res, next);
    await flush();

    expect(deps.usageService.resolveEffectiveLimit).toHaveBeenCalledWith(STUDENT);
    expect(deps.usageService.tryClaim).toHaveBeenCalledWith(STUDENT, 7, "2026-06-28");
    expect(deps.tutorService.ask).toHaveBeenCalledTimes(1);
    // Uses authenticated id, ignores body studentId.
    expect(deps.tutorService.ask.mock.calls[0]![1]).toBe(STUDENT);
    expect(next).not.toHaveBeenCalled();
  });

  it("usage-today returns used/limit/remaining/resetsAt without incrementing", async () => {
    const deps = makeDeps();
    deps.usageService.resolveEffectiveLimit.mockResolvedValue(20);
    deps.usageService.getToday.mockResolvedValue({
      used: 4,
      limit: 20,
      remaining: 16,
      resetsAt: RESETS_AT,
    });
    const c = new TutorController(deps as never);
    const { req, res, next } = makeReqRes(undefined);

    c.usageToday(req, res, next);
    await flush();

    const payload = (res.json as ReturnType<typeof vi.fn>).mock.calls[0]![0];
    expect(payload.data).toEqual({ used: 4, limit: 20, remaining: 16, resetsAt: RESETS_AT });
    expect(deps.usageService.tryClaim).not.toHaveBeenCalled();
  });

  it("returns the public answer + citations without relevanceScore", async () => {
    const deps = makeDeps();
    deps.tutorService.ask.mockResolvedValue(answer());
    const c = new TutorController(deps as never);
    const { req, res, next } = makeReqRes({ question: "سؤال صالح طويل" });

    c.ask(req, res, next);
    await flush();

    expect(res.status).toHaveBeenCalledWith(200);
    const payload = (res.json as ReturnType<typeof vi.fn>).mock.calls[0]![0];
    expect(payload.data.answer).toBe("الإجابة المختصرة");
    expect(payload.data.citations).toEqual([
      { lessonId: "L1", lessonTitle: "الدرس", chapterName: "الفصل" },
    ]);
    expect(payload.data.citations[0]).not.toHaveProperty("relevanceScore");
  });

  it("passes the endpoint sub-20s budget to AiTutorService.ask", async () => {
    const deps = makeDeps({
      askOptions: { totalTimeoutMs: 18_000, retrievalTimeoutMs: 11_000, geminiTimeoutMs: 7_000 },
    });
    deps.tutorService.ask.mockResolvedValue(answer());
    const c = new TutorController(deps as never);
    const { req, res, next } = makeReqRes({ question: "سؤال صالح طويل" });

    c.ask(req, res, next);
    await flush();

    const opts = deps.tutorService.ask.mock.calls[0]![2];
    expect(opts.totalTimeoutMs).toBeLessThan(20_000);
    expect(opts).toMatchObject({ totalTimeoutMs: 18_000, retrievalTimeoutMs: 11_000, geminiTimeoutMs: 7_000 });
  });

  it("preserves the localized not-found result with empty citations", async () => {
    const deps = makeDeps();
    deps.tutorService.ask.mockResolvedValue({ answer: TUTOR_NOT_FOUND_MESSAGE.ar, citations: [] });
    const c = new TutorController(deps as never);
    const { req, res, next } = makeReqRes({ question: "سؤال صالح طويل" });

    c.ask(req, res, next);
    await flush();

    const payload = (res.json as ReturnType<typeof vi.fn>).mock.calls[0]![0];
    expect(payload.data.answer).toBe(TUTOR_NOT_FOUND_MESSAGE.ar);
    expect(payload.data.citations).toEqual([]);
  });

  it("refunds the quota slot on a transient tutor failure", async () => {
    const deps = makeDeps();
    deps.tutorService.ask.mockRejectedValue(new TutorTimeoutError());
    const c = new TutorController(deps as never);
    const { req, res, next } = makeReqRes({ question: "سؤال صالح طويل" });

    c.ask(req, res, next);
    await flush();

    expect(deps.usageService.refund).toHaveBeenCalledWith(STUDENT, "2026-06-28");
    expect(next).toHaveBeenCalledWith(expect.any(TutorTimeoutError));
  });

  it("does NOT refund on a non-transient failure (safety block)", async () => {
    const deps = makeDeps();
    deps.tutorService.ask.mockRejectedValue(new TutorSafetyBlockedError());
    const c = new TutorController(deps as never);
    const { req, res, next } = makeReqRes({ question: "سؤال صالح طويل" });

    c.ask(req, res, next);
    await flush();

    expect(deps.usageService.refund).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledWith(expect.any(TutorSafetyBlockedError));
  });

  it("logs studentId, question, and a bounded answer preview on success", async () => {
    const infoSpy = vi.spyOn(logger, "info");
    const deps = makeDeps();
    const longAnswer = "ن".repeat(400);
    deps.tutorService.ask.mockResolvedValue({ answer: longAnswer, citations: [] });
    const c = new TutorController(deps as never);
    const { req, res, next } = makeReqRes({ question: "سؤال صالح طويل" });

    c.ask(req, res, next);
    await flush();

    const call = infoSpy.mock.calls.find((c2) => c2[0] === "ai_tutor_question_answered");
    expect(call).toBeDefined();
    const meta = call![1] as Record<string, unknown>;
    expect(meta.studentId).toBe(STUDENT);
    expect(meta.question).toBe("سؤال صالح طويل");
    expect((meta.answerPreview as string).length).toBeLessThanOrEqual(160);
    expect(meta.timestamp).toBeTypeOf("string");
    expect(meta).not.toHaveProperty("token");
    infoSpy.mockRestore();
  });

  it("returns 401 when no authenticated user is present", async () => {
    const deps = makeDeps();
    const c = new TutorController(deps as never);
    const { req, res, next } = makeReqRes({ question: "سؤال صالح طويل" });
    (req as { user?: unknown }).user = undefined;

    c.ask(req, res, next);
    await flush();

    expect(next).toHaveBeenCalled();
    expect(deps.enrollmentService.hasActiveEnrollment).not.toHaveBeenCalled();
  });
});
