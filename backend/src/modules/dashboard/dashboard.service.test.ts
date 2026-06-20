import { describe, it, expect, vi, beforeEach } from "vitest";

// Replace the Prisma singleton with a controllable mock. Mocking the database
// module also short-circuits the env/connection bootstrap, so these are pure
// unit tests that need no live database.
const mockPrisma = vi.hoisted(() => ({
  stage: { count: vi.fn() },
  chapter: { count: vi.fn() },
  lesson: { count: vi.fn() },
  auditLog: { findMany: vi.fn() },
  $queryRaw: vi.fn(),
}));

vi.mock("../../config/database.js", () => ({ prisma: mockPrisma }));

import { DashboardService } from "./dashboard.service.js";

const TEACHER_A = "teacher-a-id";

function primeHappyPath() {
  mockPrisma.stage.count.mockResolvedValue(12);
  mockPrisma.chapter.count.mockResolvedValue(48);
  mockPrisma.lesson.count.mockResolvedValue(156);
  mockPrisma.$queryRaw.mockResolvedValue([{ count: 342 }]);
  mockPrisma.auditLog.findMany.mockResolvedValue([]);
}

describe("DashboardService.getTeacherStats", () => {
  const service = new DashboardService();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns correctly scoped counts for the authenticated teacher", async () => {
    primeHappyPath();

    const result = await service.getTeacherStats(TEACHER_A);

    expect(result.totalStages).toBe(12);
    expect(result.totalChapters).toBe(48);
    expect(result.totalLessons).toBe(156);
    expect(result.totalStudents).toBe(342);

    // Every count is filtered by the authenticated teacher and soft-deletes.
    expect(mockPrisma.stage.count).toHaveBeenCalledWith({
      where: { teacherId: TEACHER_A, deletedAt: null },
    });
    expect(mockPrisma.chapter.count).toHaveBeenCalledWith({
      where: { deletedAt: null, stage: { teacherId: TEACHER_A, deletedAt: null } },
    });
    expect(mockPrisma.lesson.count).toHaveBeenCalledWith({
      where: {
        deletedAt: null,
        chapter: { deletedAt: null, stage: { teacherId: TEACHER_A, deletedAt: null } },
      },
    });
  });

  it("counts distinct students at the database level, scoped to the teacher", async () => {
    primeHappyPath();

    await service.getTeacherStats(TEACHER_A);

    expect(mockPrisma.$queryRaw).toHaveBeenCalledTimes(1);
    const [strings, ...values] = mockPrisma.$queryRaw.mock.calls[0]!;
    // DISTINCT count is computed in SQL, not by deduplicating rows in memory.
    expect(strings.join("?")).toContain("COUNT(DISTINCT");
    // The teacher id is passed as a bound parameter (no string interpolation).
    expect(values).toContain(TEACHER_A);
  });

  it("scopes recent activity to the teacher, newest first, capped at 10", async () => {
    primeHappyPath();

    await service.getTeacherStats(TEACHER_A);

    expect(mockPrisma.auditLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { scopeTeacherId: TEACHER_A },
        orderBy: { createdAt: "desc" },
        take: 10,
      }),
    );
  });

  it("maps activity rows to the structured DTO (no stored sentences)", async () => {
    primeHappyPath();
    const createdAt = new Date("2026-06-18T10:00:00.000Z");
    mockPrisma.auditLog.findMany.mockResolvedValue([
      {
        id: "a1",
        action: "CHAPTER_CREATED",
        resourceType: "CHAPTER",
        resourceId: "c1",
        actorType: "TEACHER",
        actorName: null,
        details: { name: "Chemical Bonding" },
        createdAt,
      },
    ]);

    const result = await service.getTeacherStats(TEACHER_A);

    expect(result.recentActivity).toHaveLength(1);
    expect(result.recentActivity[0]).toEqual({
      id: "a1",
      action: "CHAPTER_CREATED",
      entityType: "CHAPTER",
      entityId: "c1",
      actorType: "TEACHER",
      actorName: null,
      metadata: { name: "Chemical Bonding" },
      createdAt: createdAt.toISOString(),
    });
  });

  it("surfaces student-generated activity to the owning teacher via scopeTeacherId", async () => {
    primeHappyPath();
    mockPrisma.auditLog.findMany.mockResolvedValue([
      {
        id: "a2",
        action: "QUIZ_COMPLETED",
        resourceType: "QUIZ",
        resourceId: "q1",
        actorType: "STUDENT",
        actorName: "Ahmed Yasser",
        details: { quizName: "Organic Chemistry Quiz 1" },
        createdAt: new Date("2026-06-16T10:00:00.000Z"),
      },
    ]);

    const result = await service.getTeacherStats(TEACHER_A);

    // The query is filtered by scopeTeacherId, so only the owning teacher sees it.
    expect(mockPrisma.auditLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { scopeTeacherId: TEACHER_A } }),
    );
    expect(result.recentActivity[0]!.actorType).toBe("STUDENT");
    expect(result.recentActivity[0]!.actorName).toBe("Ahmed Yasser");
  });

  it("normalizes non-object metadata to null", async () => {
    primeHappyPath();
    mockPrisma.auditLog.findMany.mockResolvedValue([
      {
        id: "a3",
        action: "STAGE_DELETED",
        resourceType: "STAGE",
        resourceId: "s1",
        actorType: "TEACHER",
        actorName: null,
        details: null,
        createdAt: new Date("2026-06-15T10:00:00.000Z"),
      },
    ]);

    const result = await service.getTeacherStats(TEACHER_A);

    expect(result.recentActivity[0]!.metadata).toBeNull();
  });

  it("returns numeric zeros and an empty array when there is no data (never null)", async () => {
    mockPrisma.stage.count.mockResolvedValue(0);
    mockPrisma.chapter.count.mockResolvedValue(0);
    mockPrisma.lesson.count.mockResolvedValue(0);
    mockPrisma.$queryRaw.mockResolvedValue([]); // no enrollment rows at all
    mockPrisma.auditLog.findMany.mockResolvedValue([]);

    const result = await service.getTeacherStats(TEACHER_A);

    expect(result).toEqual({
      totalStages: 0,
      totalChapters: 0,
      totalLessons: 0,
      totalStudents: 0,
      totalQuizzes: 0,
      recentActivity: [],
    });
    expect(result.recentActivity).not.toBeNull();
    expect(result.totalStudents).not.toBeNull();
  });

  it("always returns totalQuizzes as 0 (no Quiz model in the schema yet)", async () => {
    primeHappyPath();
    const result = await service.getTeacherStats(TEACHER_A);
    expect(result.totalQuizzes).toBe(0);
  });
});
