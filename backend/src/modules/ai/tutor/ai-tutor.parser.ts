import { TutorUnavailableError } from "./ai-tutor.errors.js";

/**
 * STORY-63 — strict parsing of the tutor's Gemini response.
 *
 * Expected shape: {"answer": string, "citationRefs": string[]}. The model is
 * asked for raw JSON (responseMimeType) but we still defensively strip Markdown
 * fences. Citation refs are normalized to the controlled `SOURCE_n` form and
 * de-duplicated; the service then validates them against the actually supplied
 * source keys (model-generated values are never trusted).
 */
export interface ParsedTutorResponse {
  answer: string;
  citationRefs: string[];
}

const SOURCE_REF = /^SOURCE_\d+$/;

/** Remove a ```json … ``` (or plain ``` … ```) fence if the model added one. */
function stripCodeFence(text: string): string {
  const trimmed = text.trim();
  if (!trimmed.startsWith("```")) {
    return trimmed;
  }
  return trimmed
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();
}

export function parseTutorResponse(
  raw: string,
  opts: { maxAnswerChars?: number } = {},
): ParsedTutorResponse {
  const maxAnswerChars = opts.maxAnswerChars ?? 4_000;

  let parsed: unknown;
  try {
    parsed = JSON.parse(stripCodeFence(raw));
  } catch {
    throw new TutorUnavailableError();
  }

  if (typeof parsed !== "object" || parsed === null) {
    throw new TutorUnavailableError();
  }

  const obj = parsed as Record<string, unknown>;

  const answerRaw = obj.answer;
  if (typeof answerRaw !== "string" || answerRaw.trim().length === 0) {
    throw new TutorUnavailableError();
  }
  const answer = answerRaw.trim().slice(0, maxAnswerChars);

  // citationRefs is optional; anything that is not a clean array of source keys
  // is ignored rather than trusted.
  const refsRaw = Array.isArray(obj.citationRefs) ? obj.citationRefs : [];
  const seen = new Set<string>();
  const citationRefs: string[] = [];
  for (const ref of refsRaw) {
    if (typeof ref !== "string") {
      continue;
    }
    const normalized = ref.trim().toUpperCase();
    if (SOURCE_REF.test(normalized) && !seen.has(normalized)) {
      seen.add(normalized);
      citationRefs.push(normalized);
    }
  }

  return { answer, citationRefs };
}
