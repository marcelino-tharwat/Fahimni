import type { Request, Response, NextFunction } from "express";
import { asyncHandler } from "../../shared/utils/asyncHandler.js";
import { okResponse } from "../../shared/utils/apiResponse.js";
import { AppError } from "../../shared/utils/AppError.js";
import { QuizService } from "./quizzes.service.js";
import { QuizGenerationService } from "./quiz-generation.service.js";
import { TeacherPlanPolicyService } from "../teacher-plans/teacher-plan-policy.service.js";
import type {
  GeneratedQuizDTO,
} from "./quiz-generation.service.js";
import type { QuizResponseDTO, QuizDetailResponseDTO } from "./quizzes.types.js";
import type { CreateQuizInput, UpdateQuizInput, AssignQuizInput } from "./quizzes.validation.js";
import type { GenerateQuizInput } from "./dto/generate-quiz.dto.js";

const quizService = new QuizService();
const quizGenerationService = new QuizGenerationService();
const planPolicyService = new TeacherPlanPolicyService();

export class QuizzesController {
  public generate = asyncHandler(
    async (req: Request, res: Response, _next: NextFunction) => {
      const input = req.body as GenerateQuizInput;
      const teacherId = req.user!.id;
      const locale = req.headers["accept-language"]?.startsWith("ar") ? "ar" : "en";

      await planPolicyService.checkAiUsageQuota(teacherId, "AI_QUIZ_GENERATION", 1, locale);

      const quiz = await quizGenerationService.generate(input, teacherId);

      await planPolicyService.recordAiUsage(teacherId, "AI_QUIZ_GENERATION", 1, {
        quizId: quiz.id,
        questionCount: input.questionCount,
      });

      res
        .status(201)
        .json(
          okResponse<GeneratedQuizDTO>(
            "تم إنشاء مسودة الاختبار بنجاح.",
            quiz,
          ),
        );
    },
  );

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

  public publishQuiz = asyncHandler(
    async (req: Request, res: Response, _next: NextFunction) => {
      const id = req.params.id;
      if (typeof id !== "string") {
        throw new AppError("Invalid quiz ID", 400);
      }

      const { progressionGateLessonIds } = (req.body ?? {}) as {
        progressionGateLessonIds?: string[];
      };

      const quiz = await quizService.publishQuiz(
        id,
        req.user!.id,
        progressionGateLessonIds && progressionGateLessonIds.length > 0
          ? { progressionGateLessonIds }
          : undefined,
      );

      res.status(200).json(okResponse<QuizResponseDTO>(
        "Quiz published successfully",
        quiz,
      ));
    },
  );

  public unpublishQuiz = asyncHandler(
    async (req: Request, res: Response, _next: NextFunction) => {
      const id = req.params.id;
      if (typeof id !== "string") {
        throw new AppError("Invalid quiz ID", 400);
      }

      const quiz = await quizService.unpublishQuiz(id, req.user!.id);

      res.status(200).json(okResponse<QuizResponseDTO>(
        "Quiz unpublished successfully",
        quiz,
      ));
    },
  );

  public assignQuiz = asyncHandler(
    async (req: Request, res: Response, _next: NextFunction) => {
      const id = req.params.id;
      if (typeof id !== "string") {
        throw new AppError("Invalid quiz ID", 400);
      }

      const { chapterId } = req.body as AssignQuizInput;
      const quiz = await quizService.assignQuiz(id, req.user!.id, chapterId);

      res.status(200).json(okResponse<QuizResponseDTO>(
        "Quiz assigned successfully",
        quiz,
      ));
    },
  );
}
