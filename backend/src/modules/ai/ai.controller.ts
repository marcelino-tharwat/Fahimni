import type { Request, Response, NextFunction } from "express";
import { aiService } from "./ai.service.js";
import { asyncHandler } from "../../shared/utils/asyncHandler.js";
import { AppError } from "../../shared/utils/AppError.js";
import { okResponse } from "../../shared/utils/apiResponse.js";

export class AiController {
  indexLesson = asyncHandler(
    async (req: Request, res: Response, _next: NextFunction) => {
      const lessonId = String(req.params.lessonId);
      const { pdfText, metadata } = req.body;

      await aiService.indexLesson(lessonId, pdfText, metadata);

      res
        .status(200)
        .json(okResponse("Lesson indexed successfully", { lessonId, status: "ready" }));
    },
  );

  getStatus = asyncHandler(
    async (req: Request, res: Response, _next: NextFunction) => {
      const lessonId = String(req.params.lessonId);

      const result = await aiService.getStatus(lessonId);

      res
        .status(200)
        .json(okResponse("Indexing status retrieved", { lessonId, ...result }));
    },
  );

  similaritySearch = asyncHandler(
    async (req: Request, res: Response, _next: NextFunction) => {
      const { query, lessonId, k } = req.body;

      if (!query || typeof query !== "string" || query.trim().length === 0) {
        throw new AppError("query is required", 400);
      }

      const results = await aiService.similaritySearch(
        query,
        lessonId ?? undefined,
        k ?? 5,
      );

      res.status(200).json(okResponse("Similarity search completed", { results }));
    },
  );
}
