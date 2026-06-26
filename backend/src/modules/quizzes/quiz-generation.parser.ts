import type { QuestionType } from "../../generated/prisma/client.js";
import type { PublicQuestionType } from "./dto/generate-quiz.dto.js";
import {
  mapPublicTypeToDb,
  mapDbTypeToPublic,
  normalizeTfAnswer,
  TF_OPTIONS,
  TF_TRUE,
  TF_FALSE,
} from "./quiz-generation.mapping.js";
import { QuizGenerationParseError } from "./quiz-generation.errors.js";

export interface ParsedQuestion {
  type: QuestionType;
  content: string;
  /** Array of option labels for MCQ/TF; null for ESSAY. */
  options: string[] | null;
  /** Correct option label for MCQ/TF; null for ESSAY. */
  correctAnswer: string | null;
  points: number;
  sortOrder: number;
}

export interface ParsedQuiz {
  title: string | null;
  description: string | null;
  questions: ParsedQuestion[];
}

export interface ParseExpectations {
  questionCount: number;
  requestedTypes: PublicQuestionType[];
}

/**
 * Extracts a single JSON object string from a raw model response. Supports:
 *  - plain JSON
 *  - JSON inside a ```json fenced block
 *  - JSON inside a generic ``` fenced block
 *  - one JSON object surrounded by limited extra text (first `{` .. last `}`)
 *
 * Uses JSON.parse only — never eval.
 */
function extractJsonObject(raw: string): unknown {
  if (typeof raw !== "string" || raw.trim().length === 0) {
    throw new QuizGenerationParseError("استجابة فارغة من مزود الذكاء الاصطناعي.");
  }

  let text = raw.trim();

  const fenced =
    text.match(/```json\s*([\s\S]*?)\s*```/i) ??
    text.match(/```\s*([\s\S]*?)\s*```/i);
  if (fenced && fenced[1]) {
    text = fenced[1].trim();
  }

  // If there is still surrounding prose, isolate the outermost object.
  if (!text.startsWith("{")) {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start !== -1 && end !== -1 && end > start) {
      text = text.slice(start, end + 1);
    }
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new QuizGenerationParseError(
      "تعذّر تحليل مخرجات الذكاء الاصطناعي كصيغة JSON صالحة.",
    );
  }
}

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function normalizePoints(value: unknown): number {
  if (value === undefined || value === null) {
    return 1;
  }
  if (typeof value !== "number" || !Number.isInteger(value) || value <= 0) {
    throw new QuizGenerationParseError("قيمة درجات السؤال غير صالحة.");
  }
  return value;
}

function normalizeMcq(raw: Record<string, unknown>): {
  options: string[];
  correctAnswer: string;
} {
  const rawOptions = raw.options;
  if (!Array.isArray(rawOptions)) {
    throw new QuizGenerationParseError("خيارات سؤال الاختيار من متعدد مفقودة.");
  }

  const options = rawOptions.map(asString).filter((o) => o.length > 0);
  if (options.length < 2) {
    throw new QuizGenerationParseError(
      "يجب أن يحتوي سؤال الاختيار من متعدد على خيارين متمايزين على الأقل.",
    );
  }
  if (new Set(options).size !== options.length) {
    throw new QuizGenerationParseError(
      "خيارات سؤال الاختيار من متعدد مكررة.",
    );
  }

  const correctAnswer = asString(raw.correctAnswer);
  if (!correctAnswer || !options.includes(correctAnswer)) {
    throw new QuizGenerationParseError(
      "الإجابة الصحيحة لسؤال الاختيار من متعدد غير مطابقة لأي خيار.",
    );
  }

  return { options, correctAnswer };
}

function normalizeTf(raw: Record<string, unknown>): {
  options: string[];
  correctAnswer: string;
} {
  const correctAnswer = normalizeTfAnswer(raw.correctAnswer);
  if (!correctAnswer) {
    throw new QuizGenerationParseError(
      "الإجابة الصحيحة لسؤال صح/خطأ غير صالحة.",
    );
  }
  return { options: [...TF_OPTIONS], correctAnswer };
}

/**
 * Parses and validates a raw Gemini response into a structured, persistable
 * quiz. Throws {@link QuizGenerationParseError} on any structural or semantic
 * violation so the caller can return a controlled 422 without persisting
 * anything. The raw model payload is never surfaced to the client.
 */
export function parseQuizGenerationResponse(
  raw: string,
  expected: ParseExpectations,
): ParsedQuiz {
  const parsed = extractJsonObject(raw);

  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new QuizGenerationParseError("بنية المخرجات غير صالحة.");
  }

  const obj = parsed as Record<string, unknown>;
  const rawQuestions = obj.questions;

  if (!Array.isArray(rawQuestions)) {
    throw new QuizGenerationParseError("قائمة الأسئلة مفقودة أو غير صالحة.");
  }

  const seenContent = new Set<string>();
  const questions: ParsedQuestion[] = [];

  for (const item of rawQuestions) {
    if (typeof item !== "object" || item === null) {
      throw new QuizGenerationParseError("أحد الأسئلة بصيغة غير صالحة.");
    }
    const q = item as Record<string, unknown>;

    const publicType = asString(q.type);
    if (!["MCQ", "TF", "ESSAY"].includes(publicType)) {
      throw new QuizGenerationParseError(
        `نوع سؤال غير مدعوم: ${publicType || "غير معروف"}.`,
      );
    }

    const content = asString(q.content);
    if (!content) {
      throw new QuizGenerationParseError("نص السؤال فارغ.");
    }

    const dedupeKey = content.replace(/\s+/g, " ").toLowerCase();
    if (seenContent.has(dedupeKey)) {
      // Exact/near-duplicate content: skip so the final count can be validated.
      continue;
    }
    seenContent.add(dedupeKey);

    const dbType: QuestionType = mapPublicTypeToDb(publicType);
    const points = normalizePoints(q.points);

    let options: string[] | null;
    let correctAnswer: string | null;

    if (dbType === "MCQ") {
      const mcq = normalizeMcq(q);
      options = mcq.options;
      correctAnswer = mcq.correctAnswer;
    } else if (dbType === "TRUE_FALSE") {
      const tf = normalizeTf(q);
      options = tf.options;
      correctAnswer = tf.correctAnswer;
    } else {
      // ESSAY: never persist a model-supplied answer; options normalized to null.
      options = null;
      correctAnswer = null;
    }

    questions.push({
      type: dbType,
      content,
      options,
      correctAnswer,
      points,
      sortOrder: questions.length + 1,
    });
  }

  if (questions.length !== expected.questionCount) {
    throw new QuizGenerationParseError(
      `عدد الأسئلة الناتجة (${questions.length}) لا يطابق العدد المطلوب (${expected.questionCount}).`,
    );
  }

  // Only requested types may appear, and every requested type must be present.
  const producedTypes = new Set(questions.map((q) => mapDbTypeToPublic(q.type)));
  const requestedTypes = new Set(expected.requestedTypes);

  for (const produced of producedTypes) {
    if (!requestedTypes.has(produced)) {
      throw new QuizGenerationParseError(
        `نوع سؤال لم يُطلب ظهر في المخرجات: ${produced}.`,
      );
    }
  }
  for (const requested of requestedTypes) {
    if (!producedTypes.has(requested)) {
      throw new QuizGenerationParseError(
        `نوع سؤال مطلوب لم يظهر في المخرجات: ${requested}.`,
      );
    }
  }

  const title = asString(obj.title) || null;
  const description = asString(obj.description) || null;

  return { title, description, questions };
}

export { TF_TRUE, TF_FALSE };
