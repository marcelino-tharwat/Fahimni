import type { Request, Response, NextFunction } from "express";
import { asyncHandler } from "../../shared/utils/asyncHandler.js";
import { okResponse } from "../../shared/utils/apiResponse.js";
import { AppError } from "../../shared/utils/AppError.js";
import { attemptsService } from "./attempts.service.js";
import type { GradeEssaysInput, SubmitAttemptInput } from "./attempts.validation.js";

export class AttemptsController {
  /** GET /api/quizzes/assigned (student) */
  public getAssigned = asyncHandler(
    async (req: Request, res: Response, _next: NextFunction) => {
      const quizzes = await attemptsService.getAssignedQuizzes(req.user!.id);
      res
        .status(200)
        .json(okResponse("Assigned quizzes fetched successfully", quizzes));
    },
  );

  /** POST /api/quizzes/:id/attempt (student) */
  public startAttempt = asyncHandler(
    async (req: Request, res: Response, _next: NextFunction) => {
      const id = req.params.id;
      if (typeof id !== "string") throw new AppError("Invalid quiz ID", 400);

      const data = await attemptsService.startAttempt(id, req.user!.id);
      res.status(201).json(okResponse("Attempt started successfully", data));
    },
  );

  /** POST /api/attempts/:attemptId/submit (student) */
  public submit = asyncHandler(
    async (req: Request, res: Response, _next: NextFunction) => {
      const attemptId = req.params.attemptId;
      if (typeof attemptId !== "string") {
        throw new AppError("Invalid attempt ID", 400);
      }

      const input = req.body as SubmitAttemptInput;
      const data = await attemptsService.submitAttempt(
        attemptId,
        req.user!.id,
        input,
      );
      res.status(200).json(okResponse("Attempt submitted successfully", data));
    },
  );

  /** POST /api/attempts/:attemptId/grade-essays (teacher) */
  public gradeEssays = asyncHandler(
    async (req: Request, res: Response, _next: NextFunction) => {
      const attemptId = req.params.attemptId;
      if (typeof attemptId !== "string") {
        throw new AppError("Invalid attempt ID", 400);
      }

      const input = req.body as GradeEssaysInput;
      const data = await attemptsService.gradeEssays(
        attemptId,
        req.user!.id,
        input,
      );
      res.status(200).json(okResponse("Essays graded successfully", data));
    },
  );
}
