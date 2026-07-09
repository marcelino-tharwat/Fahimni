import type { Request, Response, NextFunction } from "express";
import { prisma } from "../../config/database.js";
import { Prisma } from "../../generated/prisma/client.js";
import { asyncHandler } from "../../shared/utils/asyncHandler.js";
import { AppError } from "../../shared/utils/AppError.js";
import { okResponse } from "../../shared/utils/apiResponse.js";
import { logger } from "../../config/logger.js";
import type {
  ContentTreeResponse,
  StudentContentTreeResponse,
  StudentChapterNode,
  StudentLessonNode,
  EnrollmentStatus,
  MyCourseResponse,
} from "./content.types.js";
import {
  evaluateChapterLessons,
  assertLessonUnlocked,
} from "../progression/lesson-progression.js";
import { loadChapterProgressionContext } from "../progression/progression-context.js";
import { quizVisibilityService } from "../quizzes/quiz-visibility.service.js";
import { buildStudentMaterialsForLesson } from "../materials/materials.service.js";

export class ContentController {
  getTree = asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
      const teacherId = req.user!.id;

      const stages = await prisma.stage.findMany({
        where: { teacherId, deletedAt: null },
        orderBy: { sortOrder: "asc" },
        include: {
          chapters: {
            where: { deletedAt: null },
            orderBy: { sortOrder: "asc" },
            include: {
              lessons: {
                orderBy: { sortOrder: "asc" },
              },
            },
          },
        },
      });

      // ─── Diagnostics on empty result ───────────────────────────────
      if (stages.length === 0) {
        const userRecord = await prisma.user.findUnique({
          where: { id: teacherId },
          select: { id: true, fullName: true, email: true, role: true },
        });

        const [allStages, allChapters, allLessons, teacherStagesAll] =
          await Promise.all([
            prisma.stage.count(),
            prisma.chapter.count(),
            prisma.lesson.count(),
            prisma.stage.findMany({
              where: { teacherId },
              select: { id: true, name: true, deletedAt: true, sortOrder: true },
              orderBy: { sortOrder: "asc" },
            }),
          ]);

        const diagnostics = {
          message: "No content found. Diagnostics below.",
          authenticatedUser: userRecord ?? { id: teacherId, note: "Not found in DB" },
          databaseTotals: {
            stages: allStages,
            chapters: allChapters,
            lessons: allLessons,
          },
          stagesForTeacher: {
            total: teacherStagesAll.length,
            withDeletedAtNull: teacherStagesAll.filter((s) => s.deletedAt === null).length,
            withDeletedAtSet: teacherStagesAll.filter((s) => s.deletedAt !== null).length,
            records: teacherStagesAll,
          },
          jwtUserId: teacherId,
          hints: [
            "If authenticatedUser is null → token sub points to deleted user",
            "If databaseTotals are 0 → seed may have run on different DB",
            "If stagesForTeacher.total is 0 → user ID doesn't match any teacherId on stages",
            "If stagesForTeacher.withDeletedAtSet > 0 → stages are soft-deleted",
            "Use seed credentials: ahmed.hassan@school.edu / Teacher@123456",
          ],
        };

        res.status(200).json(diagnostics);
        return;
      }

      let totalItems = 0;
      for (const stage of stages) {
        totalItems += 1 + stage.chapters.length;
        for (const chapter of stage.chapters) {
          totalItems += chapter.lessons.length;
        }
      }

      if (totalItems > 2000) {
        return next(new AppError("Content tree too large", 413));
      }

      const result: ContentTreeResponse[] = stages.map((stage) => ({
        stage: {
          id: stage.id,
          name: stage.name,
          sortOrder: stage.sortOrder,
          chapterCount: stage.chapters.length,
        },
        chapters: stage.chapters.map((chapter) => ({
          chapter: {
            id: chapter.id,
            name: chapter.name,
            sortOrder: chapter.sortOrder,
            lessonCount: chapter.lessons.length,
          },
          lessons: chapter.lessons.map((lesson) => ({
            id: lesson.id,
            title: lesson.title,
            sortOrder: lesson.sortOrder,
          })),
        })),
      }));

      res.json(result);
    },
  );

  getStudentTree = asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
      const studentId = req.user!.id;

      const studentProfile = await prisma.studentProfile.findUnique({
        where: { userId: studentId },
        select: { stageId: true },
      });

      if (!studentProfile) {
        throw new AppError("Student profile not found", 404);
      }

      const stages = await prisma.stage.findMany({
        where: {
          id: studentProfile.stageId,
          deletedAt: null,
          teacher: {
            role: "OPERATION",
            status: "ACTIVE",
            teacherApprovalState: "APPROVED",
          },
        },
        orderBy: { sortOrder: "asc" },
        include: {
          chapters: {
            where: { deletedAt: null },
            orderBy: { sortOrder: "asc" },
            include: {
              lessons: {
                orderBy: { sortOrder: "asc" },
              },
            },
          },
        },
      });

      if (stages.length === 0) {
        res.json([]);
        return;
      }

      const enrolledChapterIds = await prisma.enrollment.findMany({
        where: { studentId, status: "ACTIVE" },
        select: { chapterId: true },
      });
      const enrolledSet = new Set(enrolledChapterIds.map((e) => e.chapterId));

      const result: StudentContentTreeResponse[] = await Promise.all(
        stages.map(async (stage) => ({
          stage: {
            id: stage.id,
            name: stage.name,
            sortOrder: stage.sortOrder,
            chapterCount: stage.chapters.length,
          },
          chapters: await Promise.all(
            stage.chapters.map(async (chapter) => {
              let enrollmentStatus: EnrollmentStatus;
              const price = chapter.price ? Number(chapter.price) : null;

              if (enrolledSet.has(chapter.id)) {
                enrollmentStatus = "purchased";
              } else if (price === null || price === 0) {
                enrollmentStatus = "free";
              } else {
                enrollmentStatus = "locked";
              }

              const activeLessons = chapter.lessons.filter((l) => l.deletedAt === null);
              const progressionCtx = await loadChapterProgressionContext(
                studentId,
                chapter.id,
                price,
              );
              progressionCtx.lessons = activeLessons.map((l) => ({
                id: l.id,
                sortOrder: l.sortOrder,
                requiredQuizId: l.requiredQuizId ?? null,
              }));
              const accessEvaluations = evaluateChapterLessons(progressionCtx);

              const studentChapter: StudentChapterNode = {
                id: chapter.id,
                name: chapter.name,
                description: chapter.description,
                sortOrder: chapter.sortOrder,
                price,
                lessonCount: activeLessons.length,
                enrollmentStatus,
              };

              return {
                chapter: studentChapter,
                lessons: activeLessons.map((lesson, index): StudentLessonNode => {
                  const access = accessEvaluations[index]!;
                  return {
                    id: lesson.id,
                    title: lesson.title,
                    sortOrder: lesson.sortOrder,
                    accessStatus: access.accessStatus,
                    isUnlocked: access.isUnlocked,
                    lockReason: access.lockReason,
                    progressStatus: access.progressStatus,
                    requiredQuizId: access.requiredQuizId,
                    nextLessonId: access.nextLessonId,
                  };
                }),
              };
            }),
          ),
        })),
      );

      res.json(result);
    },
  );

  getMyCourses = asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
      const studentId = req.user!.id;

      const studentProfile = await prisma.studentProfile.findUnique({
        where: { userId: studentId },
        select: { stageId: true },
      });

      if (!studentProfile) {
        throw new AppError("Student profile not found", 404);
      }

      const enrollments = await prisma.enrollment.findMany({
        where: {
          studentId,
          status: "ACTIVE",
          chapter: { stageId: studentProfile.stageId },
        },
        include: {
          chapter: {
            include: {
              stage: { select: { name: true } },
              lessons: {
                where: { deletedAt: null },
                select: { id: true },
              },
            },
          },
        },
      });

      if (enrollments.length === 0) {
        res.json([]);
        return;
      }

      const allLessonIds = enrollments.flatMap((e) =>
        e.chapter.lessons.map((l) => l.id),
      );

      const progressRecords = await prisma.lessonProgress.findMany({
        where: { studentId, lessonId: { in: allLessonIds }, completed: true },
      });

      const completedByLesson = new Set<string>();
      for (const rec of progressRecords) {
        completedByLesson.add(rec.lessonId);
      }

      const result: MyCourseResponse[] = enrollments.map((enrollment) => {
        const chapter = enrollment.chapter;
        const totalLessons = chapter.lessons.length;
        const completedCount = chapter.lessons.filter((l) =>
          completedByLesson.has(l.id),
        ).length;
        const completionProgress =
          totalLessons > 0
            ? Math.round((completedCount / totalLessons) * 100)
            : 0;

        return {
          id: chapter.id,
          name: chapter.name,
          description: chapter.description,
          sortOrder: chapter.sortOrder,
          price: chapter.price ? Number(chapter.price) : null,
          stageId: chapter.stageId,
          stageName: chapter.stage.name,
          lessonCount: totalLessons,
          completionProgress,
        };
      });

      res.json(okResponse("My courses fetched successfully", result));
    },
  );

  getStudentLesson = asyncHandler(
    async (req: Request, res: Response) => {
      const studentId = req.user!.id;
      const lessonId = req.params.id as string;

      const lesson = await prisma.lesson.findFirst({
        where: {
          id: lessonId,
          deletedAt: null,
          chapter: { deletedAt: null, stage: { deletedAt: null } },
        },
        select: {
          id: true,
          title: true,
          description: true,
          durationMinutes: true,
          youtubeUrl: true,
          sortOrder: true,
          chapterId: true,
          createdAt: true,
          updatedAt: true,
          chapter: { select: { id: true, price: true } },
          lessonMaterials: {
            where: { deletedAt: null },
            select: {
              id: true,
              filePath: true,
              displayName: true,
              fileSize: true,
              mimeType: true,
            },
          },
        },
      });

      if (!lesson) {
        throw new AppError("Lesson not found", 404);
      }

      const { chapter, lessonMaterials, ...lessonFields } = lesson;

      if (!(await this.ensureChapterAccess(res, studentId, chapter))) {
        return;
      }

      const price = chapter.price !== null ? Number(chapter.price) : null;
      const progressionCtx = await loadChapterProgressionContext(
        studentId,
        lessonFields.chapterId,
        price,
      );
      const lessonIndex = progressionCtx.lessons.findIndex(
        (l) => l.id === lessonId,
      );
      if (lessonIndex < 0) {
        throw new AppError("Lesson not found", 404);
      }
      const access = evaluateChapterLessons(progressionCtx)[lessonIndex]!;
      assertLessonUnlocked(access, {
        studentId,
        chapterId: lessonFields.chapterId,
      });

      const quizzes = await quizVisibilityService.buildLessonQuizzesSection(
        studentId,
        lessonId,
        lessonFields.chapterId,
        access.requiredQuizId,
        access.progressStatus,
      );

      const materials = (
        lessonMaterials ?? []
      ) as Array<{
        id: string;
        displayName: string;
        fileSize: number;
        mimeType: string;
      }>;

      const attachments = await buildStudentMaterialsForLesson(
        studentId,
        materials,
      );

      res.status(200).json(
        okResponse("Lesson fetched successfully", {
          ...lessonFields,
          attachments,
          accessStatus: access.accessStatus,
          isUnlocked: access.isUnlocked,
          lockReason: access.lockReason,
          progressStatus: access.progressStatus,
          requiredQuizId: access.requiredQuizId,
          nextLessonId: access.nextLessonId,
          quizzes,
        }),
      );
    },
  );

  completeStudentLesson = asyncHandler(
    async (req: Request, res: Response) => {
      const studentId = req.user!.id;
      const lessonId = req.params.id as string;

      const lesson = await prisma.lesson.findFirst({
        where: {
          id: lessonId,
          deletedAt: null,
          chapter: { deletedAt: null, stage: { deletedAt: null } },
        },
        select: {
          id: true,
          chapterId: true,
          chapter: { select: { id: true, price: true } },
        },
      });

      if (!lesson) {
        throw new AppError("Lesson not found", 404);
      }

      if (!(await this.ensureChapterAccess(res, studentId, lesson.chapter))) {
        return;
      }

      const price =
        lesson.chapter.price !== null ? Number(lesson.chapter.price) : null;
      const progressionCtx = await loadChapterProgressionContext(
        studentId,
        lesson.chapterId,
        price,
      );
      const lessonIndex = progressionCtx.lessons.findIndex(
        (l) => l.id === lessonId,
      );
      if (lessonIndex < 0) {
        throw new AppError("Lesson not found", 404);
      }
      const accessBefore = evaluateChapterLessons(progressionCtx)[lessonIndex]!;
      assertLessonUnlocked(accessBefore, {
        studentId,
        chapterId: lesson.chapterId,
      });

      await prisma.lessonProgress.upsert({
        where: {
          studentId_lessonId: { studentId, lessonId },
        },
        create: { studentId, lessonId, completed: true },
        update: { completed: true },
      });

      progressionCtx.completedLessonIds.add(lessonId);
      const accessAfter = evaluateChapterLessons(progressionCtx)[lessonIndex]!;

      const quizzes = await quizVisibilityService.buildLessonQuizzesSection(
        studentId,
        lessonId,
        lesson.chapterId,
        accessAfter.requiredQuizId,
        accessAfter.progressStatus,
      );

      logger.info("lesson_completed", {
        studentId,
        chapterId: lesson.chapterId,
        lessonId,
        requiredQuizId: accessAfter.requiredQuizId,
        nextLessonId: accessAfter.nextLessonId,
      });

      res.status(200).json(
        okResponse("Lesson marked complete", {
          lessonId,
          progressStatus: "COMPLETED",
          requiredQuizId: accessAfter.requiredQuizId,
          nextLessonId: accessAfter.nextLessonId,
          quizzes,
          access: accessAfter,
        }),
      );
    },
  );

  incrementLessonView = asyncHandler(
    async (req: Request, res: Response) => {
      const studentId = req.user!.id;
      const lessonId = req.params.id as string;

      const lesson = await prisma.lesson.findFirst({
        where: {
          id: lessonId,
          deletedAt: null,
          chapter: { deletedAt: null, stage: { deletedAt: null } },
        },
        select: { id: true, chapter: { select: { id: true, price: true } } },
      });

      if (!lesson) {
        throw new AppError("Lesson not found", 404);
      }

      // Only count a view if the student is actually allowed to watch the
      // lesson — otherwise paid lessons accrue fake views from blocked users.
      if (!(await this.ensureChapterAccess(res, studentId, lesson.chapter))) {
        return;
      }

      const price =
        lesson.chapter.price !== null ? Number(lesson.chapter.price) : null;
      const progressionCtx = await loadChapterProgressionContext(
        studentId,
        lesson.chapter.id,
        price,
      );
      const lessonIndex = progressionCtx.lessons.findIndex(
        (l) => l.id === lessonId,
      );
      if (lessonIndex >= 0) {
        const access = evaluateChapterLessons(progressionCtx)[lessonIndex]!;
        assertLessonUnlocked(access, {
          studentId,
          chapterId: lesson.chapter.id,
        });
      }

      await prisma.lesson.update({
        where: { id: lessonId },
        data: { viewCount: { increment: 1 } },
      });

      res.status(200).json(okResponse("View count incremented"));
    },
  );

  /**
   * Shared access gate for student lesson endpoints. Free chapters
   * (price null or <= 0) are open to any student; paid chapters require an
   * ACTIVE enrollment. On denial, writes the 403 NOT_ENROLLED response and
   * returns false so the caller can bail out.
   */
  private async ensureChapterAccess(
    res: Response,
    studentId: string,
    chapter: { id: string; price: Prisma.Decimal | null },
  ): Promise<boolean> {
    const price = chapter.price !== null ? Number(chapter.price) : null;

    if (price === null || price <= 0) {
      return true;
    }

    const enrollment = await prisma.enrollment.findFirst({
      where: { studentId, chapterId: chapter.id, status: "ACTIVE" },
      select: { id: true },
    });

    if (enrollment) {
      return true;
    }

    res.status(403).json({
      success: false,
      code: "NOT_ENROLLED",
      message: "You need to enroll in this chapter to access this lesson.",
    });
    return false;
  }
}
