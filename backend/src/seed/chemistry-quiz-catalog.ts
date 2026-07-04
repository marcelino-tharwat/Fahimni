/**
 * Quiz seed definitions for Chemistry dev data — chapter, optional lesson-linked,
 * required progression gate, and multi-lesson optional quizzes.
 */
import type { Prisma } from "../generated/prisma/client.js";
import { TF_FALSE, TF_OPTIONS, TF_TRUE } from "../modules/quizzes/quiz-generation.mapping.js";
import { seedId } from "./chemistry-ids.js";
import { buildQuestions } from "./chemistry-seed.fixtures.js";
import {
  CHEMISTRY_CHAPTER_DEFS,
  CHEMISTRY_MULTI_LESSON_QUIZ_ID,
  CHEMISTRY_OPTIONAL_LESSON_QUIZ_ID,
  CHEMISTRY_REQUIRED_GATE_QUIZ_ID,
  chemistryLessonId,
} from "./chemistry-lesson-catalog.js";

export const CHEMISTRY_CHAPTER_QUIZ_IDS = CHEMISTRY_CHAPTER_DEFS.map((_c, ci) =>
  seedId(`quiz-ch${ci + 1}`),
);

export const CHEMISTRY_EXTRA_QUIZ_IDS = [
  CHEMISTRY_OPTIONAL_LESSON_QUIZ_ID,
  CHEMISTRY_REQUIRED_GATE_QUIZ_ID,
  CHEMISTRY_MULTI_LESSON_QUIZ_ID,
] as const;

export const ALL_CHEMISTRY_QUIZ_IDS = [
  ...CHEMISTRY_CHAPTER_QUIZ_IDS,
  ...CHEMISTRY_EXTRA_QUIZ_IDS,
];

export interface ChemistryQuizQuestionSeed {
  id: string;
  quizId: string;
  type: "MCQ" | "TRUE_FALSE" | "ESSAY";
  text: string;
  options: Prisma.InputJsonValue;
  correctAnswer: string | null;
  explanation: string;
  sortOrder: number;
  points: number;
}

export interface ChemistryQuizSeed {
  id: string;
  title: string;
  description: string;
  chapterId: string;
  contentScope: "CHAPTER" | "SELECTED_LESSONS";
  status: "PUBLISHED" | "DRAFT";
  durationMinutes: number;
  passingScore: number;
  linkedLessonIds: string[];
  questions: ChemistryQuizQuestionSeed[];
}

function gateQuestions(quizId: string): Prisma.QuestionCreateManyInput[] {
  return [
    {
      id: seedId("quiz-ch1-gate-question-1"),
      quizId,
      type: "TRUE_FALSE",
      text: "يجب إكمال اختبار البوابة للانتقال إلى الدرس التالي في الفصل الأول.",
      options: [...TF_OPTIONS] as unknown as Prisma.InputJsonValue,
      correctAnswer: TF_TRUE,
      explanation: "هذا اختبار تجريبي لبوابة التقدم في بيانات التطوير.",
      sortOrder: 1,
      points: 10,
    },
  ];
}

function optionalLessonQuestions(quizId: string): Prisma.QuestionCreateManyInput[] {
  return [
    {
      id: seedId("quiz-ch1-optional-question-1"),
      quizId,
      type: "TRUE_FALSE",
      text: "العناصر الانتقالية تكوّن أيونات ملوّنة في المحاليل المائية.",
      options: [...TF_OPTIONS] as unknown as Prisma.InputJsonValue,
      correctAnswer: TF_TRUE,
      explanation: "بسبب انتقال الإلكترونات بين مستويات d.",
      sortOrder: 1,
      points: 5,
    },
  ];
}

function multiLessonQuestions(quizId: string): Prisma.QuestionCreateManyInput[] {
  return [
    {
      id: seedId("quiz-ch2-multi-question-1"),
      quizId,
      type: "TRUE_FALSE",
      text: "المعايرة طريقة في التحليل الكمي.",
      options: [...TF_OPTIONS] as unknown as Prisma.InputJsonValue,
      correctAnswer: TF_TRUE,
      explanation: "تُستخدم لتحديد تركيز محلول مجهول.",
      sortOrder: 1,
      points: 5,
    },
  ];
}

export function buildChemistryQuizCatalog(): ChemistryQuizSeed[] {
  const quizzes: ChemistryQuizSeed[] = [];

  for (let ci = 0; ci < CHEMISTRY_CHAPTER_DEFS.length; ci++) {
    const chapter = CHEMISTRY_CHAPTER_DEFS[ci]!;
    const quizId = CHEMISTRY_CHAPTER_QUIZ_IDS[ci]!;
    const questions = buildQuestions(quizId, ci);
    quizzes.push({
      id: quizId,
      title: `اختبار ${chapter.name} (تجريبي)`,
      description: `أسئلة تجريبية على وحدة ${chapter.name}.`,
      chapterId: chapter.id,
      contentScope: "CHAPTER",
      status: ci === 4 ? "DRAFT" : "PUBLISHED",
      durationMinutes: 30,
      passingScore: 50,
      linkedLessonIds: [],
      questions,
    });
  }

  const ch1Id = CHEMISTRY_CHAPTER_DEFS[0]!.id;
  const ch1L1 = chemistryLessonId(0, 0);

  quizzes.push({
    id: CHEMISTRY_OPTIONAL_LESSON_QUIZ_ID,
    title: "تدريب اختياري — خواص العناصر الانتقالية",
    description: "اختبار تدريبي مرتبط بدرس واحد ولا يمنع الانتقال للدرس التالي.",
    chapterId: ch1Id,
    contentScope: "SELECTED_LESSONS",
    status: "PUBLISHED",
    durationMinutes: 15,
    passingScore: 50,
    linkedLessonIds: [ch1L1],
      questions: optionalLessonQuestions(
        CHEMISTRY_OPTIONAL_LESSON_QUIZ_ID,
      ) as ChemistryQuizQuestionSeed[],
  });

  quizzes.push({
    id: CHEMISTRY_REQUIRED_GATE_QUIZ_ID,
    title: "اختبار بوابة — العناصر الانتقالية",
    description: "اختبار مطلوب لفتح الدرس التالي بعد إكمال الدرس الأول.",
    chapterId: ch1Id,
    contentScope: "CHAPTER",
    status: "PUBLISHED",
    durationMinutes: 20,
    passingScore: 50,
    linkedLessonIds: [],
      questions: gateQuestions(
        CHEMISTRY_REQUIRED_GATE_QUIZ_ID,
      ) as ChemistryQuizQuestionSeed[],
  });

  const ch2Id = CHEMISTRY_CHAPTER_DEFS[1]!.id;
  quizzes.push({
    id: CHEMISTRY_MULTI_LESSON_QUIZ_ID,
    title: "مراجعة التحليل الكيميائي — درسان",
    description: "اختبار اختياري مرتبط بدرسين في الفصل الثاني.",
    chapterId: ch2Id,
    contentScope: "SELECTED_LESSONS",
    status: "PUBLISHED",
    durationMinutes: 20,
    passingScore: 50,
    linkedLessonIds: [chemistryLessonId(1, 0), chemistryLessonId(1, 1)],
      questions: multiLessonQuestions(
        CHEMISTRY_MULTI_LESSON_QUIZ_ID,
      ) as ChemistryQuizQuestionSeed[],
  });

  return quizzes;
}

/** QuizLesson rows derived from catalog (optional + multi-lesson only). */
export function buildQuizLessonLinks(): Array<{ quizId: string; lessonId: string }> {
  return buildChemistryQuizCatalog().flatMap((q) =>
    q.contentScope === "SELECTED_LESSONS"
      ? q.linkedLessonIds.map((lessonId) => ({ quizId: q.id, lessonId }))
      : [],
  );
}

export function chemistryGateQuestionMeta(): {
  questionId: string;
  correctAnswer: string;
  wrongAnswer: string;
} {
  return {
    questionId: seedId("quiz-ch1-gate-question-1"),
    correctAnswer: TF_TRUE,
    wrongAnswer: TF_FALSE,
  };
}
