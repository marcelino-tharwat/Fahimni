import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  resolveMultiChapterScope,
  resolveFullCurriculumScope,
} from "./quiz-scope.js";
import { ContentNotIndexedError } from "./quiz-generation.errors.js";

const TEACHER = "teacher-1";
const CH1 = "11111111-1111-4111-8111-111111111111";
const CH2 = "22222222-2222-4222-8222-222222222222";
const L1 = "aaaaaaaa-1111-4111-8111-111111111111";
const L2 = "bbbbbbbb-2222-4222-8222-222222222222";
const STAGE = "33333333-3333-4333-8333-333333333333";

function makeDb() {
  return {
    chapter: { findMany: vi.fn(), findFirst: vi.fn() },
    lesson: { findMany: vi.fn(), findFirst: vi.fn() },
    stage: { findFirst: vi.fn() },
  };
}

describe("resolveMultiChapterScope", () => {
  let db: ReturnType<typeof makeDb>;
  beforeEach(() => {
    db = makeDb();
  });

  it("gathers lessons across two owned chapters", async () => {
    db.chapter.findMany.mockResolvedValue([
      { id: CH1, name: "ch1" },
      { id: CH2, name: "ch2" },
    ]);
    db.lesson.findMany.mockResolvedValue([
      { id: L1, title: "l1" },
      { id: L2, title: "l2" },
    ]);

    const r = await resolveMultiChapterScope([CH1, CH2], TEACHER, db as never);
    expect(r.contentScope).toBe("CHAPTER");
    expect(r.lessonIds).toEqual([L1, L2]);
    expect(r.chapterId).toBe(CH1); // placement default = first chapter
  });

  it("rejects when fewer than two chapters are supplied", async () => {
    await expect(resolveMultiChapterScope([CH1], TEACHER, db as never)).rejects.toThrow(
      /at least two/i,
    );
  });

  it("rejects when a chapter is not owned/found (count mismatch)", async () => {
    db.chapter.findMany.mockResolvedValue([{ id: CH1, name: "ch1" }]); // only 1 of 2
    await expect(
      resolveMultiChapterScope([CH1, CH2], TEACHER, db as never),
    ).rejects.toThrow(/not found/i);
  });

  it("throws ContentNotIndexedError when chapters have no lessons", async () => {
    db.chapter.findMany.mockResolvedValue([
      { id: CH1, name: "ch1" },
      { id: CH2, name: "ch2" },
    ]);
    db.lesson.findMany.mockResolvedValue([]);
    await expect(
      resolveMultiChapterScope([CH1, CH2], TEACHER, db as never),
    ).rejects.toBeInstanceOf(ContentNotIndexedError);
  });

  it("scopes the chapter query to the requesting teacher", async () => {
    db.chapter.findMany.mockResolvedValue([
      { id: CH1, name: "ch1" },
      { id: CH2, name: "ch2" },
    ]);
    db.lesson.findMany.mockResolvedValue([{ id: L1, title: "l1" }]);
    await resolveMultiChapterScope([CH1, CH2], TEACHER, db as never);
    const where = db.chapter.findMany.mock.calls[0]![0].where;
    expect(where.teacherId).toBe(TEACHER);
    expect(where.deletedAt).toBeNull();
  });
});

describe("resolveFullCurriculumScope", () => {
  let db: ReturnType<typeof makeDb>;
  beforeEach(() => {
    db = makeDb();
  });

  it("gathers all chapters + lessons of an owned stage", async () => {
    db.stage.findFirst.mockResolvedValue({ id: STAGE, name: "الصف" });
    db.chapter.findMany.mockResolvedValue([
      { id: CH1, name: "ch1" },
      { id: CH2, name: "ch2" },
    ]);
    db.lesson.findMany.mockResolvedValue([{ id: L1, title: "l1" }]);

    const r = await resolveFullCurriculumScope(STAGE, TEACHER, db as never);
    expect(r.lessonIds).toEqual([L1]);
    expect(r.contentScope).toBe("CHAPTER");
  });

  it("rejects an unowned/missing stage", async () => {
    db.stage.findFirst.mockResolvedValue(null);
    await expect(resolveFullCurriculumScope(STAGE, TEACHER, db as never)).rejects.toThrow(
      /stage not found/i,
    );
  });

  it("scopes the stage lookup to active stages by id", async () => {
    db.stage.findFirst.mockResolvedValue({ id: STAGE, name: "الصف" });
    db.chapter.findMany.mockResolvedValue([{ id: CH1, name: "ch1" }]);
    db.lesson.findMany.mockResolvedValue([{ id: L1, title: "l1" }]);
    await resolveFullCurriculumScope(STAGE, TEACHER, db as never);
    const where = db.stage.findFirst.mock.calls[0]![0].where;
    expect(where.id).toBe(STAGE);
    expect(where.deletedAt).toBeNull();
    expect(where.isActive).toBe(true);
  });
});
