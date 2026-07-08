import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  resolveTeacherQuizSourceScopes,
  resolveStudentQuizSourceScopes,
  type QuizSourceScopeRow,
} from "./quiz-scope.js";

const TEACHER = "teacher-1";
const STUDENT = "student-1";
const CH1 = "11111111-1111-4111-8111-111111111111";
const CH2 = "22222222-2222-4222-8222-222222222222";
const CH3 = "33333333-3333-4333-8333-333333333333";
const STAGE = "44444444-4444-4444-8444-444444444444";

function makeDb() {
  return {
    chapter: { findMany: vi.fn() },
    stage: { findMany: vi.fn() },
  };
}

const singleRow: QuizSourceScopeRow = {
  id: "quiz-single",
  sourceScope: "SINGLE_CHAPTER",
  sourceChapterIds: [],
  sourceStageId: null,
};
const multiRow: QuizSourceScopeRow = {
  id: "quiz-multi",
  sourceScope: "MULTI_CHAPTER",
  sourceChapterIds: [CH1, CH2],
  sourceStageId: null,
};
const fullRow: QuizSourceScopeRow = {
  id: "quiz-full",
  sourceScope: "FULL_CURRICULUM",
  sourceChapterIds: [],
  sourceStageId: STAGE,
};

describe("resolveTeacherQuizSourceScopes", () => {
  let db: ReturnType<typeof makeDb>;
  beforeEach(() => {
    db = makeDb();
  });

  it("resolves multi-chapter titles and full-curriculum stage, keeping raw ids", async () => {
    db.chapter.findMany.mockResolvedValue([
      { id: CH1, name: "ف١" },
      { id: CH2, name: "ف٢" },
    ]);
    db.stage.findMany.mockResolvedValue([{ id: STAGE, name: "الصف" }]);

    const map = await resolveTeacherQuizSourceScopes(
      [singleRow, multiRow, fullRow],
      TEACHER,
      db as never,
    );

    expect(map.get("quiz-single")).toMatchObject({
      sourceScope: "SINGLE_CHAPTER",
      sourceChapters: [],
      sourceStage: null,
    });
    expect(map.get("quiz-multi")!.sourceChapters).toEqual([
      { id: CH1, title: "ف١" },
      { id: CH2, title: "ف٢" },
    ]);
    // Teacher keeps the raw ids for completeness.
    expect(map.get("quiz-multi")!.sourceChapterIds).toEqual([CH1, CH2]);
    expect(map.get("quiz-full")!.sourceStage).toEqual({ id: STAGE, title: "الصف" });
  });

  it("scopes chapter + stage resolution to the requesting teacher", async () => {
    db.chapter.findMany.mockResolvedValue([{ id: CH1, name: "ف١" }, { id: CH2, name: "ف٢" }]);
    db.stage.findMany.mockResolvedValue([{ id: STAGE, name: "الصف" }]);

    await resolveTeacherQuizSourceScopes([multiRow, fullRow], TEACHER, db as never);

    expect(db.chapter.findMany.mock.calls[0]![0].where.stage.teacherId).toBe(TEACHER);
    expect(db.stage.findMany.mock.calls[0]![0].where.teacherId).toBe(TEACHER);
  });

  it("drops ids the teacher does not own from the display arrays", async () => {
    // Only CH1 is owned/returned; CH2 is silently dropped.
    db.chapter.findMany.mockResolvedValue([{ id: CH1, name: "ف١" }]);
    const map = await resolveTeacherQuizSourceScopes([multiRow], TEACHER, db as never);
    expect(map.get("quiz-multi")!.sourceChapters).toEqual([{ id: CH1, title: "ف١" }]);
  });

  it("reads a legacy row (default SINGLE_CHAPTER, empty arrays) back without any DB lookup", async () => {
    const map = await resolveTeacherQuizSourceScopes([singleRow], TEACHER, db as never);
    expect(map.get("quiz-single")).toMatchObject({
      sourceScope: "SINGLE_CHAPTER",
      sourceChapterIds: [],
      sourceStageId: null,
      sourceChapters: [],
      sourceStage: null,
    });
    // No multi/full rows → no chapter/stage queries at all.
    expect(db.chapter.findMany).not.toHaveBeenCalled();
    expect(db.stage.findMany).not.toHaveBeenCalled();
  });
});

describe("resolveStudentQuizSourceScopes", () => {
  let db: ReturnType<typeof makeDb>;
  beforeEach(() => {
    db = makeDb();
  });

  it("filters multi-chapter to what the student can access and never exposes raw ids", async () => {
    db.stage.findMany.mockResolvedValue([{ id: STAGE, name: "الصف" }]);
    // Student can access CH1 and CH3, but CH2 (in the quiz source) is not accessible.
    const loadAccessible = vi.fn().mockResolvedValue([
      { id: CH1, name: "ف١" },
      { id: CH3, name: "ف٣" },
    ]);

    const map = await resolveStudentQuizSourceScopes(
      [singleRow, multiRow, fullRow],
      STUDENT,
      db as never,
      loadAccessible,
    );

    const single = map.get("quiz-single")!;
    expect(Object.keys(single)).toEqual(["sourceScope"]);

    const multi = map.get("quiz-multi")!;
    // CH2 filtered out (not accessible); CH1 kept with title; no raw id array.
    expect(multi.chapters).toEqual([{ id: CH1, title: "ف١" }]);
    expect(multi).not.toHaveProperty("sourceChapterIds");
    expect(multi).not.toHaveProperty("sourceStageId");

    const full = map.get("quiz-full")!;
    expect(full.stage).toEqual({ id: STAGE, title: "الصف" });
    expect(full).not.toHaveProperty("sourceStageId");
    expect(full).not.toHaveProperty("sourceChapterIds");
  });

  it("emits an empty chapters array when none of the source chapters are accessible", async () => {
    const loadAccessible = vi.fn().mockResolvedValue([{ id: CH3, name: "ف٣" }]);
    const map = await resolveStudentQuizSourceScopes([multiRow], STUDENT, db as never, loadAccessible);
    expect(map.get("quiz-multi")!.chapters).toEqual([]);
  });

  it("omits the stage when the full-curriculum stage does not resolve", async () => {
    db.stage.findMany.mockResolvedValue([]); // stage not found / deleted
    const map = await resolveStudentQuizSourceScopes([fullRow], STUDENT, db as never, vi.fn());
    expect(Object.keys(map.get("quiz-full")!)).toEqual(["sourceScope"]);
  });

  it("reads a legacy SINGLE_CHAPTER row without loading accessible chapters or stages", async () => {
    const loadAccessible = vi.fn();
    const map = await resolveStudentQuizSourceScopes([singleRow], STUDENT, db as never, loadAccessible);
    expect(Object.keys(map.get("quiz-single")!)).toEqual(["sourceScope"]);
    expect(loadAccessible).not.toHaveBeenCalled();
    expect(db.stage.findMany).not.toHaveBeenCalled();
  });
});
