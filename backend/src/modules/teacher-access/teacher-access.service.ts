import { prisma } from "../../config/database.js";
import { AppError } from "../../shared/utils/AppError.js";

/**
 * Verify a student has at least one active enrollment in a chapter whose
 * stage belongs to the given teacher. Used to scope student visibility
 * for teacher-facing endpoints.
 */
export async function assertStudentVisibleToTeacher(
  studentId: string,
  teacherId: string,
): Promise<void> {
  const enrollment = await prisma.enrollment.findFirst({
    where: {
      studentId,
      status: "ACTIVE",
      chapter: {
        deletedAt: null,
        stage: { teacherId, deletedAt: null },
      },
    },
    select: { id: true },
  });

  if (!enrollment) {
    throw new AppError("Student not found", 404);
  }
}

/**
 * Verify a chapter belongs to a stage owned by the given teacher.
 * Returns the chapter record if found.
 */
export async function assertChapterOwnedByTeacher(
  chapterId: string,
  teacherId: string,
) {
  const chapter = await prisma.chapter.findFirst({
    where: {
      id: chapterId,
      deletedAt: null,
      stage: { teacherId, deletedAt: null },
    },
    select: { id: true, stageId: true },
  });

  if (!chapter) {
    throw new AppError("Chapter not found", 404);
  }

  return chapter;
}

/**
 * Verify a lesson belongs to a chapter whose stage is owned by the given
 * teacher (lesson → chapter → stage → teacherId). Returns the lesson
 * record if found.
 */
export async function assertLessonOwnedByTeacher(
  lessonId: string,
  teacherId: string,
) {
  const lesson = await prisma.lesson.findFirst({
    where: {
      id: lessonId,
      deletedAt: null,
      chapter: {
        deletedAt: null,
        stage: { teacherId, deletedAt: null },
      },
    },
    select: { id: true, chapterId: true },
  });

  if (!lesson) {
    throw new AppError("Lesson not found", 404);
  }

  return lesson;
}
