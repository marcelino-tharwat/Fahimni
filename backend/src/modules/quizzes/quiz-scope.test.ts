import { describe, it, expect, vi, beforeEach } from "vitest";
import { AppError } from "../../shared/utils/AppError.js";
import { resolveAndValidateQuizContentScope } from "./quiz-scope.js";

const TEACHER = "teacher-1";
const CHAPTER_ID = "11111111-1111-4111-8111-111111111111";
const LESSON_1 = "22222222-2222-4222-8222-222222222222";
const LESSON_2 = "33333333-3333-4333-8333-333333333333";
const OTHER_CHAPTER = "44444444-4444-4444-8444-444444444444";

function makeDb() {
  return {
    chapter: { findFirst: vi.fn() },
    lesson: { findMany: vi.fn(), findFirst: vi.fn() },
  };
}

describe("resolveAndValidateQuizContentScope", () => {
  let db: ReturnType<typeof makeDb>;

  beforeEach(() => {
    db = makeDb();
  });

  it("CHAPTER scope resolves all chapter lessons", async () => {
    db.chapter.findFirst.mockResolvedValue({ id: CHAPTER_ID, name: "الفصل" });
    db.lesson.findMany.mockResolvedValue([
      { id: LESSON_1, title: "درس ١" },
      { id: LESSON_2, title: "درس ٢" },
    ]);

    const result = await resolveAndValidateQuizContentScope(
      { chapterId: CHAPTER_ID, contentScope: "CHAPTER" },
      TEACHER,
      db as never,
    );

    expect(result.contentScope).toBe("CHAPTER");
    expect(result.lessonIds).toEqual([LESSON_1, LESSON_2]);
    expect(result.chapterId).toBe(CHAPTER_ID);
  });

  it("SELECTED_LESSONS scope keeps exact lesson IDs", async () => {
    db.chapter.findFirst.mockResolvedValue({ id: CHAPTER_ID, name: "الفصل" });
    db.lesson.findMany.mockResolvedValue([{ id: LESSON_1, title: "درس ١" }]);

    const result = await resolveAndValidateQuizContentScope(
      {
        chapterId: CHAPTER_ID,
        contentScope: "SELECTED_LESSONS",
        lessonIds: [LESSON_1],
      },
      TEACHER,
      db as never,
    );

    expect(result.lessonIds).toEqual([LESSON_1]);
  });

  it("rejects CHAPTER scope with lessonIds", async () => {
    await expect(
      resolveAndValidateQuizContentScope(
        {
          chapterId: CHAPTER_ID,
          contentScope: "CHAPTER",
          lessonIds: [LESSON_1],
        },
        TEACHER,
        db as never,
      ),
    ).rejects.toMatchObject({ code: "QUIZ_SCOPE_INVALID" });
  });

  it("rejects empty SELECTED_LESSONS", async () => {
    await expect(
      resolveAndValidateQuizContentScope(
        {
          chapterId: CHAPTER_ID,
          contentScope: "SELECTED_LESSONS",
          lessonIds: [],
        },
        TEACHER,
        db as never,
      ),
    ).rejects.toMatchObject({ code: "LESSON_SELECTION_REQUIRED" });
  });

  it("rejects lesson from another chapter", async () => {
    db.chapter.findFirst.mockResolvedValue({ id: CHAPTER_ID, name: "الفصل" });
    db.lesson.findMany.mockResolvedValue([]);
    db.lesson.findFirst.mockResolvedValue({ id: LESSON_2 });

    await expect(
      resolveAndValidateQuizContentScope(
        {
          chapterId: CHAPTER_ID,
          contentScope: "SELECTED_LESSONS",
          lessonIds: [LESSON_2],
        },
        TEACHER,
        db as never,
      ),
    ).rejects.toMatchObject({ code: "LESSON_NOT_IN_CHAPTER" });
  });

  it("rejects missing chapter", async () => {
    db.chapter.findFirst.mockResolvedValue(null);

    await expect(
      resolveAndValidateQuizContentScope(
        { chapterId: OTHER_CHAPTER, contentScope: "CHAPTER" },
        TEACHER,
        db as never,
      ),
    ).rejects.toMatchObject({ code: "CHAPTER_NOT_FOUND" });
  });
});
