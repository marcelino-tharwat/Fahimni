import { prisma as defaultPrisma } from "../../config/database.js";

/**
 * Teacher-facing curriculum eligibility for the AI quiz generator. Reports which
 * stages / chapters / lessons have usable indexed content so the frontend can
 * disable ineligible options and warn about weak lessons *before* a request is
 * ever sent. Ownership is scoped to the authenticated teacher (chapter.teacherId).
 *
 * "Usable content" == at least one indexed RAG chunk (content_chunks) for the
 * lesson — the exact precondition the generator enforces at runtime.
 */

export interface GeneratorSourceLesson {
  id: string;
  title: string;
  hasUsableContent: boolean;
}

export interface GeneratorSourceChapter {
  id: string;
  name: string;
  hasUsableContent: boolean;
  totalLessons: number;
  eligibleLessons: number;
  lessons: GeneratorSourceLesson[];
}

export interface GeneratorSourceStage {
  id: string;
  name: string;
  canGenerateFullCurriculum: boolean;
  totalChapters: number;
  eligibleChapters: number;
  totalLessons: number;
  eligibleLessons: number;
  chapters: GeneratorSourceChapter[];
}

export interface GeneratorSourcesResult {
  canGenerateFullCurriculum: boolean;
  totalStages: number;
  totalChapters: number;
  eligibleChapters: number;
  totalLessons: number;
  eligibleLessons: number;
  warnings: string[];
  stages: GeneratorSourceStage[];
}

type PrismaLike = Pick<typeof defaultPrisma, "stage" | "$queryRaw">;

/**
 * Build the eligibility snapshot for a teacher. When `stageId` is provided the
 * result is limited to that (active) stage; otherwise all active stages with
 * the teacher's chapters are returned. Lessons/chapters are always included so
 * the frontend can drive the per-lesson / per-chapter allocation UI and its
 * content warnings.
 */
export async function getGeneratorSources(
  teacherId: string,
  stageId: string | undefined,
  db: PrismaLike = defaultPrisma,
): Promise<GeneratorSourcesResult> {
  const stages = await db.stage.findMany({
    where: {
      deletedAt: null,
      isActive: true,
      ...(stageId ? { id: stageId } : {
        chapters: { some: { teacherId, deletedAt: null } },
      }),
    },
    select: {
      id: true,
      name: true,
      chapters: {
        where: { teacherId, deletedAt: null },
        select: {
          id: true,
          name: true,
          lessons: {
            where: { deletedAt: null },
            select: { id: true, title: true },
            orderBy: { sortOrder: "asc" },
          },
        },
        orderBy: { sortOrder: "asc" },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  // One grouped query for every lesson's chunk presence across all stages.
  const lessonIds = stages.flatMap((s) =>
    s.chapters.flatMap((c) => c.lessons.map((l) => l.id)),
  );
  const withContent = await lessonsWithContent(lessonIds, db);

  let totalChapters = 0;
  let eligibleChapters = 0;
  let totalLessons = 0;
  let eligibleLessons = 0;

  const stageResults: GeneratorSourceStage[] = stages.map((stage) => {
    let stageEligibleChapters = 0;
    let stageTotalLessons = 0;
    let stageEligibleLessons = 0;

    const chapters: GeneratorSourceChapter[] = stage.chapters.map((chapter) => {
      const lessons: GeneratorSourceLesson[] = chapter.lessons.map((lesson) => ({
        id: lesson.id,
        title: lesson.title,
        hasUsableContent: withContent.has(lesson.id),
      }));
      const chapterEligibleLessons = lessons.filter(
        (l) => l.hasUsableContent,
      ).length;
      const chapterHasContent = chapterEligibleLessons > 0;

      stageTotalLessons += lessons.length;
      stageEligibleLessons += chapterEligibleLessons;
      if (chapterHasContent) stageEligibleChapters += 1;

      return {
        id: chapter.id,
        name: chapter.name,
        hasUsableContent: chapterHasContent,
        totalLessons: lessons.length,
        eligibleLessons: chapterEligibleLessons,
        lessons,
      };
    });

    totalChapters += chapters.length;
    eligibleChapters += stageEligibleChapters;
    totalLessons += stageTotalLessons;
    eligibleLessons += stageEligibleLessons;

    return {
      id: stage.id,
      name: stage.name,
      canGenerateFullCurriculum: stageEligibleChapters > 0,
      totalChapters: chapters.length,
      eligibleChapters: stageEligibleChapters,
      totalLessons: stageTotalLessons,
      eligibleLessons: stageEligibleLessons,
      chapters,
    };
  });

  const warnings: string[] = [];
  if (totalLessons > 0 && eligibleLessons < totalLessons) {
    warnings.push("بعض الدروس لا تحتوي على محتوى كافٍ لتوليد أسئلة.");
  }
  if (eligibleLessons === 0) {
    warnings.push(
      "لا يوجد محتوى مفهرس بعد. الرجاء فهرسة دروسك قبل توليد الاختبارات.",
    );
  }

  return {
    canGenerateFullCurriculum: eligibleChapters > 0,
    totalStages: stageResults.length,
    totalChapters,
    eligibleChapters,
    totalLessons,
    eligibleLessons,
    warnings,
    stages: stageResults,
  };
}

/** Returns the subset of lessonIds that have at least one indexed chunk. */
async function lessonsWithContent(
  lessonIds: string[],
  db: PrismaLike,
): Promise<Set<string>> {
  if (lessonIds.length === 0) {
    return new Set();
  }
  const rows = await db.$queryRaw<Array<{ lessonId: string }>>`
    SELECT DISTINCT "lessonId"
    FROM content_chunks
    WHERE "lessonId" = ANY(${lessonIds}::text[])
  `;
  return new Set(rows.map((r) => r.lessonId));
}
