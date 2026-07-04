/**
 * Central deterministic catalog for Chemistry dev seed lessons.
 * Single source of truth for titles, rich descriptions, video URLs, and quiz links.
 */
import { seedId } from "./chemistry-ids.js";
import { CHEMISTRY_RAG_CONTENT } from "./chemistry-rag-content.js";

export interface ChemistryChapterDef {
  id: string;
  name: string;
  lessonTitles: readonly string[];
}

export interface SeedMaterialDefinition {
  id: string;
  displayName: string;
  filePath: string;
  mimeType: string;
  fileSize: number;
}

export interface SeedLessonDefinition {
  id: string;
  chapterId: string;
  chapterIndex: number;
  lessonIndex: number;
  title: string;
  description: string;
  durationMinutes: number;
  youtubeUrl: string;
  sortOrder: number;
  requiredQuizId: string | null;
  /** Optional lesson-linked quiz (QuizLesson); does not block progression by itself. */
  optionalQuizId: string | null;
}

/** Public-domain / educational YouTube placeholders — one per chapter theme. */
const YOUTUBE_BY_CHAPTER: readonly string[] = [
  "https://www.youtube.com/watch?v=FL_hlIgNOt0",
  "https://www.youtube.com/watch?v=2qB_0G0B0b0",
  "https://www.youtube.com/watch?v=7D_jsF8i0pA",
  "https://www.youtube.com/watch?v=9k6r5Gk6T9A",
  "https://www.youtube.com/watch?v=Bk3udS767J8",
];

export const CHEMISTRY_CHAPTER_DEFS: readonly ChemistryChapterDef[] = [
  {
    id: seedId("chapter-01"),
    name: "العناصر الانتقالية",
    lessonTitles: ["خواص العناصر الانتقالية", "حالات التأكسد", "الحديد وسبائكه"],
  },
  {
    id: seedId("chapter-02"),
    name: "التحليل الكيميائي",
    lessonTitles: ["التحليل النوعي", "التحليل الكمي", "المعايرة والحسابات"],
  },
  {
    id: seedId("chapter-03"),
    name: "الاتزان الكيميائي",
    lessonTitles: [
      "مفهوم الاتزان الديناميكي",
      "ثابت الاتزان",
      "العوامل المؤثرة على الاتزان",
    ],
  },
  {
    id: seedId("chapter-04"),
    name: "الكيمياء الكهربية",
    lessonTitles: ["الخلايا الجلفانية", "التحليل الكهربي", "قوانين فاراداي"],
  },
  {
    id: seedId("chapter-05"),
    name: "الكيمياء العضوية",
    lessonTitles: ["الهيدروكربونات", "الكحولات والأحماض", "البوليمرات"],
  },
] as const;

export const CHEMISTRY_OPTIONAL_LESSON_QUIZ_ID = seedId("quiz-ch1-lesson-optional");
export const CHEMISTRY_REQUIRED_GATE_QUIZ_ID = seedId("quiz-ch1-required-gate");
export const CHEMISTRY_MULTI_LESSON_QUIZ_ID = seedId("quiz-ch2-multi-lesson");

export function chemistryLessonId(chapterIndex: number, lessonIndex: number): string {
  return seedId(
    `lesson-ch${chapterIndex + 1}-${String(lessonIndex + 1).padStart(2, "0")}`,
  );
}

function objectivesForLesson(chapterName: string, title: string): string[] {
  return [
    `تعريف مفاهيم ${title} ضمن ${chapterName}.`,
    `ربط ${title} بالتطبيقات العملية في منهج الكيمياء للثانوية العامة.`,
    `حل أمثلة ومسائل تطبيقية على ${title}.`,
    `تمييز ${title} عن المفاهيم المرتبطة في نفس الفصل.`,
  ];
}

function summaryForLesson(title: string, chapterName: string): string {
  return `يتناول هذا الدرس ${title} في ${chapterName} بشرح منظم يساعد الطالب على الفهم والمراجعة قبل الاختبارات.`;
}

export function formatLessonDescription(
  chapterName: string,
  title: string,
  ragParagraphs: string[],
): string {
  const objectives = objectivesForLesson(chapterName, title);
  const summary = summaryForLesson(title, chapterName);
  return [
    `ملخص الدرس: ${summary}`,
    "",
    "أهداف التعلم:",
    ...objectives.map((o, i) => `${i + 1}. ${o}`),
    "",
    "محتوى الدرس:",
    ...ragParagraphs,
    "",
    `خلاصة: ${summary}`,
  ].join("\n");
}

export function buildChemistryLessonShellCatalog(): SeedLessonDefinition[] {
  const lessons: SeedLessonDefinition[] = [];

  for (let ci = 0; ci < CHEMISTRY_CHAPTER_DEFS.length; ci++) {
    const chapter = CHEMISTRY_CHAPTER_DEFS[ci]!;

    for (let li = 0; li < chapter.lessonTitles.length; li++) {
      lessons.push({
        id: chemistryLessonId(ci, li),
        chapterId: chapter.id,
        chapterIndex: ci,
        lessonIndex: li,
        title: chapter.lessonTitles[li]!,
        description: "",
        durationMinutes: 0,
        youtubeUrl: "",
        sortOrder: li + 1,
        requiredQuizId: null,
        optionalQuizId: null,
      });
    }
  }

  return lessons;
}

export function buildChemistryLessonCatalog(): SeedLessonDefinition[] {
  const lessons: SeedLessonDefinition[] = [];

  for (let ci = 0; ci < CHEMISTRY_CHAPTER_DEFS.length; ci++) {
    const chapter = CHEMISTRY_CHAPTER_DEFS[ci]!;
    const youtubeUrl = YOUTUBE_BY_CHAPTER[ci] ?? YOUTUBE_BY_CHAPTER[0]!;

    for (let li = 0; li < chapter.lessonTitles.length; li++) {
      const id = chemistryLessonId(ci, li);
      const title = chapter.lessonTitles[li]!;
      const rag = CHEMISTRY_RAG_CONTENT[id];
      if (!rag) {
        throw new Error(`Missing RAG content for lesson ${id}`);
      }
      const paragraphs = rag.split("\n\n").filter(Boolean);

      let requiredQuizId: string | null = null;
      let optionalQuizId: string | null = null;

      // Chapter 1 lesson 1: optional placement + required progression gate (separate quizzes).
      if (ci === 0 && li === 0) {
        optionalQuizId = CHEMISTRY_OPTIONAL_LESSON_QUIZ_ID;
        requiredQuizId = CHEMISTRY_REQUIRED_GATE_QUIZ_ID;
      }

      lessons.push({
        id,
        chapterId: chapter.id,
        chapterIndex: ci,
        lessonIndex: li,
        title,
        description: formatLessonDescription(chapter.name, title, paragraphs),
        durationMinutes: 18 + li * 4 + ci * 2,
        youtubeUrl,
        sortOrder: li + 1,
        requiredQuizId,
        optionalQuizId,
      });
    }
  }

  return lessons;
}

export function allChemistryLessonIds(): string[] {
  return buildChemistryLessonCatalog().map((l) => l.id);
}

export function allChemistryChapterIds(): string[] {
  return CHEMISTRY_CHAPTER_DEFS.map((c) => c.id);
}
