import type { Request, Response, NextFunction } from "express";
import { asyncHandler } from "../../shared/utils/asyncHandler.js";
import { okResponse } from "../../shared/utils/apiResponse.js";
import { AppError } from "../../shared/utils/AppError.js";
import { QuizService } from "./quizzes.service.js";
import type { QuestionResponseDTO } from "./quizzes.types.js";
import type {
  AddQuestionInput,
  UpdateQuestionInput,
  ReorderInput,
} from "./quizzes.validation.js";

const quizService = new QuizService();

export class QuestionsController {
  public addQuestion = asyncHandler(
    async (req: Request, res: Response, _next: NextFunction) => {
      const { quizId } = req.params;
      if (typeof quizId !== "string") {
        throw new AppError("Invalid quiz ID", 400);
      }

      const input = req.body as AddQuestionInput;
      const question = await quizService.addQuestion(
        quizId,
        req.user!.id,
        input,
      );

      res
        .status(201)
        .json(okResponse<QuestionResponseDTO>(
          "Question added successfully",
          question,
        ));
    },
  );

  public updateQuestion = asyncHandler(
    async (req: Request, res: Response, _next: NextFunction) => {
      const { quizId, qId } = req.params;
      if (typeof quizId !== "string") {
        throw new AppError("Invalid quiz ID", 400);
      }
      if (typeof qId !== "string") {
        throw new AppError("Invalid question ID", 400);
      }

      const input = req.body as UpdateQuestionInput;
      const question = await quizService.updateQuestion(
        qId,
        quizId,
        req.user!.id,
        input,
      );

      res
        .status(200)
        .json(okResponse<QuestionResponseDTO>(
          "Question updated successfully",
          question,
        ));
    },
  );

  public deleteQuestion = asyncHandler(
    async (req: Request, res: Response, _next: NextFunction) => {
      const { quizId, qId } = req.params;
      if (typeof quizId !== "string") {
        throw new AppError("Invalid quiz ID", 400);
      }
      if (typeof qId !== "string") {
        throw new AppError("Invalid question ID", 400);
      }

      await quizService.deleteQuestion(qId, quizId, req.user!.id);

      res.status(200).json(okResponse("Question deleted successfully"));
    },
  );

  public reorderQuestions = asyncHandler(
    async (req: Request, res: Response, _next: NextFunction) => {
      const { quizId } = req.params;
      if (typeof quizId !== "string") {
        throw new AppError("Invalid quiz ID", 400);
      }

      const items = req.body as ReorderInput;
      const questions = await quizService.reorderQuestions(
        quizId,
        req.user!.id,
        items,
      );

      res
        .status(200)
        .json(okResponse<QuestionResponseDTO[]>(
          "Questions reordered successfully",
          questions,
        ));
    },
  );
}
