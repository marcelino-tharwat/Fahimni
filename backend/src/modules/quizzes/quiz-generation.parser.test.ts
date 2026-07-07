import { describe, it, expect } from "vitest";
import { parseQuizGenerationResponse } from "./quiz-generation.parser.js";
import { QuizGenerationParseError } from "./quiz-generation.errors.js";

const MCQ = {
  type: "MCQ",
  content: "ما هو حل المعادلة س + ٢ = ٥؟",
  options: ["١", "٢", "٣", "٤"],
  correctAnswer: "٣",
  points: 1,
};
const TF = {
  type: "TF",
  content: "المعادلة الخطية من الدرجة الأولى.",
  options: ["صح", "خطأ"],
  correctAnswer: "صح",
  points: 1,
};
const ESSAY = {
  type: "ESSAY",
  content: "اشرح مفهوم الميل.",
  options: null,
  correctAnswer: null,
  points: 1,
};

function payload(questions: unknown[], title = "اختبار الجبر") {
  return JSON.stringify({ title, description: "وصف", questions });
}

const ALL_TYPES = ["MCQ", "TF", "ESSAY"] as const;

describe("parseQuizGenerationResponse", () => {
  it("parses valid plain JSON", () => {
    const result = parseQuizGenerationResponse(payload([MCQ, TF, ESSAY]), {
      questionCount: 3,
      requestedTypes: [...ALL_TYPES],
    });
    expect(result.questions).toHaveLength(3);
    expect(result.title).toBe("اختبار الجبر");
  });

  it("parses JSON wrapped in a ```json fence", () => {
    const raw = "```json\n" + payload([MCQ]) + "\n```";
    const result = parseQuizGenerationResponse(raw, {
      questionCount: 1,
      requestedTypes: ["MCQ"],
    });
    expect(result.questions).toHaveLength(1);
  });

  it("parses JSON wrapped in a generic ``` fence", () => {
    const raw = "```\n" + payload([TF]) + "\n```";
    const result = parseQuizGenerationResponse(raw, {
      questionCount: 1,
      requestedTypes: ["TF"],
    });
    expect(result.questions[0]!.type).toBe("TRUE_FALSE");
  });

  it("extracts one JSON object from surrounding prose", () => {
    const raw = "إليك الاختبار:\n" + payload([ESSAY]) + "\nشكراً";
    const result = parseQuizGenerationResponse(raw, {
      questionCount: 1,
      requestedTypes: ["ESSAY"],
    });
    expect(result.questions).toHaveLength(1);
  });

  it("throws on invalid JSON", () => {
    expect(() =>
      parseQuizGenerationResponse("{not json", {
        questionCount: 1,
        requestedTypes: ["MCQ"],
      }),
    ).toThrow(QuizGenerationParseError);
  });

  it("throws when the questions array is missing", () => {
    expect(() =>
      parseQuizGenerationResponse(JSON.stringify({ title: "x" }), {
        questionCount: 1,
        requestedTypes: ["MCQ"],
      }),
    ).toThrow(QuizGenerationParseError);
  });

  it("throws on a wrong question count", () => {
    expect(() =>
      parseQuizGenerationResponse(payload([MCQ]), {
        questionCount: 2,
        requestedTypes: ["MCQ"],
      }),
    ).toThrow(QuizGenerationParseError);
  });

  it("throws on an unsupported generated type", () => {
    const bad = { ...MCQ, type: "FILL_BLANK" };
    expect(() =>
      parseQuizGenerationResponse(payload([bad]), {
        questionCount: 1,
        requestedTypes: ["MCQ"],
      }),
    ).toThrow(QuizGenerationParseError);
  });

  it("throws on empty question content", () => {
    const bad = { ...MCQ, content: "   " };
    expect(() =>
      parseQuizGenerationResponse(payload([bad]), {
        questionCount: 1,
        requestedTypes: ["MCQ"],
      }),
    ).toThrow(QuizGenerationParseError);
  });

  it("rejects duplicate question content (count no longer matches)", () => {
    expect(() =>
      parseQuizGenerationResponse(payload([MCQ, { ...MCQ }]), {
        questionCount: 2,
        requestedTypes: ["MCQ"],
      }),
    ).toThrow(QuizGenerationParseError);
  });

  it("throws on MCQ with missing options", () => {
    const bad = { type: "MCQ", content: "س؟", correctAnswer: "أ" };
    expect(() =>
      parseQuizGenerationResponse(payload([bad]), {
        questionCount: 1,
        requestedTypes: ["MCQ"],
      }),
    ).toThrow(QuizGenerationParseError);
  });

  it("throws on MCQ with duplicate options", () => {
    const bad = { ...MCQ, options: ["أ", "أ", "ب"], correctAnswer: "أ" };
    expect(() =>
      parseQuizGenerationResponse(payload([bad]), {
        questionCount: 1,
        requestedTypes: ["MCQ"],
      }),
    ).toThrow(QuizGenerationParseError);
  });

  it("throws when MCQ correctAnswer is not in options", () => {
    const bad = { ...MCQ, correctAnswer: "٩٩" };
    expect(() =>
      parseQuizGenerationResponse(payload([bad]), {
        questionCount: 1,
        requestedTypes: ["MCQ"],
      }),
    ).toThrow(QuizGenerationParseError);
  });

  it("throws when TF correctAnswer is invalid", () => {
    const bad = { ...TF, correctAnswer: "ربما" };
    expect(() =>
      parseQuizGenerationResponse(payload([bad]), {
        questionCount: 1,
        requestedTypes: ["TF"],
      }),
    ).toThrow(QuizGenerationParseError);
  });

  it("normalizes ESSAY options and correctAnswer to null", () => {
    const essayWithJunk = {
      type: "ESSAY",
      content: "اشرح.",
      options: ["شيء"],
      correctAnswer: "إجابة مُولّدة",
      points: 2,
    };
    const result = parseQuizGenerationResponse(payload([essayWithJunk]), {
      questionCount: 1,
      requestedTypes: ["ESSAY"],
    });
    expect(result.questions[0]!.options).toBeNull();
    expect(result.questions[0]!.correctAnswer).toBeNull();
    expect(result.questions[0]!.points).toBe(2);
  });

  it("throws on invalid points", () => {
    const bad = { ...MCQ, points: 0 };
    expect(() =>
      parseQuizGenerationResponse(payload([bad]), {
        questionCount: 1,
        requestedTypes: ["MCQ"],
      }),
    ).toThrow(QuizGenerationParseError);
  });

  it("maps TF → TRUE_FALSE and normalizes the answer", () => {
    const tf = { ...TF, correctAnswer: "true" };
    const result = parseQuizGenerationResponse(payload([tf]), {
      questionCount: 1,
      requestedTypes: ["TF"],
    });
    expect(result.questions[0]!.type).toBe("TRUE_FALSE");
    expect(result.questions[0]!.options).toEqual(["صح", "خطأ"]);
    expect(result.questions[0]!.correctAnswer).toBe("صح");
  });

  it("assigns sequential sortOrder starting at 1", () => {
    const result = parseQuizGenerationResponse(payload([MCQ, TF, ESSAY]), {
      questionCount: 3,
      requestedTypes: [...ALL_TYPES],
    });
    expect(result.questions.map((q) => q.sortOrder)).toEqual([1, 2, 3]);
  });

  it("rejects a requested type that does not appear", () => {
    expect(() =>
      parseQuizGenerationResponse(payload([MCQ]), {
        questionCount: 1,
        requestedTypes: ["MCQ", "TF"],
      }),
    ).toThrow(QuizGenerationParseError);
  });

  it("defaults omitted points per type (MCQ/TF=1, ESSAY=5)", () => {
    const mcqNoPoints = { type: "MCQ", content: "س١", options: ["أ", "ب"], correctAnswer: "أ" };
    const tfNoPoints = { type: "TF", content: "س٢", correctAnswer: "صح" };
    const essayNoPoints = { type: "ESSAY", content: "س٣" };
    const result = parseQuizGenerationResponse(
      payload([mcqNoPoints, tfNoPoints, essayNoPoints]),
      { questionCount: 3, requestedTypes: [...ALL_TYPES] },
    );
    expect(result.questions.map((q) => q.points)).toEqual([1, 1, 5]);
  });

  it("clamps oversized model points to the max (100)", () => {
    const big = { ...MCQ, points: 9999 };
    const result = parseQuizGenerationResponse(payload([big]), {
      questionCount: 1,
      requestedTypes: ["MCQ"],
    });
    expect(result.questions[0]!.points).toBe(100);
  });

  it("extracts a per-question difficulty label when supplied (en + ar)", () => {
    const easy = { ...MCQ, difficulty: "easy" };
    const hardAr = { ...TF, difficulty: "صعب" };
    const result = parseQuizGenerationResponse(payload([easy, hardAr]), {
      questionCount: 2,
      requestedTypes: ["MCQ", "TF"],
    });
    expect(result.questions[0]!.difficulty).toBe("easy");
    expect(result.questions[1]!.difficulty).toBe("hard");
  });

  it("leaves difficulty null when the model omits or garbles it", () => {
    const noDiff = { ...MCQ };
    const junk = { ...TF, difficulty: "impossible" };
    const result = parseQuizGenerationResponse(payload([noDiff, junk]), {
      questionCount: 2,
      requestedTypes: ["MCQ", "TF"],
    });
    expect(result.questions[0]!.difficulty).toBeNull();
    expect(result.questions[1]!.difficulty).toBeNull();
  });
});
