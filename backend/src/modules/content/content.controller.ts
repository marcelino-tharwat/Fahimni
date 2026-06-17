import type { Request, Response, NextFunction } from "express";
import { prisma } from "../../config/database.js";
import { asyncHandler } from "../../shared/utils/asyncHandler.js";
import { AppError } from "../../shared/utils/AppError.js";
import type { ContentTreeResponse } from "./content.types.js";

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
}
