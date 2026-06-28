import { describe, it, expect } from "vitest";
import { askQuestionSchema } from "./ask-question.dto.js";

const ten = "1234567890"; // exactly 10 chars
const fiveHundred = "س".repeat(500);

describe("askQuestionSchema", () => {
  it("accepts a question of exactly 10 characters", () => {
    const r = askQuestionSchema.safeParse({ question: ten });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.question).toBe(ten);
  });

  it("accepts a question of exactly 500 characters", () => {
    expect(askQuestionSchema.safeParse({ question: fiveHundred }).success).toBe(true);
  });

  it("rejects fewer than 10 characters", () => {
    expect(askQuestionSchema.safeParse({ question: "123456789" }).success).toBe(false);
  });

  it("rejects more than 500 characters", () => {
    expect(askQuestionSchema.safeParse({ question: "س".repeat(501) }).success).toBe(false);
  });

  it("trims surrounding whitespace before length validation", () => {
    const r = askQuestionSchema.safeParse({ question: `   ${ten}   ` });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.question).toBe(ten);
  });

  it("rejects an input that is < 10 chars only after trimming", () => {
    // 8 visible chars padded to 12 → trims to 8 → invalid.
    expect(askQuestionSchema.safeParse({ question: "  12345678  " }).success).toBe(false);
  });

  it("rejects whitespace-only input", () => {
    expect(askQuestionSchema.safeParse({ question: "          " }).success).toBe(false);
  });

  it("rejects a missing question", () => {
    expect(askQuestionSchema.safeParse({}).success).toBe(false);
  });

  it("rejects null", () => {
    expect(askQuestionSchema.safeParse({ question: null }).success).toBe(false);
  });

  it("rejects non-string values", () => {
    expect(askQuestionSchema.safeParse({ question: 12345 }).success).toBe(false);
    expect(askQuestionSchema.safeParse({ question: ["a"] }).success).toBe(false);
    expect(askQuestionSchema.safeParse({ question: { q: "x" } }).success).toBe(false);
  });

  it("rejects unknown fields (strict)", () => {
    expect(
      askQuestionSchema.safeParse({ question: ten, foo: "bar" }).success,
    ).toBe(false);
  });

  it("rejects client-supplied identity/context fields", () => {
    for (const extra of [
      { studentId: "s" },
      { userId: "u" },
      { chapterId: "c" },
      { lessonId: "l" },
      { conversationId: "x" },
      { history: [] },
      { systemPrompt: "p" },
    ]) {
      expect(
        askQuestionSchema.safeParse({ question: ten, ...extra }).success,
      ).toBe(false);
    }
  });
});
