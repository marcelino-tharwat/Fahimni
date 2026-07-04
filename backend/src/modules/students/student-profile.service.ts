import { prisma } from "../../config/database.js";
import { AppError } from "../../shared/utils/AppError.js";
import { listStudentAccessibleChapters } from "../progression/student-chapter-access.js";
import type {
  StudentProfileOverviewDTO,
  ProfileAchievementDTO,
} from "./student-profile.types.js";

/** First visible character of a name, falling back to the email initial, then '?'. */
function deriveInitial(fullName: string, email: string | null): string {
  const fromName = Array.from(fullName.trim())[0];
  if (fromName) return fromName;
  const fromEmail = Array.from((email ?? "").trim())[0];
  return fromEmail ?? "?";
}

/**
 * Aggregate the authenticated student's profile overview from existing tables
 * only. The student id is always the caller's authenticated user id — this
 * service never accepts an id from the request payload.
 *
 * Data sources:
 *  - identity: User (+ StudentProfile.stage)
 *  - completed / total lessons: LessonProgress over accessible-chapter lessons
 *  - quizzes / average grade: QuizAttempt (COMPLETED submitted, GRADED scored)
 *  - courses & subscriptions: Enrollment (+ Chapter/Stage/Lesson)
 *  - achievements: derived on read from the above (no achievement table exists)
 */
export async function getStudentProfileOverview(
  studentId: string,
): Promise<StudentProfileOverviewDTO> {
  const user = await prisma.user.findUnique({
    where: { id: studentId },
    select: {
      id: true,
      fullName: true,
      email: true,
      mobile: true,
      role: true,
      status: true,
      createdAt: true,
      studentProfile: { select: { stage: { select: { name: true } } } },
    },
  });
  if (!user) {
    throw new AppError("Student not found", 404);
  }

  // Accessible chapters = free chapters + ACTIVE enrollments in the student's
  // stage (reuses the platform-wide lesson access policy).
  const accessibleChapters = await listStudentAccessibleChapters(studentId);
  const accessibleChapterIds = accessibleChapters.map((c) => c.id);

  const accessibleLessons = accessibleChapterIds.length
    ? await prisma.lesson.findMany({
        where: { chapterId: { in: accessibleChapterIds }, deletedAt: null },
        select: { id: true },
      })
    : [];
  const accessibleLessonIds = accessibleLessons.map((l) => l.id);
  const totalLessons = accessibleLessonIds.length;

  const completedProgress = accessibleLessonIds.length
    ? await prisma.lessonProgress.findMany({
        where: {
          studentId,
          lessonId: { in: accessibleLessonIds },
          completed: true,
        },
        select: { lessonId: true, updatedAt: true },
        orderBy: { updatedAt: "asc" },
      })
    : [];
  const completedLessonIds = new Set(completedProgress.map((p) => p.lessonId));
  const completedLessons = completedLessonIds.size;
  const overallProgressPercent =
    totalLessons > 0
      ? Math.round((completedLessons / totalLessons) * 100)
      : 0;

  // Submitted attempts (one per quiz via the unique [quizId, studentId]
  // constraint). COMPLETED = awaiting grade, GRADED = scored. Average grade is
  // computed only over GRADED attempts that carry a numeric score.
  const attempts = await prisma.quizAttempt.findMany({
    where: { studentId, status: { in: ["COMPLETED", "GRADED"] } },
    select: {
      status: true,
      score: true,
      totalPoints: true,
      completedAt: true,
    },
    orderBy: { completedAt: "asc" },
  });
  const completedQuizzes = attempts.length;
  const gradedScored = attempts.filter(
    (a) => a.status === "GRADED" && a.score !== null && a.totalPoints > 0,
  );
  const averageGrade = gradedScored.length
    ? Math.round(
        gradedScored.reduce(
          (sum, a) => sum + (a.score! / a.totalPoints) * 100,
          0,
        ) / gradedScored.length,
      )
    : null;
  const perfectAttempt = gradedScored.find(
    (a) => a.score! / a.totalPoints >= 1,
  );
  const firstQuizAt =
    attempts.find((a) => a.completedAt !== null)?.completedAt ?? null;

  // Enrollments drive both the courses list (ACTIVE, with per-chapter progress)
  // and the subscription history (all statuses, newest first).
  const enrollments = await prisma.enrollment.findMany({
    where: { studentId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      status: true,
      price: true,
      paymentMethod: true,
      enrolledAt: true,
      chapter: {
        select: {
          id: true,
          name: true,
          stage: { select: { name: true } },
          lessons: { where: { deletedAt: null }, select: { id: true } },
        },
      },
    },
  });

  const courses = enrollments
    .filter((e) => e.status === "ACTIVE")
    .map((e) => {
      const chapterTotal = e.chapter.lessons.length;
      const chapterCompleted = e.chapter.lessons.filter((l) =>
        completedLessonIds.has(l.id),
      ).length;
      return {
        id: e.chapter.id,
        title: e.chapter.name,
        subtitle: e.chapter.stage?.name ?? null,
        status: e.status,
        planType: e.paymentMethod,
        progressPercent:
          chapterTotal > 0
            ? Math.round((chapterCompleted / chapterTotal) * 100)
            : 0,
        completedLessons: chapterCompleted,
        totalLessons: chapterTotal,
      };
    });

  const subscriptions = enrollments.map((e) => ({
    id: e.id,
    title: e.chapter.name,
    status: e.status,
    planType: e.paymentMethod,
    price: Number(e.price),
    startedAt: e.enrolledAt,
  }));

  const achievements: ProfileAchievementDTO[] = [
    {
      id: "first_lesson",
      unlocked: completedLessons >= 1,
      unlockedAt: completedProgress[0]?.updatedAt ?? null,
    },
    {
      id: "ten_lessons",
      unlocked: completedLessons >= 10,
      unlockedAt: completedProgress[9]?.updatedAt ?? null,
    },
    {
      id: "first_quiz",
      unlocked: completedQuizzes >= 1,
      unlockedAt: firstQuizAt,
    },
    {
      id: "twenty_five_lessons",
      unlocked: completedLessons >= 25,
      unlockedAt: completedProgress[24]?.updatedAt ?? null,
    },
    {
      id: "perfect_score",
      unlocked: perfectAttempt !== undefined,
      unlockedAt: perfectAttempt?.completedAt ?? null,
    },
  ];

  return {
    student: {
      id: user.id,
      fullName: user.fullName,
      avatarInitial: deriveInitial(user.fullName, user.email),
      role: user.role,
      status: user.status,
      email: user.email,
      phone: user.mobile ?? null,
      joinedAt: user.createdAt,
      stageName: user.studentProfile?.stage?.name ?? null,
    },
    academicProgress: {
      completedLessons,
      totalLessons,
      completedQuizzes,
      averageGrade,
      overallProgressPercent,
    },
    courses,
    subscriptions,
    achievements,
  };
}
