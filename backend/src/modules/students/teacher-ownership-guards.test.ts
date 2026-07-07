import { describe, it, expect, vi, beforeEach } from "vitest";
import { randomUUID } from "node:crypto";

// ─── Prisma mock ─────────────────────────────────────────────────────────
const mockPrisma = vi.hoisted(() => ({
  studentProfile: { findMany: vi.fn(), findUnique: vi.fn() },
  enrollment: { findFirst: vi.fn() },
  chapter: { findFirst: vi.fn(), findUnique: vi.fn() },
  lesson: { findFirst: vi.fn() },
  stage: { findFirst: vi.fn() },
  user: { findUnique: vi.fn() },
  quiz: { findUnique: vi.fn(), findMany: vi.fn() },
  lessonMaterial: { create: vi.fn() },
}));
vi.mock("../../config/database.js", () => ({ prisma: mockPrisma }));

// Mock external services that files.controller depends on
vi.mock("../../config/supabase.js", () => ({
  supabase: { storage: { from: vi.fn(() => ({ upload: vi.fn() })) } },
}));
vi.mock("../../config/logger.js", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
vi.mock("../materials/material-access.service.js", () => ({
  assertMaterialPathOwnedByTeacher: vi.fn(),
}));
vi.mock("../ai/ai.service.js", () => ({
  aiService: { indexLesson: vi.fn() },
}));
vi.mock("pdf-parse", () => ({
  default: vi.fn(() => ({ getText: vi.fn(() => ({ text: "", total: 0 })) })),
  PDFParse: vi.fn(() => ({ getText: vi.fn(() => ({ text: "", total: 0 })) })),
}));

import { StudentController } from "./student.controller.js";
import { QuizService } from "../quizzes/quizzes.service.js";
import { FilesController } from "../files/files.controller.js";
import { assertStudentVisibleToTeacher } from "../teacher-access/teacher-access.service.js";
import { assertChapterOwnedByTeacher } from "../teacher-access/teacher-access.service.js";
import { assertLessonOwnedByTeacher } from "../teacher-access/teacher-access.service.js";
import { AppError } from "../../shared/utils/AppError.js";

// ─── Fixture IDs ─────────────────────────────────────────────────────────
const T_A = randomUUID();
const T_B = randomUUID();
const S_X = randomUUID();
const S_Y = randomUUID();
const S_Z = randomUUID();
const STAGE_A = randomUUID();
const STAGE_B = randomUUID();
const CHAPTER_A = randomUUID();
const CHAPTER_B = randomUUID();
const LESSON_A = randomUUID();
const LESSON_B = randomUUID();
const QUIZ_A = randomUUID();
const QUIZ_B = randomUUID();

function mockReq(opts: {
  role?: string;
  userId?: string;
  params?: Record<string, string>;
  query?: Record<string, string>;
}) {
  return {
    user: { id: opts.userId ?? T_A, role: opts.role ?? "OPERATION" },
    params: opts.params ?? {},
    query: opts.query ?? {},
  } as never;
}

function mockRes() {
  const json = vi.fn();
  const status = vi.fn(() => ({ json, send: vi.fn() }));
  const send = vi.fn();
  return { status, json, send } as never;
}

describe("Teacher ownership guards (unit)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ══════════════════════════════════════════════════════════════════════
  //  GAP 1 — GET /api/students scoped
  // ══════════════════════════════════════════════════════════════════════
  describe("GAP 1 — StudentController.list", () => {
    const controller = new StudentController();

    it("1a. Teacher A sees students enrolled in their chapters only", async () => {
      mockPrisma.studentProfile.findMany.mockResolvedValue([
        { userId: S_X, stageId: STAGE_A },
        { userId: S_Z, stageId: STAGE_A },
      ]);

      const req = mockReq({ userId: T_A });
      const res = mockRes();
      await controller.list(req, res, vi.fn());

      expect(mockPrisma.studentProfile.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            user: {
              enrollments: {
                some: {
                  status: "ACTIVE",
                  chapter: {
                    deletedAt: null,
                    stage: { teacherId: T_A, deletedAt: null },
                  },
                },
              },
            },
          },
        }),
      );

      const statusMock = res.status as ReturnType<typeof vi.fn>;
      const jsonMock = statusMock.mock.results[0]?.value as { json: ReturnType<typeof vi.fn> };
      expect(statusMock).toHaveBeenCalledWith(200);
    });

    it("1b. Teacher A's result does not include Student Y", async () => {
      mockPrisma.studentProfile.findMany.mockResolvedValue([
        { userId: S_X, stageId: STAGE_A },
        { userId: S_Z, stageId: STAGE_A },
      ]);

      const req = mockReq({ userId: T_A });
      const res = mockRes();
      await controller.list(req, res, vi.fn());

      const statusMock = res.status as ReturnType<typeof vi.fn>;
      const jsonMock = statusMock.mock.results[0]?.value as { json: ReturnType<typeof vi.fn> };
      const payload = jsonMock.json.mock.calls[0]?.[0] as { data: Array<{ userId: string }> };
      const ids = payload.data.map((s) => s.userId);
      expect(ids).toContain(S_X);
      expect(ids).toContain(S_Z);
      expect(ids).not.toContain(S_Y);
    });

    it("2. Teacher B sees Y and Z, not X", async () => {
      mockPrisma.studentProfile.findMany.mockResolvedValue([
        { userId: S_Y, stageId: STAGE_B },
        { userId: S_Z, stageId: STAGE_B },
      ]);

      const req = mockReq({ userId: T_B });
      const res = mockRes();
      await controller.list(req, res, vi.fn());

      const statusMock = res.status as ReturnType<typeof vi.fn>;
      const json = statusMock.mock.results[0]?.value as { json: ReturnType<typeof vi.fn> };
      const ids = (json.json.mock.calls[0]?.[0] as { data: Array<{ userId: string }> }).data.map((s) => s.userId);
      expect(ids).toContain(S_Y);
      expect(ids).toContain(S_Z);
      expect(ids).not.toContain(S_X);
    });
  });

  // ══════════════════════════════════════════════════════════════════════
  //  GAP 2 — GET /api/students/:id ownership check
  // ══════════════════════════════════════════════════════════════════════
  describe("GAP 2 — StudentController.getById", () => {
    const controller = new StudentController();

    it("3. Teacher A requesting Student Y → 404 (assertStudentVisibleToTeacher rejects)", async () => {
      mockPrisma.enrollment.findFirst.mockResolvedValue(null);
      await expect(assertStudentVisibleToTeacher(S_Y, T_A)).rejects.toThrowError(
        new AppError("Student not found", 404),
      );
    });

    it("4. Teacher A requesting Student Z (shared) succeeds — assertStudentVisibleToTeacher passes then profile loads", async () => {
      mockPrisma.enrollment.findFirst.mockResolvedValue({ id: randomUUID() });
      mockPrisma.studentProfile.findUnique.mockResolvedValue({
        userId: S_Z,
        stageId: STAGE_A,
        user: { fullName: "Student Z" },
        stage: { name: "Stage A" },
      });

      // Guard passes
      await expect(assertStudentVisibleToTeacher(S_Z, T_A)).resolves.toBeUndefined();
      // Then profile loads
      const profile = await mockPrisma.studentProfile.findUnique({
        where: { userId: S_Z },
      });
      expect(profile.userId).toBe(S_Z);
    });

    it("5. Student X requesting Student Y → still 403 (existing self-check)", async () => {
      const req = mockReq({ userId: S_X, role: "STUDENT", params: { id: S_Y } });
      const next = vi.fn();
      await controller.getById(req, mockRes(), next);

      expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 403 }));
    });
  });

  // ══════════════════════════════════════════════════════════════════════
  //  GAP 3 — Chapter quizzes ownership
  // ══════════════════════════════════════════════════════════════════════
  describe("GAP 3 — getChapterQuizzes ownership", () => {
    const quizService = new QuizService();

    it("6. Teacher A requesting Chapter B quizzes → throws 404", async () => {
      mockPrisma.chapter.findFirst.mockResolvedValue(null);

      await expect(
        quizService.getChapterQuizzes(CHAPTER_B, T_A),
      ).rejects.toThrowError(new AppError("Chapter not found", 404));
    });

    it("7. Teacher A requesting Chapter A quizzes → succeeds", async () => {
      mockPrisma.chapter.findFirst.mockResolvedValue({ id: CHAPTER_A, stageId: STAGE_A });
      mockPrisma.quiz.findMany.mockResolvedValue([
        { id: QUIZ_A, title: "Quiz A", _count: { questions: 1 }, questions: [] },
      ]);

      const result = await quizService.getChapterQuizzes(CHAPTER_A, T_A);
      expect(result).toHaveLength(1);
      expect(result[0]!.id).toBe(QUIZ_A);
    });

    it("8. Student path (no teacherId) still works — returns published quizzes", async () => {
      mockPrisma.chapter.findUnique.mockResolvedValue({ id: CHAPTER_A });
      mockPrisma.quiz.findMany.mockResolvedValue([
        { id: QUIZ_A, title: "Quiz A", _count: { questions: 1 }, questions: [] },
      ]);

      const result = await quizService.getChapterQuizzes(CHAPTER_A);
      expect(result).toHaveLength(1);
      expect(mockPrisma.chapter.findUnique).toHaveBeenCalledWith({
        where: { id: CHAPTER_A },
      });
    });
  });

  // ══════════════════════════════════════════════════════════════════════
  //  GAP 4 — File upload lessonId ownership
  // ══════════════════════════════════════════════════════════════════════
  describe("GAP 4 — File upload ownership (controller-level)", () => {
    const filesController = new FilesController();

    function makeReqRes(lessonId: string, teacherId: string, bodyTeacherId?: string) {
      const json = vi.fn();
      const status = vi.fn(() => ({ json, send: vi.fn() }));
      const req = {
        user: { id: teacherId, role: "OPERATION" as const },
        file: { buffer: Buffer.from("x"), mimetype: "application/pdf", originalname: "t.pdf", size: 100 },
        files: undefined,
        body: { lessonId, ...(bodyTeacherId !== undefined ? { teacherId: bodyTeacherId } : {}) },
      } as never;
      const res = { status, json, send: vi.fn() } as never;
      const next = vi.fn();
      return { req, res, next, json, status };
    }

    it("9. Teacher A uploading to Lesson B → rejected by assertLessonOwnedByTeacher", async () => {
      mockPrisma.lesson.findFirst.mockResolvedValue(null);

      const { req, res, next } = makeReqRes(LESSON_B, T_A);
      await expect(
        assertLessonOwnedByTeacher(LESSON_B, T_A),
      ).rejects.toThrowError(new AppError("Lesson not found", 404));
    });

    it("10. Teacher A uploading to Lesson A → passes ownership check, body.teacherId ignored", async () => {
      mockPrisma.lesson.findFirst.mockResolvedValue({ id: LESSON_A, chapterId: CHAPTER_A });
      // Mock uploadAndSave so the controller completes
      const { FilesService } = await import("../files/files.service.js");
      const uploadSpy = vi
        .spyOn(FilesService.prototype, "uploadAndSave")
        .mockResolvedValue({
          record: { id: randomUUID(), filePath: "ok.pdf", displayName: "t.pdf", fileSize: 100, mimeType: "application/pdf" },
          indexingStatus: "pending" as const,
        });

      const { req, res, next } = makeReqRes(LESSON_A, T_A, "malicious-teacher-id");
      await filesController.uploadSingle(req, res, next);

      expect(next).not.toHaveBeenCalled();
      const statusMock = res.status as ReturnType<typeof vi.fn>;
      expect(statusMock).toHaveBeenCalledWith(201);

      uploadSpy.mockRestore();
    });

    it("11a. Batch upload to Lesson B → rejected", async () => {
      mockPrisma.lesson.findFirst.mockResolvedValue(null);

      await expect(
        assertLessonOwnedByTeacher(LESSON_B, T_A),
      ).rejects.toThrowError(new AppError("Lesson not found", 404));
    });

    it("11b. Batch upload to Lesson A → passes ownership check", async () => {
      mockPrisma.lesson.findFirst.mockResolvedValue({ id: LESSON_A, chapterId: CHAPTER_A });
      const { FilesService } = await import("../files/files.service.js");
      const uploadSpy = vi
        .spyOn(FilesService.prototype, "uploadAndSave")
        .mockResolvedValue({
          record: { id: randomUUID(), filePath: "batch.pdf", displayName: "b.pdf", fileSize: 100, mimeType: "application/pdf" },
          indexingStatus: "pending" as const,
        });

      const { req, res, next } = makeReqRes(LESSON_A, T_A);
      req.files = [req.file] as never;
      await filesController.uploadBatch(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status as ReturnType<typeof vi.fn>).toHaveBeenCalledWith(201);

      uploadSpy.mockRestore();
    });
  });

  // ══════════════════════════════════════════════════════════════════════
  //  GAP 7 — attachFilesToLesson ownership (controller-level)
  // ══════════════════════════════════════════════════════════════════════
  describe("GAP 7 — Attach files to lesson ownership (controller-level)", () => {
    const filesController = new FilesController();

    it("12a. Teacher A attaching files to Lesson B → rejected by assertLessonOwnedByTeacher", async () => {
      mockPrisma.lesson.findFirst.mockResolvedValue(null);

      const json = vi.fn();
      const status = vi.fn(() => ({ json, send: vi.fn() }));
      const req = {
        user: { id: T_A, role: "OPERATION" as const },
        params: { lessonId: LESSON_B },
        body: {
          files: [{ stagingPath: "staging/a.pdf", originalName: "a.pdf", fileSize: 100, mimeType: "application/pdf" }],
        },
      } as never;
      const res = { status, json, send: vi.fn() } as never;
      const next = vi.fn();

      await filesController.attachFiles(req, res, next);

      expect(next).toHaveBeenCalled();
      const nextError = next.mock.calls[0]?.[0];
      expect(nextError).toBeInstanceOf(AppError);
      expect(nextError.message).toBe("Lesson not found");
    });

    it("12b. Teacher A attaching files to Lesson A → passes ownership check", async () => {
      mockPrisma.lesson.findFirst.mockResolvedValue({ id: LESSON_A, chapterId: CHAPTER_A });

      const { FilesService } = await import("../files/files.service.js");
      const attachSpy = vi
        .spyOn(FilesService.prototype, "attachFilesToLesson")
        .mockResolvedValue([
          { id: randomUUID(), filePath: "ok.pdf", displayName: "a.pdf", fileSize: 100, mimeType: "application/pdf", indexingStatus: "pending" },
        ]);

      const json = vi.fn();
      const status = vi.fn(() => ({ json, send: vi.fn() }));
      const req = {
        user: { id: T_A, role: "OPERATION" as const },
        params: { lessonId: LESSON_A },
        body: {
          files: [{ stagingPath: "staging/a.pdf", originalName: "a.pdf", fileSize: 100, mimeType: "application/pdf" }],
        },
      } as never;
      const res = { status, json, send: vi.fn() } as never;
      const next = vi.fn();

      await filesController.attachFiles(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status as ReturnType<typeof vi.fn>).toHaveBeenCalledWith(200);
      expect(attachSpy).toHaveBeenCalledWith(T_A, LESSON_A, expect.any(Array));

      attachSpy.mockRestore();
    });
  });

  // ══════════════════════════════════════════════════════════════════════
  //  REGRESSION — teacher-access.service helpers
  // ══════════════════════════════════════════════════════════════════════
  describe("teacher-access.service helpers", () => {
    it("assertStudentVisibleToTeacher throws 404 when no enrollment", async () => {
      mockPrisma.enrollment.findFirst.mockResolvedValue(null);
      await expect(assertStudentVisibleToTeacher(S_Y, T_A)).rejects.toThrowError(
        new AppError("Student not found", 404),
      );
    });

    it("assertStudentVisibleToTeacher passes when enrollment exists", async () => {
      mockPrisma.enrollment.findFirst.mockResolvedValue({ id: randomUUID() });
      await expect(assertStudentVisibleToTeacher(S_Z, T_A)).resolves.toBeUndefined();
    });

    it("assertChapterOwnedByTeacher throws 404 when chapter not owned", async () => {
      mockPrisma.chapter.findFirst.mockResolvedValue(null);
      await expect(assertChapterOwnedByTeacher(CHAPTER_B, T_A)).rejects.toThrowError(
        new AppError("Chapter not found", 404),
      );
    });

    it("assertLessonOwnedByTeacher throws 404 when lesson not owned", async () => {
      mockPrisma.lesson.findFirst.mockResolvedValue(null);
      await expect(assertLessonOwnedByTeacher(LESSON_B, T_A)).rejects.toThrowError(
        new AppError("Lesson not found", 404),
      );
    });
  });
});
