import { prisma } from "../../config/database.js";
import { AppError } from "../../shared/utils/AppError.js";

/**
 * Verify a stage exists, is not deleted, and is active.
 * Stages are admin-managed — no teacher ownership check.
 * Returns the stage id if found; throws 404 otherwise.
 */
export async function assertStageExistsAndActive(
  stageId: string,
) {
  const stage = await prisma.stage.findFirst({
    where: { id: stageId, deletedAt: null, isActive: true },
    select: { id: true },
  });

  if (!stage) {
    throw new AppError("Stage not found or inactive", 404);
  }

  return stage;
}

/**
 * Verify a student has at least one active enrollment in a chapter whose
 * teacher matches the given teacherId. Used to scope student visibility
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
        teacherId,
      },
    },
    select: { id: true },
  });

  if (!enrollment) {
    throw new AppError("Student not found", 404);
  }
}

/**
 * Verify a chapter belongs to the given teacher (chapter.teacherId === teacherId).
 * Returns the chapter record if found.
 */
export async function assertChapterOwnedByTeacher(
  chapterId: string,
  teacherId: string,
) {
  const chapter = await prisma.chapter.findFirst({
    where: {
      id: chapterId,
      teacherId,
      deletedAt: null,
    },
    select: { id: true, stageId: true },
  });

  if (!chapter) {
    throw new AppError("Chapter not found", 404);
  }

  return chapter;
}

/**
 * Verify a lesson belongs to a chapter owned by the given teacher
 * (lesson → chapter → teacherId). Returns the lesson record if found.
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
        teacherId,
      },
    },
    select: { id: true, chapterId: true },
  });

  if (!lesson) {
    throw new AppError("Lesson not found", 404);
  }

  return lesson;
}

/**
 * Teacher visibility filter for student discovery/browse contexts.
 *
 * A teacher is discoverable only when:
 * - user.status = ACTIVE
 * - user.role = OPERATION
 * - user.teacherApprovalState = APPROVED
 *
 * This filter is used by All Content / browse endpoints to hide content
 * owned by banned, inactive, or unapproved teachers from student discovery.
 * It MUST NOT be applied to My Courses / enrolled content endpoints.
 *
 * @param chapterId - The chapter to check ownership of
 * @returns Whether the chapter's teacher is visible for discovery
 */
export async function isTeacherVisibleForDiscovery(
  chapterId: string,
): Promise<boolean> {
  const chapter = await prisma.chapter.findUnique({
    where: { id: chapterId },
    select: {
      teacher: {
        select: {
          status: true,
          role: true,
          teacherApprovalState: true,
        },
      },
    },
  });

  if (!chapter) return false;

  const teacher = chapter.teacher;
  return (
    teacher.role === "OPERATION" &&
    teacher.status === "ACTIVE" &&
    teacher.teacherApprovalState === "APPROVED"
  );
}
