import type { Request, Response, NextFunction } from "express";
import { asyncHandler } from "../../shared/utils/asyncHandler.js";
import { okResponse } from "../../shared/utils/apiResponse.js";
import { AppError } from "../../shared/utils/AppError.js";
import { LessonsService } from "./lessons.service.js";
import type { LessonResponseDTO } from "./lessons.types.js";
import type { CreateLessonInput, UpdateLessonInput } from "./lessons.validation.js";

const lessonsService = new LessonsService();

export class LessonsController {
  public create = asyncHandler(
    async (req: Request, res: Response, _next: NextFunction) => {
      const { chapterId } = req.params;
      if (typeof chapterId !== "string") {
        throw new AppError("Invalid chapter ID", 400);
      }

      const input = req.body as CreateLessonInput;
      const lesson = await lessonsService.create(
        input,
        chapterId,
        req.user!.id,
      );

      res
        .status(201)
        .json(okResponse<LessonResponseDTO>(
          "Lesson created successfully",
          lesson,
        ));
    },
  );

  public list = asyncHandler(
    async (req: Request, res: Response, _next: NextFunction) => {
      const { chapterId } = req.params;
      if (typeof chapterId !== "string") {
        throw new AppError("Invalid chapter ID", 400);
      }

      const lessons = await lessonsService.listByChapter(
        chapterId,
        req.user!.id,
      );

      res
        .status(200)
        .json(okResponse<LessonResponseDTO[]>(
          "Lessons fetched successfully",
          lessons,
        ));
    },
  );

  public getById = asyncHandler(
    async (req: Request, res: Response, _next: NextFunction) => {
      const id = req.params.id;
      if (typeof id !== "string") {
        throw new AppError("Invalid lesson ID", 400);
      }

      const lesson = await lessonsService.getById(id, req.user!.id);

      res
        .status(200)
        .json(okResponse<LessonResponseDTO>(
          "Lesson fetched successfully",
          lesson,
        ));
    },
  );

  public update = asyncHandler(
    async (req: Request, res: Response, _next: NextFunction) => {
      const id = req.params.id;
      if (typeof id !== "string") {
        throw new AppError("Invalid lesson ID", 400);
      }

      const input = req.body as UpdateLessonInput;
      const lesson = await lessonsService.update(id, req.user!.id, input);

      res
        .status(200)
        .json(okResponse<LessonResponseDTO>(
          "Lesson updated successfully",
          lesson,
        ));
    },
  );

  public delete = asyncHandler(
    async (req: Request, res: Response, _next: NextFunction) => {
      const id = req.params.id;
      if (typeof id !== "string") {
        throw new AppError("Invalid lesson ID", 400);
      }

      await lessonsService.delete(id, req.user!.id);

      res.status(200).json(okResponse("Lesson deleted successfully"));
    },
  );
}
