import { describe, it, expect } from "vitest";
import { isValidUuid, seedId } from "./chemistry-ids.js";
import { ALL_QUIZ_IDS, buildQuestions } from "./chemistry-seed.fixtures.js";
import {
  buildChemistryLessonCatalog,
  buildChemistryLessonShellCatalog,
  CHEMISTRY_REQUIRED_GATE_QUIZ_ID,
  chemistryLessonId,
} from "./chemistry-lesson-catalog.js";
import {
  ALL_CHEMISTRY_QUIZ_IDS,
  buildChemistryQuizCatalog,
  buildQuizLessonLinks,
} from "./chemistry-quiz-catalog.js";

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

describe("Chemistry lesson shell catalog (default seed)", () => {
  it("provides 15 empty lesson shells", () => {
    const lessons = buildChemistryLessonShellCatalog();
    expect(lessons).toHaveLength(15);
    for (const l of lessons) {
      expect(l.title.length).toBeGreaterThan(3);
      expect(l.description).toBe("");
      expect(l.youtubeUrl).toBe("");
      expect(l.durationMinutes).toBe(0);
      expect(l.requiredQuizId).toBeNull();
      expect(l.optionalQuizId).toBeNull();
      expect(isValidUuid(l.id)).toBe(true);
    }
  });

  it("has no gate quiz ids on shell lessons", () => {
    const lessons = buildChemistryLessonShellCatalog();
    expect(lessons.filter((l) => l.requiredQuizId)).toHaveLength(0);
  });
});

describe("Chemistry lesson catalog (rich content — optional)", () => {
  it("provides 15 lessons with rich Arabic descriptions", () => {
    const lessons = buildChemistryLessonCatalog();
    expect(lessons).toHaveLength(15);
    for (const l of lessons) {
      expect(l.title.length).toBeGreaterThan(3);
      expect(l.description.length).toBeGreaterThan(200);
      expect(l.description).toContain("أهداف التعلم");
      expect(l.description).toContain("محتوى الدرس");
      expect(l.youtubeUrl).toMatch(/^https:\/\//);
      expect(isValidUuid(l.id)).toBe(true);
    }
  });

  it("sets gate quiz only on chapter 1 lesson 1", () => {
    const lessons = buildChemistryLessonCatalog();
    const gated = lessons.filter((l) => l.requiredQuizId);
    expect(gated).toHaveLength(1);
    expect(gated[0]!.id).toBe(chemistryLessonId(0, 0));
    expect(gated[0]!.requiredQuizId).toBe(CHEMISTRY_REQUIRED_GATE_QUIZ_ID);
  });
});

describe("Chemistry quiz catalog", () => {
  it("defines 8 quizzes with valid structure", () => {
    expect(ALL_CHEMISTRY_QUIZ_IDS).toHaveLength(8);
    const quizzes = buildChemistryQuizCatalog();
    expect(quizzes).toHaveLength(8);
    for (const q of quizzes) {
      expect(isValidUuid(q.id)).toBe(true);
      expect(q.questions.length).toBeGreaterThan(0);
      if (q.status === "PUBLISHED") {
        expect(q.durationMinutes).toBeGreaterThan(0);
      }
    }
  });

  it("links optional quizzes via QuizLesson metadata", () => {
    const links = buildQuizLessonLinks();
    expect(links.length).toBeGreaterThanOrEqual(3);
    const optional = buildChemistryQuizCatalog().find(
      (q) => q.contentScope === "SELECTED_LESSONS" && q.linkedLessonIds.length === 1,
    );
    expect(optional).toBeDefined();
    expect(links.some((l) => l.quizId === optional!.id)).toBe(true);
  });
});
