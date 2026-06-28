import { describe, it, expect } from "vitest";
import {
  buildTutorPrompt,
  buildTutorSystemInstruction,
  detectQuestionLanguage,
  TUTOR_NOT_FOUND_MESSAGE,
} from "./tutor-prompt.js";

describe("detectQuestionLanguage", () => {
  it("returns ar for Arabic text", () => {
    expect(detectQuestionLanguage("ما هي الدالة الخطية؟")).toBe("ar");
  });
  it("returns en for English text", () => {
    expect(detectQuestionLanguage("What is a linear function?")).toBe("en");
  });
  it("treats mixed text with any Arabic as Arabic", () => {
    expect(detectQuestionLanguage("explain الدالة")).toBe("ar");
  });
});

describe("buildTutorSystemInstruction", () => {
  it("enforces context-only grounding and the exact Arabic not-found text", () => {
    const sys = buildTutorSystemInstruction("ar");
    expect(sys).toContain("ONLY");
    expect(sys).toContain(TUTOR_NOT_FOUND_MESSAGE.ar);
    expect(sys).toContain("SOURCE_1");
  });

  it("instructs Modern Standard Arabic quality for Arabic", () => {
    const sys = buildTutorSystemInstruction("ar");
    expect(sys).toContain("فصحى");
  });

  it("uses the English not-found text for English", () => {
    const sys = buildTutorSystemInstruction("en");
    expect(sys).toContain(TUTOR_NOT_FOUND_MESSAGE.en);
    expect(sys).toContain("English");
  });

  it("treats sources and question as untrusted data (injection resistance)", () => {
    const sys = buildTutorSystemInstruction("ar").toLowerCase();
    expect(sys).toContain("untrusted");
    expect(sys).toContain("ignore");
  });

  it("specifies the strict JSON output contract", () => {
    const sys = buildTutorSystemInstruction("ar");
    expect(sys).toContain('{"answer": string, "citationRefs": string[]}');
  });
});

describe("buildTutorPrompt", () => {
  const sources = [
    {
      key: "SOURCE_1",
      lessonTitle: "الدرس الأول",
      chapterName: "الفصل الأول",
      content: "محتوى الدرس الأول.",
    },
    {
      key: "SOURCE_2",
      lessonTitle: "الدرس الثاني",
      chapterName: "الفصل الأول",
      content: "محتوى الدرس الثاني.",
    },
  ];

  it("includes controlled source keys, trusted metadata, and the question", () => {
    const prompt = buildTutorPrompt({ question: "ما هي الدالة؟", sources });
    expect(prompt).toContain("[SOURCE_1]");
    expect(prompt).toContain("[SOURCE_2]");
    expect(prompt).toContain("الدرس الأول");
    expect(prompt).toContain("الفصل الأول");
    expect(prompt).toContain("محتوى الدرس الأول.");
    expect(prompt).toContain("ما هي الدالة؟");
  });

  it("contains only the current question (no prior conversation)", () => {
    const prompt = buildTutorPrompt({ question: "السؤال الحالي", sources });
    expect(prompt).not.toContain("السؤال السابق");
    expect(prompt).not.toContain("الإجابة السابقة");
  });

  it("bounds each source's content to the configured maximum", () => {
    const long = "ن".repeat(5_000);
    const prompt = buildTutorPrompt({
      question: "س",
      sources: [{ key: "SOURCE_1", lessonTitle: "ل", chapterName: "ف", content: long }],
      maxContentChars: 100,
    });
    expect(prompt).toContain("ن".repeat(100));
    expect(prompt).not.toContain("ن".repeat(101));
  });
});
