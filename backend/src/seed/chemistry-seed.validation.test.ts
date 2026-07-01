import { describe, it, expect } from "vitest";
import { isValidUuid, seedId } from "./chemistry-ids.js";
import { ALL_QUIZ_IDS, buildQuestions } from "./chemistry-seed.fixtures.js";
describe("Chemistry seed UUID validation", () => {
  it("seedId produces valid UUIDs for all quiz question keys", () => {
    for (let ci = 0; ci < 5; ci++) {
      const quizId = ALL_QUIZ_IDS[ci]!;
      const questions = buildQuestions(quizId, ci);
      expect(questions).toHaveLength(3);
      for (const q of questions) {
        expect(isValidUuid(q.id)).toBe(true);
        expect(q.id).not.toMatch(/^seed-chem-/);
        expect(q.quizId).toBe(quizId);
      }
    }
  });

  it("never builds question ids by suffixing quizId", () => {
    const quizId = seedId("quiz-ch2");
    const questions = buildQuestions(quizId, 1);
    for (const q of questions) {
      expect(q.id).not.toBe(`${quizId}-q1`);
      expect(q.id).not.toContain("-q");
    }
  });
});
