import { describe, it, expect } from "vitest";
import { parseTutorResponse } from "./ai-tutor.parser.js";
import { TutorUnavailableError } from "./ai-tutor.errors.js";

describe("parseTutorResponse", () => {
  it("parses a valid structured response", () => {
    const res = parseTutorResponse(
      JSON.stringify({ answer: "الإجابة", citationRefs: ["SOURCE_1", "SOURCE_2"] }),
    );
    expect(res).toEqual({ answer: "الإجابة", citationRefs: ["SOURCE_1", "SOURCE_2"] });
  });

  it("strips a ```json code fence", () => {
    const raw = "```json\n{\"answer\":\"hi\",\"citationRefs\":[\"SOURCE_1\"]}\n```";
    expect(parseTutorResponse(raw)).toEqual({
      answer: "hi",
      citationRefs: ["SOURCE_1"],
    });
  });

  it("defaults citationRefs to an empty array when missing", () => {
    expect(parseTutorResponse(JSON.stringify({ answer: "x" }))).toEqual({
      answer: "x",
      citationRefs: [],
    });
  });

  it("normalizes and de-duplicates source refs, dropping non-source strings", () => {
    const res = parseTutorResponse(
      JSON.stringify({
        answer: "x",
        citationRefs: ["source_1", "SOURCE_1", "lesson-title", "SOURCE_2", 7],
      }),
    );
    expect(res.citationRefs).toEqual(["SOURCE_1", "SOURCE_2"]);
  });

  it("throws on malformed JSON", () => {
    expect(() => parseTutorResponse("not json")).toThrow(TutorUnavailableError);
  });

  it("throws on a non-object JSON value", () => {
    expect(() => parseTutorResponse("\"just a string\"")).toThrow(
      TutorUnavailableError,
    );
  });

  it("throws when the answer is missing or empty", () => {
    expect(() => parseTutorResponse(JSON.stringify({ citationRefs: [] }))).toThrow(
      TutorUnavailableError,
    );
    expect(() =>
      parseTutorResponse(JSON.stringify({ answer: "   ", citationRefs: [] })),
    ).toThrow(TutorUnavailableError);
  });

  it("bounds the answer length", () => {
    const res = parseTutorResponse(
      JSON.stringify({ answer: "ن".repeat(10), citationRefs: [] }),
      { maxAnswerChars: 4 },
    );
    expect(res.answer).toBe("ن".repeat(4));
  });
});
