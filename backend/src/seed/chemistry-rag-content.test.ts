import { describe, it, expect } from "vitest";
import {
  CHEMISTRY_RAG_CONTENT,
  CHEMISTRY_LESSON_IDS,
  chemistryLessonKey,
} from "./chemistry-rag-content.js";

describe("chemistry-rag-content", () => {
  it("maps 15 Chemistry demo lessons with substantive Arabic text", () => {
    expect(CHEMISTRY_LESSON_IDS).toHaveLength(15);
    for (const lessonId of CHEMISTRY_LESSON_IDS) {
      const text = CHEMISTRY_RAG_CONTENT[lessonId];
      expect(text).toBeTruthy();
      expect(text!.replace(/\s+/g, "").length).toBeGreaterThan(200);
    }
  });

  it("includes a unique equilibrium marker for retrieval tests", () => {
    const eqLesson = chemistryLessonKey(3, 2);
    expect(CHEMISTRY_RAG_CONTENT[eqLesson]).toContain(
      "فحمني-اتزان-ثابت",
    );
  });
});
