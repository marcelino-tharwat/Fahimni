import type { Request, Response, NextFunction } from "express";
import { asyncHandler } from "../../shared/utils/asyncHandler.js";
import { okResponse } from "../../shared/utils/apiResponse.js";
import { AppError } from "../../shared/utils/AppError.js";
import { QuizService } from "./quizzes.service.js";
import type { QuizResponseDTO, QuizDetailResponseDTO } from "./quizzes.types.js";
import type { CreateQuizInput, UpdateQuizInput } from "./quizzes.validation.js";

const quizService = new QuizService();

export class QuizzesController {
  public create = asyncHandler(
    async (req: Request, res: Response, _next: NextFunction) => {
      const input = req.body as CreateQuizInput;
      const quiz = await quizService.create(input, req.user!.id);

      res
        .status(201)
        .json(okResponse<QuizResponseDTO>(
          "Quiz created successfully",
          quiz,
        ));
    },
  );

  public list = asyncHandler(
    async (req: Request, res: Response, _next: NextFunction) => {
      const status = req.query.status as string | undefined;
      const quizzes = await quizService.list(req.user!.id, status);

      res
        .status(200)
        .json(okResponse<QuizResponseDTO[]>(
          "Quizzes fetched successfully",
          quizzes,
        ));
    },
  );

  public getById = asyncHandler(
    async (req: Request, res: Response, _next: NextFunction) => {
      const id = req.params.id;
      if (typeof id !== "string") {
        throw new AppError("Invalid quiz ID", 400);
      }

      const quiz = await quizService.getById(id, req.user!.id);

      res
        .status(200)
        .json(okResponse<QuizDetailResponseDTO>(
          "Quiz fetched successfully",
          quiz,
        ));
    },
  );

  public update = asyncHandler(
    async (req: Request, res: Response, _next: NextFunction) => {
      const id = req.params.id;
      if (typeof id !== "string") {
        throw new AppError("Invalid quiz ID", 400);
      }

      const input = req.body as UpdateQuizInput;
      const quiz = await quizService.update(id, req.user!.id, input);

      res
        .status(200)
        .json(okResponse<QuizResponseDTO>(
          "Quiz updated successfully",
          quiz,
        ));
    },
  );

  public delete = asyncHandler(
    async (req: Request, res: Response, _next: NextFunction) => {
      const id = req.params.id;
      if (typeof id !== "string") {
        throw new AppError("Invalid quiz ID", 400);
      }

      await quizService.delete(id, req.user!.id);

      res.status(200).json(okResponse("Quiz deleted successfully"));
    },
  );
}
