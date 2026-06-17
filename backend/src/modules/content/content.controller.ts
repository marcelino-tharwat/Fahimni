import type { Request, Response, NextFunction } from "express";
import { prisma } from "../../config/database.js";
import { asyncHandler } from "../../shared/utils/asyncHandler.js";
import { AppError } from "../../shared/utils/AppError.js";
import { okResponse } from "../../shared/utils/apiResponse.js";
import { logger } from "../../config/logger.js";
import type {
  ContentTreeResponse,
  StudentContentTreeResponse,
  StudentChapterNode,
  EnrollmentStatus,
  MyCourseResponse,
} from "./content.types.js";

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

      const stages = await prisma.stage.findMany({
        where: { deletedAt: null },
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

      const result: StudentContentTreeResponse[] = stages.map((stage) => ({
        stage: {
          id: stage.id,
          name: stage.name,
          sortOrder: stage.sortOrder,
          chapterCount: stage.chapters.length,
        },
        chapters: stage.chapters.map((chapter) => {
          let enrollmentStatus: EnrollmentStatus;
          const price = chapter.price ? Number(chapter.price) : null;

          if (price === null || price === 0) {
            enrollmentStatus = "free";
          } else if (enrolledSet.has(chapter.id)) {
            enrollmentStatus = "purchased";
          } else {
            enrollmentStatus = "locked";
          }

          const studentChapter: StudentChapterNode = {
            id: chapter.id,
            name: chapter.name,
            description: chapter.description,
            sortOrder: chapter.sortOrder,
            price,
            lessonCount: chapter.lessons.length,
            enrollmentStatus,
          };

          return {
            chapter: studentChapter,
            lessons: chapter.lessons.map((lesson) => ({
              id: lesson.id,
              title: lesson.title,
              sortOrder: lesson.sortOrder,
            })),
          };
        }),
      }));

      res.json(result);
    },
  );

  getMyCourses = asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
      const studentId = req.user!.id;

      const enrollments = await prisma.enrollment.findMany({
        where: { studentId, status: "ACTIVE" },
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
}
