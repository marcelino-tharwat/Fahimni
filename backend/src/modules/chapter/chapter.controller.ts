import type { Request, Response, NextFunction } from "express";
import { asyncHandler } from "../../shared/utils/asyncHandler.js";
import { okResponse } from "../../shared/utils/apiResponse.js";
import { AppError } from "../../shared/utils/AppError.js";
import { UploadService } from "../../shared/upload.service.js";
import { ChapterService } from "./chapter.service.js";
import { QuizService } from "../quizzes/quizzes.service.js";
import { quizVisibilityService } from "../quizzes/quiz-visibility.service.js";
import { assertStudentChapterAccess } from "../progression/student-chapter-access.js";
import type { ChapterResponseDTO, StudentChapterResponseDTO } from "./chapter.types.js";
import type { QuizDetailResponseDTO } from "../quizzes/quizzes.types.js";
import type { StudentQuizVisibilityDTO } from "../quizzes/quiz-visibility.types.js";
import type { CreateChapterInput, UpdateChapterInput, ReorderInput } from "./chapter.validation.js";

const chapterService = new ChapterService();
const quizService = new QuizService();
const uploadService = new UploadService();

export class ChapterController {
  public create = asyncHandler(
    async (req: Request, res: Response, _next: NextFunction) => {
      const { stageId } = req.params;
      if (typeof stageId !== "string") {
        throw new AppError("Invalid stage ID", 400);
      }

      const input = req.body as CreateChapterInput & { sortOrder: string };
      const sortOrder = parseInt(String(input.sortOrder), 10);

      // Handle image upload if provided
      let imageUrl: string | null = null;
      if (req.file) {
        imageUrl = await uploadService.uploadChapterImage(req.file.buffer);
      }

      const chapter = await chapterService.create(
        {
          name: input.name,
          description: input.description ?? null,
          sortOrder: isNaN(sortOrder) ? 1 : sortOrder,
          price: input.price ?? null,
        },
        stageId,
        req.user!.id,
        imageUrl,
      );

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

      if (req.user!.role === "STUDENT") {
        const chapter = await chapterService.getByIdForStudent(id);
        res
          .status(200)
          .json(okResponse<StudentChapterResponseDTO>(
            "Chapter fetched successfully",
            chapter,
          ));
      } else {
        const chapter = await chapterService.getById(id, req.user!.id);
        res
          .status(200)
          .json(okResponse<ChapterResponseDTO>(
            "Chapter fetched successfully",
            chapter,
          ));
      }
    },
  );

  public update = asyncHandler(
    async (req: Request, res: Response, _next: NextFunction) => {
      const id = req.params.id;
      if (typeof id !== "string") {
        throw new AppError("Invalid chapter ID", 400);
      }

      const input = req.body as UpdateChapterInput;

      // Handle image upload if provided
      let imageUrl: string | undefined;
      if (req.file) {
        imageUrl = await uploadService.uploadChapterImage(req.file.buffer);
      }

      const chapter = await chapterService.update(id, req.user!.id, input, imageUrl);

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

      const lessonId =
        typeof req.query.lessonId === "string" ? req.query.lessonId : undefined;

      if (req.user!.role === "STUDENT") {
        await assertStudentChapterAccess(req.user!.id, chapterId);
        if (lessonId) {
          await quizVisibilityService.assertLessonInChapter(lessonId, chapterId);
        }
        const quizzes = await quizVisibilityService.listChapterQuizzesForStudent(
          req.user!.id,
          chapterId,
          lessonId,
        );
        res.status(200).json(
          okResponse<StudentQuizVisibilityDTO[]>(
            "Chapter quizzes fetched successfully",
            quizzes,
          ),
        );
        return;
      }

      const quizzes = await quizService.getChapterQuizzes(chapterId, req.user!.id);

      res.status(200).json(okResponse<QuizDetailResponseDTO[]>(
        "Chapter quizzes fetched successfully",
        quizzes,
      ));
    },
  );
}
