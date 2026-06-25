import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Request, Response, NextFunction } from "express";

// Control the generation service the controller instantiates internally.
const generateMock = vi.hoisted(() => vi.fn());
vi.mock("./quiz-generation.service.js", () => ({
  QuizGenerationService: class {
    generate = generateMock;
  },
}));

// Keep import side-effects DB/env free.
vi.mock("../../config/database.js", () => ({ prisma: {} }));
vi.mock("../../shared/services/auditLog.service.js", () => ({
  auditLogService: { record: vi.fn() },
}));
vi.mock("../../config/env.js", () => ({
  env: { JWT_SECRET: "x", NODE_ENV: "test" },
}));

import { QuizzesController } from "./quizzes.controller.js";
import quizRouter from "./quizzes.routes.js";
import { errorHandler } from "../../shared/middlewares/errorHandler.middleware.js";
import { QuizGenerationParseError } from "./quiz-generation.errors.js";

function mockRes() {
  const res = {} as Response & {
    statusCode?: number;
    body?: unknown;
  };
  res.status = vi.fn((code: number) => {
    res.statusCode = code;
    return res;
  }) as unknown as Response["status"];
  res.json = vi.fn((body: unknown) => {
    res.body = body;
    return res;
  }) as unknown as Response["json"];
  return res;
}

describe("QuizzesController.generate", () => {
  beforeEach(() => vi.clearAllMocks());

  it("passes the authenticated teacher id (not body) to the service", async () => {
    generateMock.mockResolvedValue({ id: "quiz-1", status: "DRAFT" });
    const controller = new QuizzesController();
    const req = {
      body: { chapterId: "c", teacherId: "ATTACKER", questionCount: 3 },
      user: { id: "teacher-real" },
    } as unknown as Request;
    const res = mockRes();
    const next = vi.fn() as unknown as NextFunction;

    await controller.generate(req, res, next);

    expect(generateMock).toHaveBeenCalledWith(req.body, "teacher-real");
  });

  it("returns a 201 success envelope with the created draft quiz", async () => {
    const data = { id: "quiz-1", status: "DRAFT", questionCount: 3 };
    generateMock.mockResolvedValue(data);
    const controller = new QuizzesController();
    const req = {
      body: { chapterId: "c" },
      user: { id: "teacher-real" },
    } as unknown as Request;
    const res = mockRes();

    await controller.generate(req, res, vi.fn() as unknown as NextFunction);

    expect(res.statusCode).toBe(201);
    expect(res.body).toMatchObject({ success: true, data });
  });

  it("forwards service errors to next() (asyncHandler)", async () => {
    generateMock.mockRejectedValue(new QuizGenerationParseError());
    const controller = new QuizzesController();
    const req = {
      body: { chapterId: "c" },
      user: { id: "teacher-real" },
    } as unknown as Request;
    const next = vi.fn() as unknown as NextFunction;

    await controller.generate(req, mockRes(), next);

    // Allow the async chain in asyncHandler to settle.
    await new Promise((r) => setTimeout(r, 0));
    expect((next as unknown as ReturnType<typeof vi.fn>)).toHaveBeenCalledWith(
      expect.any(QuizGenerationParseError),
    );
  });
});

describe("POST /generate route registration", () => {
  it("registers POST /generate with auth, role-guard, validation and handler", () => {
    const layer = (
      quizRouter.stack as Array<{
        route?: {
          path: string;
          methods: Record<string, boolean>;
          stack: unknown[];
        };
      }>
    ).find((l) => l.route?.path === "/generate" && l.route.methods.post);

    expect(layer).toBeDefined();
    // authenticate + authorize + validate + controller.generate
    expect(layer!.route!.stack.length).toBe(4);
  });
});

describe("quiz-generation 422 error envelope", () => {
  it("returns a safe 422 envelope with message, details and suggestion", () => {
    const err = new QuizGenerationParseError();
    const res = mockRes();

    errorHandler(
      err,
      {} as Request,
      res as Response,
      vi.fn() as unknown as NextFunction,
    );

    expect(res.statusCode).toBe(422);
    const body = res.body as Record<string, unknown>;
    expect(body.success).toBe(false);
    expect(body.statusCode).toBe(422);
    expect(typeof body.message).toBe("string");
    expect(typeof body.suggestion).toBe("string");
    expect(typeof body.details).toBe("string");
    expect(body.stack).toBeUndefined();
  });
});
