import { describe, it, expect } from "vitest";
import {
  applyStudentResultPolicy,
  resolveEffectiveVisibility,
  PENDING_MESSAGES,
  type FullSubmissionResult,
  type QuizResultSettingsRow,
} from "./quiz-result-policy.js";

const LEGACY: QuizResultSettingsRow = {
  resultSettingsConfigured: false,
  showCorrectAnswers: null,
  showPerQuestionScores: null,
  showFinalScore: null,
  showStudentAnswers: null,
  showExplanations: null,
  pendingEssayResultMode: null,
};

function configured(over: Partial<QuizResultSettingsRow>): QuizResultSettingsRow {
  return {
    resultSettingsConfigured: true,
    showCorrectAnswers: true,
    showPerQuestionScores: true,
    showFinalScore: true,
    showStudentAnswers: true,
    showExplanations: true,
    pendingEssayResultMode: "SHOW_OBJECTIVE_WITH_PENDING_MESSAGE",
    ...over,
  };
}

function finalResult(): FullSubmissionResult {
  return {
    attemptId: "a1",
    quizId: "q1",
    quizTitle: "Quiz",
    status: "GRADED",
    score: 8,
    totalPoints: 10,
    percentage: 80,
    pendingEssayCount: 0,
    isFinal: true,
    results: [
      {
        questionId: "m1",
        type: "MCQ",
        questionText: "Q1",
        options: ["a", "b"],
        studentAnswer: "a",
        correctAnswer: "b",
        result: "incorrect",
        awardedPoints: 0,
        maxPoints: 2,
        explanation: "because b",
      },
    ],
  };
}

function pendingEssayResult(): FullSubmissionResult {
  return {
    attemptId: "a2",
    quizId: "q2",
    quizTitle: "Quiz2",
    status: "COMPLETED",
    score: 2,
    totalPoints: 10,
    percentage: 20,
    pendingEssayCount: 1,
    isFinal: false,
    results: [
      {
        questionId: "m1",
        type: "MCQ",
        questionText: "Q1",
        options: ["a", "b"],
        studentAnswer: "b",
        correctAnswer: "b",
        result: "correct",
        awardedPoints: 2,
        maxPoints: 2,
      },
      {
        questionId: "e1",
        type: "ESSAY",
        questionText: "Explain",
        options: null,
        studentAnswer: "my essay",
        correctAnswer: null,
        result: "pending",
        awardedPoints: null,
        maxPoints: 8,
      },
    ],
  };
}

describe("resolveEffectiveVisibility", () => {
  it("marks legacy quizzes unconfigured with permissive flags", () => {
    const v = resolveEffectiveVisibility(LEGACY);
    expect(v.configured).toBe(false);
    expect(v.showCorrectAnswers).toBe(true);
    expect(v.pendingEssayResultMode).toBe("SHOW_OBJECTIVE_WITH_PENDING_MESSAGE");
  });

  it("resolves null columns of a configured quiz to permissive defaults", () => {
    const v = resolveEffectiveVisibility({ ...LEGACY, resultSettingsConfigured: true });
    expect(v.configured).toBe(true);
    expect(v.showFinalScore).toBe(true);
  });
});

describe("applyStudentResultPolicy — legacy pass-through", () => {
  it("returns full data unchanged for an unconfigured quiz", () => {
    const out = applyStudentResultPolicy(finalResult(), LEGACY);
    expect(out.score).toBe(8);
    expect(out.results[0]!.correctAnswer).toBe("b");
    expect(out.results[0]!.studentAnswer).toBe("a");
    expect(out.results[0]!.explanation).toBe("because b");
    expect(out.results[0]!.awardedPoints).toBe(0);
    expect(out.message).toBeNull();
    expect(out.resultVisibility.configured).toBe(false);
  });
});

describe("applyStudentResultPolicy — per-field hiding (configured, final)", () => {
  it("hides correct answers when disabled", () => {
    const out = applyStudentResultPolicy(finalResult(), configured({ showCorrectAnswers: false }));
    expect(out.results[0]).not.toHaveProperty("correctAnswer");
  });

  it("hides student answers when disabled", () => {
    const out = applyStudentResultPolicy(finalResult(), configured({ showStudentAnswers: false }));
    expect(out.results[0]).not.toHaveProperty("studentAnswer");
  });

  it("hides per-question scores (and feedback) when disabled", () => {
    const out = applyStudentResultPolicy(finalResult(), configured({ showPerQuestionScores: false }));
    expect(out.results[0]).not.toHaveProperty("awardedPoints");
    expect(out.results[0]).not.toHaveProperty("maxPoints");
  });

  it("hides explanations when disabled", () => {
    const out = applyStudentResultPolicy(finalResult(), configured({ showExplanations: false }));
    expect(out.results[0]).not.toHaveProperty("explanation");
  });

  it("hides final score when disabled", () => {
    const out = applyStudentResultPolicy(finalResult(), configured({ showFinalScore: false }));
    expect(out.score).toBeNull();
    expect(out.totalPoints).toBeNull();
    expect(out.percentage).toBeNull();
  });

  it("shows everything when all flags on", () => {
    const out = applyStudentResultPolicy(finalResult(), configured({}));
    expect(out.score).toBe(8);
    expect(out.results[0]!.correctAnswer).toBe("b");
  });
});

describe("applyStudentResultPolicy — student answer without correctness", () => {
  // The core fix: showing the student's own answer must not, on its own, reveal
  // whether that answer was right or wrong.
  const answerOnly = configured({
    showStudentAnswers: true,
    showCorrectAnswers: false,
    showPerQuestionScores: false,
    showExplanations: false,
    showFinalScore: false,
  });

  it("returns the student's answer only", () => {
    const out = applyStudentResultPolicy(finalResult(), answerOnly);
    expect(out.results[0]!.studentAnswer).toBe("a");
  });

  it("does not include the correct answer", () => {
    const out = applyStudentResultPolicy(finalResult(), answerOnly);
    expect(out.results[0]).not.toHaveProperty("correctAnswer");
  });

  it("neutralizes the per-question correctness indicator to 'answered'", () => {
    const out = applyStudentResultPolicy(finalResult(), answerOnly);
    // The internal grade was "incorrect" — the student must not see that.
    expect(out.results[0]!.result).toBe("answered");
    expect(out.results[0]!.result).not.toBe("incorrect");
    expect(out.results[0]!.result).not.toBe("correct");
  });

  it("does not include the per-question score", () => {
    const out = applyStudentResultPolicy(finalResult(), answerOnly);
    expect(out.results[0]).not.toHaveProperty("awardedPoints");
    expect(out.results[0]).not.toHaveProperty("maxPoints");
  });

  it("does not include the explanation", () => {
    const out = applyStudentResultPolicy(finalResult(), answerOnly);
    expect(out.results[0]).not.toHaveProperty("explanation");
  });

  it("keeps correctness when showCorrectAnswers is on", () => {
    const out = applyStudentResultPolicy(
      finalResult(),
      configured({ showCorrectAnswers: true, showPerQuestionScores: false }),
    );
    expect(out.results[0]!.result).toBe("incorrect");
    expect(out.results[0]!.correctAnswer).toBe("b");
  });

  it("keeps correctness when only showPerQuestionScores is on", () => {
    const out = applyStudentResultPolicy(
      finalResult(),
      configured({ showCorrectAnswers: false, showPerQuestionScores: true }),
    );
    expect(out.results[0]!.result).toBe("incorrect");
    expect(out.results[0]).not.toHaveProperty("correctAnswer");
    expect(out.results[0]!.awardedPoints).toBe(0);
  });

  it("preserves the pending grading state even when correctness is hidden", () => {
    const out = applyStudentResultPolicy(
      pendingEssayResult(),
      configured({
        showCorrectAnswers: false,
        showPerQuestionScores: false,
        pendingEssayResultMode: "SHOW_OBJECTIVE_ONLY",
      }),
    );
    // Objective MCQ is neutralized; a still-pending essay would keep "pending".
    expect(out.results.every((r) => r.result !== "correct" && r.result !== "incorrect")).toBe(true);
    expect(out.results[0]!.result).toBe("answered");
  });
});

describe("applyStudentResultPolicy — pending essay modes", () => {
  it("HIDE_ALL_RESULTS hides all results and the score", () => {
    const out = applyStudentResultPolicy(
      pendingEssayResult(),
      configured({ pendingEssayResultMode: "HIDE_ALL_RESULTS" }),
    );
    expect(out.results).toHaveLength(0);
    expect(out.score).toBeNull();
    expect(out.message).toBe(PENDING_MESSAGES.hideAll);
    expect(out.hasPendingEssayReview).toBe(true);
  });

  it("SHOW_OBJECTIVE_ONLY shows only objective questions and hides final score", () => {
    const out = applyStudentResultPolicy(
      pendingEssayResult(),
      configured({ pendingEssayResultMode: "SHOW_OBJECTIVE_ONLY" }),
    );
    expect(out.results).toHaveLength(1);
    expect(out.results[0]!.type).toBe("MCQ");
    expect(out.score).toBeNull();
    expect(out.message).toBe(PENDING_MESSAGES.objectiveOnly);
  });

  it("SHOW_OBJECTIVE_WITH_PENDING_MESSAGE includes the pending message", () => {
    const out = applyStudentResultPolicy(
      pendingEssayResult(),
      configured({ pendingEssayResultMode: "SHOW_OBJECTIVE_WITH_PENDING_MESSAGE" }),
    );
    expect(out.results.every((r) => r.type !== "ESSAY")).toBe(true);
    expect(out.message).toBe(PENDING_MESSAGES.objectiveWithPending);
    expect(out.score).toBeNull();
  });

  it("never leaks a provisional final score while essays are pending, even if showFinalScore is on", () => {
    const out = applyStudentResultPolicy(pendingEssayResult(), configured({ showFinalScore: true }));
    expect(out.score).toBeNull();
  });

  it("legacy quizzes keep showing provisional results while pending (no behavior change)", () => {
    const out = applyStudentResultPolicy(pendingEssayResult(), LEGACY);
    expect(out.results).toHaveLength(2);
    expect(out.score).toBe(2);
    expect(out.hasPendingEssayReview).toBe(true);
    expect(out.message).toBeNull();
  });
});
