import { describe, it, expect } from "vitest";
import {
  questionPublicFields,
  studentQuestionPublicFields,
  quizPublicFields,
  quizTeacherFields,
} from "./quizzes.types.js";
import type { StudentQuizVisibilityDTO } from "./quiz-visibility.types.js";

/**
 * Teacher-only generation metadata (per-question difficulty + source
 * chapter/lesson attribution) is response-only and never persisted (no schema
 * column). This guard fails if a future change ever selects such a field into a
 * persisted-question projection — which would be the first step toward leaking
 * it to students.
 */
const FORBIDDEN_FIELDS = [
  "difficulty",
  "sourceLessonId",
  "sourceLessonTitle",
  "sourceChapterId",
  "sourceChapterTitle",
  "allocationMode",
  "sourceScope",
];

describe("student metadata safety", () => {
  it("teacher question projection never selects source/difficulty metadata", () => {
    for (const field of FORBIDDEN_FIELDS) {
      expect(field in questionPublicFields).toBe(false);
    }
  });

  it("student question projection excludes answers and generation metadata", () => {
    for (const field of [...FORBIDDEN_FIELDS, "correctAnswer", "explanation"]) {
      expect(field in studentQuestionPublicFields).toBe(false);
    }
  });
});

/**
 * Source scope (single/multi/full) is orthogonal to the per-question metadata
 * above. Teachers may see the raw source columns; students may see ONLY the
 * resolved, access-filtered shape (sourceScope + optional chapters/stage) and
 * never the raw id arrays. These guards fail the moment a projection or the
 * student DTO widens beyond that whitelist.
 */
const RAW_SOURCE_COLUMNS = ["sourceChapterIds", "sourceStageId"] as const;
const TEACHER_SOURCE_COLUMNS = ["sourceScope", "sourceChapterIds", "sourceStageId"] as const;
const STUDENT_SAFE_SOURCE_FIELDS = ["sourceScope", "sourceChapters", "sourceStage"] as const;

describe("quiz source scope safety", () => {
  it("teacher projection exposes the raw source-scope columns", () => {
    for (const field of TEACHER_SOURCE_COLUMNS) {
      expect(field in quizTeacherFields).toBe(true);
    }
  });

  it("the student-reused public projection never selects raw source-scope columns", () => {
    // quizPublicFields is also reused for the student chapter-quiz list, so it
    // must not carry the raw id arrays.
    for (const field of RAW_SOURCE_COLUMNS) {
      expect(field in quizPublicFields).toBe(false);
    }
  });

  it("student visibility DTO whitelist contains no raw source id arrays", () => {
    // A representative full-shape student DTO (all optional source fields set)
    // must expose only the student-safe source fields — never the raw arrays.
    const dto: StudentQuizVisibilityDTO = {
      id: "q",
      title: "t",
      description: null,
      chapterId: "c",
      status: "PUBLISHED",
      contentScope: "CHAPTER",
      sourceScope: "MULTI_CHAPTER",
      sourceChapters: [{ id: "c1", title: "ch1" }],
      sourceStage: { id: "s1", title: "stage" },
      linkedLessonIds: [],
      isRequiredForProgression: false,
      requiredForLessonId: null,
      questionCount: 1,
      totalPoints: 1,
      durationMinutes: null,
      passingScore: null,
      studentAttemptStatus: "NOT_STARTED",
      attemptId: null,
      displayStatus: "NOT_STARTED",
    };
    const sourceKeys = Object.keys(dto).filter((k) => k.startsWith("source"));
    for (const key of sourceKeys) {
      expect(STUDENT_SAFE_SOURCE_FIELDS).toContain(key as (typeof STUDENT_SAFE_SOURCE_FIELDS)[number]);
    }
    for (const raw of RAW_SOURCE_COLUMNS) {
      expect(dto).not.toHaveProperty(raw);
    }
  });
});
