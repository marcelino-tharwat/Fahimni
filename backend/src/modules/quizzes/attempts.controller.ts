import type { Request, Response, NextFunction } from "express";
import { asyncHandler } from "../../shared/utils/asyncHandler.js";
import { okResponse } from "../../shared/utils/apiResponse.js";
import { AppError } from "../../shared/utils/AppError.js";
import { attemptsService } from "./attempts.service.js";
import { resultsQuerySchema } from "./attempts.validation.js";
import type {
  GradeEssaysInput,
  SubmitAttemptInput,
} from "./attempts.validation.js";

export class AttemptsController {
  /** GET /api/quizzes/student (student) — grouped quiz list for the quiz page. */
  public getStudentQuizList = asyncHandler(
    async (req: Request, res: Response, _next: NextFunction) => {
      const data = await attemptsService.getStudentQuizList(req.user!.id);
      res.status(200).json(okResponse("Student quizzes fetched successfully", data));
    },
  );

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

  /** GET /api/attempts/:attemptId (student) — re-fetch own attempt results. */
  public getAttemptResults = asyncHandler(
    async (req: Request, res: Response, _next: NextFunction) => {
      const attemptId = req.params.attemptId;
      if (typeof attemptId !== "string") {
        throw new AppError("Invalid attempt ID", 400);
      }

      const data = await attemptsService.getAttemptResults(
        attemptId,
        req.user!.id,
      );
      res
        .status(200)
        .json(okResponse("Attempt results retrieved successfully", data));
    },
  );

  /** GET /api/quizzes/:quizId/results (teacher) — all attempts + breakdown. */
  public getResults = asyncHandler(
    async (req: Request, res: Response, _next: NextFunction) => {
      const quizId = req.params.quizId;
      if (typeof quizId !== "string") throw new AppError("Invalid quiz ID", 400);

      const parsed = resultsQuerySchema.safeParse(req.query);
      if (!parsed.success) throw parsed.error;

      const data = await attemptsService.getQuizResults(
        quizId,
        req.user!.id,
        parsed.data,
      );
      res.status(200).json(okResponse("Quiz results fetched successfully", data));
    },
  );

  /** GET /api/quizzes/:quizId/results/ungraded (teacher). */
  public getUngradedResults = asyncHandler(
    async (req: Request, res: Response, _next: NextFunction) => {
      const quizId = req.params.quizId;
      if (typeof quizId !== "string") throw new AppError("Invalid quiz ID", 400);

      const data = await attemptsService.getUngradedResults(quizId, req.user!.id);
      res
        .status(200)
        .json(okResponse("Ungraded attempts fetched successfully", data));
    },
  );

  /** GET /api/quizzes/:quizId/results/export (teacher) — CSV download. */
  public exportResults = asyncHandler(
    async (req: Request, res: Response, _next: NextFunction) => {
      const quizId = req.params.quizId;
      if (typeof quizId !== "string") throw new AppError("Invalid quiz ID", 400);

      const csv = await attemptsService.buildResultsCsv(quizId, req.user!.id);
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="quiz-${quizId}-results.csv"`,
      );
      res.status(200).send(csv);
    },
  );
}
