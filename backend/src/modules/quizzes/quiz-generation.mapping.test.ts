import { describe, it, expect } from "vitest";
import {
  mapPublicTypeToDb,
  mapDbTypeToPublic,
  normalizeTfAnswer,
  TF_TRUE,
  TF_FALSE,
} from "./quiz-generation.mapping.js";

describe("mapPublicTypeToDb", () => {
  it("maps MCQ → MCQ", () => {
    expect(mapPublicTypeToDb("MCQ")).toBe("MCQ");
  });

  it("maps TF → TRUE_FALSE", () => {
    expect(mapPublicTypeToDb("TF")).toBe("TRUE_FALSE");
  });

  it("maps ESSAY → ESSAY", () => {
    expect(mapPublicTypeToDb("ESSAY")).toBe("ESSAY");
  });

  it("throws on an unexpected type", () => {
    expect(() => mapPublicTypeToDb("FILL_BLANK")).toThrow();
  });
});

describe("mapDbTypeToPublic", () => {
  it("maps TRUE_FALSE → TF", () => {
    expect(mapDbTypeToPublic("TRUE_FALSE")).toBe("TF");
  });
});

describe("normalizeTfAnswer", () => {
  it("normalizes Arabic true tokens to صح", () => {
    expect(normalizeTfAnswer("صح")).toBe(TF_TRUE);
    expect(normalizeTfAnswer("صحيح")).toBe(TF_TRUE);
  });

  it("normalizes English true/false", () => {
    expect(normalizeTfAnswer("true")).toBe(TF_TRUE);
    expect(normalizeTfAnswer("FALSE")).toBe(TF_FALSE);
  });

  it("returns null for unsupported values", () => {
    expect(normalizeTfAnswer("maybe")).toBeNull();
    expect(normalizeTfAnswer(123)).toBeNull();
  });
});
