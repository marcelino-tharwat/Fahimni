import type { PrismaClient } from "../../src/generated/prisma/client.js";
import { seedId } from "./ids.js";
import { randomChoice } from "./helpers.js";
import { CHAPTER_TEMPLATES } from "./data/egyptian-secondary.js";
import { SCALE } from "./constants.js";

export interface ContentSeedResult {
  stages: { id: string; name: string; sortOrder: number }[];
  chapters: { id: string; name: string; stageId: string; teacherId: string; sortOrder: number }[];
  lessons: { id: string; title: string; chapterId: string; sortOrder: number }[];
}

const STAGE_DATA = [
  { name: "الصف الأول الثانوي", nameEn: "First Secondary", sortOrder: 1 },
  { name: "الصف الثاني الثانوي", nameEn: "Second Secondary", sortOrder: 2 },
  { name: "الصف الثالث الثانوي", nameEn: "Third Secondary", sortOrder: 3 },
];

export async function seedContent(
  prisma: PrismaClient,
  teacherIds: string[],
): Promise<ContentSeedResult> {
  // ── Stages ──
  const stagesData = STAGE_DATA.map((s, i) => ({
    id: seedId(`stage-${i}`),
    name: s.name,
    nameAr: s.name,
    nameEn: s.nameEn,
    description: `المرحلة الثانوية العامة — ${s.name}.`,
    descriptionAr: `المرحلة الثانوية العامة — ${s.name}.`,
    descriptionEn: `Egyptian general secondary education — ${s.nameEn}.`,
    sortOrder: s.sortOrder,
  }));

  await prisma.stage.createMany({ data: stagesData, skipDuplicates: true });
  const stages = await prisma.stage.findMany({ orderBy: { sortOrder: "asc" } });

  // ── Chapters + Lessons ──
  const chaptersData: {
    id: string; name: string; description: string; sortOrder: number;
    stageId: string; teacherId: string; price: number | null;
    term: "FIRST_TERM" | "SECOND_TERM"; imageUrl: string;
  }[] = [];
  const lessonsData: {
    id: string; title: string; description: string; durationMinutes: number;
    sortOrder: number; chapterId: string;
  }[] = [];

  const chaptersPerStage = Math.ceil(CHAPTER_TEMPLATES.length / stages.length);
  const stageChapterCounters = [0, 0, 0];

  for (const tpl of CHAPTER_TEMPLATES) {
    const stageId = stages[tpl.stageIndex]!.id;
    const sortIndex = stageChapterCounters[tpl.stageIndex]++;
    const teacherId = teacherIds[sortIndex % teacherIds.length]!;
    const chapterId = seedId(`chapter-${tpl.stageIndex}-${sortIndex}`);

    chaptersData.push({
      id: chapterId,
      name: tpl.name,
      description: tpl.description,
      sortOrder: sortIndex + 1,
      stageId,
      teacherId,
      price: tpl.price,
      term: tpl.term,
      imageUrl: `https://placehold.co/640x360?text=${encodeURIComponent(tpl.name)}`,
    });

    for (let li = 0; li < tpl.lessons.length; li++) {
      const l = tpl.lessons[li]!;
      lessonsData.push({
        id: seedId(`lesson-${tpl.stageIndex}-${sortIndex}-${li}`),
        title: l.title,
        description: l.description,
        durationMinutes: l.durationMinutes,
        sortOrder: li + 1,
        chapterId,
      });
    }
  }

  await prisma.chapter.createMany({ data: chaptersData, skipDuplicates: true });
  await prisma.lesson.createMany({ data: lessonsData, skipDuplicates: true });

  const chapters = await prisma.chapter.findMany({
    select: { id: true, name: true, stageId: true, teacherId: true, sortOrder: true },
    orderBy: [{ stageId: "asc" }, { sortOrder: "asc" }],
  });
  const lessons = await prisma.lesson.findMany({
    select: { id: true, title: true, chapterId: true, sortOrder: true },
    orderBy: [{ chapterId: "asc" }, { sortOrder: "asc" }],
  });

  return { stages, chapters, lessons };
}
