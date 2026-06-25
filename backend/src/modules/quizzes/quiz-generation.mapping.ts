import type { QuestionType } from "../../generated/prisma/client.js";
import type { PublicQuestionType } from "./dto/generate-quiz.dto.js";

/**
 * Single source of truth for translating the public wire question types
 * (MCQ / TF / ESSAY) into the persisted Prisma enum (MCQ / TRUE_FALSE / ESSAY).
 *
 * The mapping is exhaustive: an unexpected value throws, which lets the parser
 * convert a malformed Gemini type into a controlled 422 rather than silently
 * persisting a wrong type.
 */
export function mapPublicTypeToDb(type: string): QuestionType {
  switch (type) {
    case "MCQ":
      return "MCQ";
    case "TF":
      return "TRUE_FALSE";
    case "ESSAY":
      return "ESSAY";
    default:
      throw new Error(`Unsupported question type: ${String(type)}`);
  }
}

/** Reverse mapping used when comparing generated DB types back to requests. */
export function mapDbTypeToPublic(type: QuestionType): PublicQuestionType {
  switch (type) {
    case "MCQ":
      return "MCQ";
    case "TRUE_FALSE":
      return "TF";
    case "ESSAY":
      return "ESSAY";
    default: {
      const exhaustive: never = type;
      throw new Error(`Unsupported DB question type: ${String(exhaustive)}`);
    }
  }
}

/** Canonical Arabic true/false option labels persisted for TRUE_FALSE questions. */
export const TF_TRUE = "صح";
export const TF_FALSE = "خطأ";
export const TF_OPTIONS: readonly string[] = [TF_TRUE, TF_FALSE];

const TRUE_TOKENS = new Set([
  "صح",
  "صحيح",
  "صواب",
  "نعم",
  "true",
  "t",
  "yes",
]);
const FALSE_TOKENS = new Set([
  "خطأ",
  "خطا",
  "غلط",
  "لا",
  "false",
  "f",
  "no",
]);

/**
 * Normalizes any accepted Arabic/English true-or-false answer into one of the
 * two canonical labels. Returns null when the value is not a recognized
 * true/false token so the parser can reject it.
 */
export function normalizeTfAnswer(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const token = value.trim().toLowerCase();
  if (TRUE_TOKENS.has(token)) {
    return TF_TRUE;
  }
  if (FALSE_TOKENS.has(token)) {
    return TF_FALSE;
  }
  return null;
}
