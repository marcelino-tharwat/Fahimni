import type { Request, Response, NextFunction } from "express";
import { asyncHandler } from "../../shared/utils/asyncHandler.js";
import { okResponse } from "../../shared/utils/apiResponse.js";
import { AppError } from "../../shared/utils/AppError.js";
import { ChapterService } from "./chapter.service.js";
import type { ChapterResponseDTO } from "./chapter.types.js";
import type { CreateChapterInput, UpdateChapterInput } from "./chapter.validation.js";

const chapterService = new ChapterService();

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

  public delete = asyncHandler(
    async (req: Request, res: Response, _next: NextFunction) => {
      const id = req.params.id;
      if (typeof id !== "string") {
        throw new AppError("Invalid chapter ID", 400);
      }

      await chapterService.delete(id, req.user!.id);

      res.status(200).json(okResponse("Chapter deleted successfully"));
    },
  );
}
