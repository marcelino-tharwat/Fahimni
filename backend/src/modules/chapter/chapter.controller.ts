import type { Request, Response, NextFunction } from "express";
import { asyncHandler } from "../../shared/utils/asyncHandler.js";
import { okResponse } from "../../shared/utils/apiResponse.js";
import { AppError } from "../../shared/utils/AppError.js";
import { ChapterService } from "./chapter.service.js";
import { QuizService } from "../quizzes/quizzes.service.js";
import type { ChapterResponseDTO } from "./chapter.types.js";
import type { QuizDetailResponseDTO } from "../quizzes/quizzes.types.js";
import type { CreateChapterInput, UpdateChapterInput, ReorderInput } from "./chapter.validation.js";

const chapterService = new ChapterService();
const quizService = new QuizService();

export class ChapterController {
  public create = asyncHandler(
    async (req: Request, res: Response, _next: NextFunction) => {
      const { stageId } = req.params;
      if (typeof stageId !== "string") {
        throw new AppError("Invalid stage ID", 400);
      }

      const input = req.body as CreateChapterInput;
      const chapter = await chapterService.create(input, stageId, req.user!.id);

      res
        .status(201)
        .json(okResponse<ChapterResponseDTO>(
          "Chapter created successfully",
          chapter,
        ));
    },
  );

  public list = asyncHandler(
    async (req: Request, res: Response, _next: NextFunction) => {
      const { stageId } = req.params;
      if (typeof stageId !== "string") {
        throw new AppError("Invalid stage ID", 400);
      }

      const chapters = await chapterService.listByStage(stageId, req.user!.id);

      res
        .status(200)
        .json(okResponse<ChapterResponseDTO[]>(
          "Chapters fetched successfully",
          chapters,
        ));
    },
  );

  public getById = asyncHandler(
    async (req: Request, res: Response, _next: NextFunction) => {
      const id = req.params.id;
      if (typeof id !== "string") {
        throw new AppError("Invalid chapter ID", 400);
      }

      const chapter = await chapterService.getById(id, req.user!.id);

      res
        .status(200)
        .json(okResponse<ChapterResponseDTO>(
          "Chapter fetched successfully",
          chapter,
        ));
    },
  );

  public update = asyncHandler(
    async (req: Request, res: Response, _next: NextFunction) => {
      const id = req.params.id;
      if (typeof id !== "string") {
        throw new AppError("Invalid chapter ID", 400);
      }

      const input = req.body as UpdateChapterInput;
      const chapter = await chapterService.update(id, req.user!.id, input);

      res
        .status(200)
        .json(okResponse<ChapterResponseDTO>(
          "Chapter updated successfully",
          chapter,
        ));
    },
  );

  public reorder = asyncHandler(
    async (req: Request, res: Response, _next: NextFunction) => {
      const ids = req.body as ReorderInput;
      const items = await chapterService.reorder(ids, req.user!.id);

      res
        .status(200)
        .json(okResponse<ChapterResponseDTO[]>(
          "Chapters reordered successfully",
          items,
        ));
    },
  );

  public delete = asyncHandler(
    async (req: Request, res: Response, _next: NextFunction) => {
      const id = req.params.id;
      if (typeof id !== "string") {
        throw new AppError("Invalid chapter ID", 400);
      }

      const force = req.query.force === "true";
      await chapterService.delete(id, req.user!.id, force);

      res.status(200).json(okResponse("Chapter deleted successfully"));
    },
  );

  public getChapterQuizzes = asyncHandler(
    async (req: Request, res: Response, _next: NextFunction) => {
      const chapterId = req.params.chapterId;
      if (typeof chapterId !== "string") {
        throw new AppError("Invalid chapter ID", 400);
      }

      const quizzes = await quizService.getChapterQuizzes(chapterId);

      res.status(200).json(okResponse<QuizDetailResponseDTO[]>(
        "Chapter quizzes fetched successfully",
        quizzes,
      ));
    },
  );
}
