import { describe, it, expect } from "vitest";
import {
  questionPublicFields,
  studentQuestionPublicFields,
} from "./quizzes.types.js";

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
