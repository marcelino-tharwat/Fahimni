import { prisma as defaultPrisma } from "../../config/database.js";
import { logger } from "../../config/logger.js";
import { AppError } from "../../shared/utils/AppError.js";
import { buildEssayGradingPrompt } from "../ai/gemini/prompts/essay-grading.prompt.js";
import { parseEssaySuggestion } from "./essay-ai-grading.js";
import type { QuestionResult } from "./auto-grade.js";
import { Prisma } from "../../generated/prisma/client.js";

/** Signature of the LLM text-generation call (injectable for tests). */
export type GenerateFn = (prompt: string) => Promise<string>;

export interface EssaySuggestionResult {
  questionId: string;
  status: "AI_SUGGESTED" | "AI_UNAVAILABLE" | "ALREADY_GRADED";
  suggestedScore: number | null;
  feedback: string | null;
}

/**
 * Generates AI-suggested scores + feedback for the pending essay answers of a
 * submitted attempt. Suggestions are advisory: they are written to the attempt
 * `answers` JSON as `aiSuggested*` fields WITHOUT touching `awardedPoints`, so
 * the essay stays `pending` (attempt stays COMPLETED, progression stays gated)
 * until a teacher approves it. Fully graceful: a provider failure for any essay
 * degrades to AI_UNAVAILABLE and manual grading remains possible.
 *
 * Deliberately teacher-triggered (not run at student submit time) so the
 * critical submit path is never slowed or broken by the LLM.
 */
export class EssayAiGradingService {
  private readonly generate: GenerateFn;

  constructor(
    private readonly prisma = defaultPrisma,
    generate?: GenerateFn,
  ) {
    // Default lazily imports the Gemini client so merely importing this module
    // (e.g. via the route table) never constructs the client — construction is
    // deferred to first real use, where the API key is guaranteed present.
    this.generate =
      generate ??
      (async (prompt: string): Promise<string> => {
        const { geminiClient } = await import(
          "../../shared/services/geminiClient.js"
        );
        return geminiClient.generateContent(
          prompt,
          { temperature: 0.2, responseMimeType: "application/json", maxOutputTokens: 1024 },
          { timeoutMs: 20_000 },
        );
      });
  }

  public async suggestForAttempt(attemptId: string, teacherId: string) {
    const attempt = await this.prisma.quizAttempt.findUnique({
      where: { id: attemptId },
      select: {
        id: true,
        status: true,
        quizId: true,
        answers: true,
        quiz: { select: { createdBy: true } },
      },
    });

    if (!attempt) throw new AppError("Attempt not found", 404);
    if (attempt.quiz.createdBy !== teacherId) {
      throw new AppError("You do not own this quiz", 403);
    }
    if (!["COMPLETED", "GRADED"].includes(attempt.status)) {
      throw new AppError("Attempt is not eligible for essay review", 409);
    }

    const questions = await this.prisma.question.findMany({
      where: { quizId: attempt.quizId, type: "ESSAY" },
      select: { id: true, text: true, points: true, explanation: true },
    });
    if (questions.length === 0) {
      throw new AppError("Quiz has no essay questions", 404);
    }
    const qMap = new Map(questions.map((q) => [q.id, q]));

    const stored = ((attempt.answers as unknown as QuestionResult[]) ?? []).slice();
    const results: EssaySuggestionResult[] = [];
    let anySuggested = false;

    for (let i = 0; i < stored.length; i += 1) {
      const r = stored[i]!;
      if (r.type !== "ESSAY") continue;
      const q = qMap.get(r.questionId);
      if (!q) continue;

      // Already graded/approved — never overwrite a teacher decision.
      if (r.awardedPoints !== null && r.awardedPoints !== undefined) {
        results.push({
          questionId: r.questionId,
          status: "ALREADY_GRADED",
          suggestedScore: null,
          feedback: null,
        });
        continue;
      }

      try {
        const prompt = buildEssayGradingPrompt({
          questionText: q.text,
          maxPoints: q.points,
          modelAnswer: q.explanation,
          studentAnswer: r.answer ?? "",
        });
        const raw = await this.generate(prompt);
        const suggestion = parseEssaySuggestion(raw, q.points);
        stored[i] = {
          ...r,
          aiSuggestedPoints: suggestion.suggestedScore,
          aiSuggestedFeedback: suggestion.feedback,
          aiSuggestedAt: new Date().toISOString(),
        };
        anySuggested = true;
        results.push({
          questionId: r.questionId,
          status: "AI_SUGGESTED",
          suggestedScore: suggestion.suggestedScore,
          feedback: suggestion.feedback,
        });
      } catch (err) {
        logger.warn("essay_ai_suggestion_failed", {
          teacherId,
          attemptId,
          questionId: r.questionId,
          error: err instanceof Error ? err.message : String(err),
        });
        results.push({
          questionId: r.questionId,
          status: "AI_UNAVAILABLE",
          suggestedScore: null,
          feedback: null,
        });
      }
    }

    // Persist only if at least one suggestion was produced. Guard on COMPLETED
    // so a concurrent teacher grade (→ GRADED) is never clobbered.
    if (anySuggested) {
      await this.prisma.quizAttempt.updateMany({
        where: { id: attemptId, status: "COMPLETED" },
        data: { answers: stored as unknown as Prisma.InputJsonValue },
      });
    }

    logger.info("essay_ai_suggestion_completed", {
      teacherId,
      attemptId,
      quizId: attempt.quizId,
      suggestedCount: results.filter((r) => r.status === "AI_SUGGESTED").length,
      unavailableCount: results.filter((r) => r.status === "AI_UNAVAILABLE").length,
    });

    return {
      attemptId,
      aiAvailable: anySuggested,
      suggestions: results,
    };
  }
}

export const essayAiGradingService = new EssayAiGradingService();
