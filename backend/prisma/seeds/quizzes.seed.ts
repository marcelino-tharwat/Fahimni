import type { PrismaClient } from "../../src/generated/prisma/client.js";
import { seedId } from "./ids.js";
import { QUIZ_TEMPLATES } from "./data/egyptian-secondary.js";

export interface QuizSeedResult {
  quizzes: { id: string; title: string; chapterId: string; createdBy: string }[];
}

export async function seedQuizzes(
  prisma: PrismaClient,
  chapters: { id: string; teacherId: string }[],
  teacherIds: string[],
): Promise<QuizSeedResult> {
  const quizData: {
    id: string; title: string; description: string; chapterId: string;
    status: "DRAFT" | "PUBLISHED"; durationMinutes: number;
    questionCount: number; totalPoints: number; passingScore: number;
    difficulty: "EASY" | "MEDIUM" | "HARD"; createdBy: string;
    contentScope: "CHAPTER"; sourceScope: "SINGLE_CHAPTER";
    publishedAt: Date | null;
  }[] = [];

  const questionData: {
    id: string; quizId: string; type: "MCQ" | "TRUE_FALSE" | "ESSAY";
    text: string; options: any; correctAnswer: string | null;
    explanation: string; sortOrder: number; points: number;
  }[] = [];

  for (const tpl of QUIZ_TEMPLATES) {
    if (tpl.chapterIndex >= chapters.length) continue;
    const chapter = chapters[tpl.chapterIndex]!;
    const quizId = seedId(`quiz-${tpl.chapterIndex}-${tpl.title.slice(0, 10)}`);
    const createdBy = chapter.teacherId;
    const totalPoints = tpl.questions.reduce((sum, q) => sum + q.points, 0);
    const passingScore = Math.ceil(totalPoints * 0.5);

    quizData.push({
      id: quizId,
      title: tpl.title,
      description: tpl.description,
      chapterId: chapter.id,
      status: tpl.status,
      durationMinutes: 30,
      questionCount: tpl.questions.length,
      totalPoints,
      passingScore,
      difficulty: tpl.difficulty,
      createdBy,
      contentScope: "CHAPTER",
      sourceScope: "SINGLE_CHAPTER",
      publishedAt: tpl.status === "PUBLISHED" ? new Date() : null,
    });

    for (let qi = 0; qi < tpl.questions.length; qi++) {
      const q = tpl.questions[qi]!;
      questionData.push({
        id: seedId(`question-${tpl.chapterIndex}-${tpl.title.slice(0, 10)}-${qi}`),
        quizId,
        type: q.type,
        text: q.text,
        options: q.options,
        correctAnswer: q.correctAnswer,
        explanation: q.explanation,
        sortOrder: qi,
        points: q.points,
      });
    }
  }

  // Generate additional quizzes for chapters not covered by templates
  const templateChapterIndices = new Set(QUIZ_TEMPLATES.map(t => t.chapterIndex));
  let extraQuizCounter = 0;

  for (let ci = 0; ci < chapters.length; ci++) {
    if (templateChapterIndices.has(ci)) continue;
    const chapter = chapters[ci]!;
    const difficulties: ("EASY" | "MEDIUM" | "HARD")[] = ["EASY", "MEDIUM", "HARD"];
    const statuses: ("DRAFT" | "PUBLISHED")[] = ["PUBLISHED", "PUBLISHED", "DRAFT"];

    for (let qIdx = 0; qIdx < 2; qIdx++) {
      const diff = difficulties[extraQuizCounter % difficulties.length]!;
      const status = statuses[qIdx]!;
      const quizId = seedId(`quiz-extra-${ci}-${qIdx}`);
      const totalPoints = 10;
      const createdBy = chapter.teacherId;

      quizData.push({
        id: quizId,
        title: `اختبار ${chapter.id.slice(0, 20)} - ${qIdx + 1}`,
        description: `اختبار للفصل ${qIdx + 1}`,
        chapterId: chapter.id,
        status,
        durationMinutes: 25 + qIdx * 5,
        questionCount: 3,
        totalPoints,
        passingScore: 5,
        difficulty: diff,
        createdBy,
        contentScope: "CHAPTER",
        sourceScope: "SINGLE_CHAPTER",
        publishedAt: status === "PUBLISHED" ? new Date() : null,
      });

      // Generate 3 questions per extra quiz
      const mcqTexts = [
        "ما المقصود بالمفاهيم الأساسية في هذه الوحدة؟",
        "أي من العبارات التالية صحيحة؟",
        "كيف نطبق هذا المفهوم في الحياة اليومية؟",
      ];
      const tfTexts = [
        "المفهوم الأساسي في هذه الوحدة صحيح ومُجرَّب.",
        "يمكن تطبيق هذا المفهوم على جميع الحالات.",
      ];

      // MCQ
      questionData.push({
        id: seedId(`q-extra-${ci}-${qIdx}-0`),
        quizId,
        type: "MCQ",
        text: mcqTexts[0]!,
        options: ["الخيار الأول", "الخيار الثاني", "الخيار الثالث", "الخيار الرابع"],
        correctAnswer: "الخيار الأول",
        explanation: "الخيار الأول هو الإجابة الصحيحة بناءً على المنهج الدراسي.",
        sortOrder: 0,
        points: 3,
      });

      // TRUE_FALSE
      questionData.push({
        id: seedId(`q-extra-${ci}-${qIdx}-1`),
        quizId,
        type: "TRUE_FALSE",
        text: tfTexts[0]!,
        options: ["صح", "خطأ"],
        correctAnswer: "صح",
        explanation: "هذه العبارة صحيحة وفقًا للمادة العلمية.",
        sortOrder: 1,
        points: 3,
      });

      // ESSAY
      questionData.push({
        id: seedId(`q-extra-${ci}-${qIdx}-2`),
        quizId,
        type: "ESSAY",
        text: "اشرح هذا المفهوم بتفصيل مع إعطاء مثال من حياتك اليومية.",
        options: [],
        correctAnswer: null,
        explanation: "يجب أن يتضمن الإجابة تعريف المفهوم ومثالاً تطبيقياً.",
        sortOrder: 2,
        points: 4,
      });

      extraQuizCounter++;
    }
  }

  // Batch insert
  await prisma.quiz.createMany({ data: quizData, skipDuplicates: true });
  await prisma.question.createMany({ data: questionData, skipDuplicates: true });

  const quizzes = await prisma.quiz.findMany({
    select: { id: true, title: true, chapterId: true, createdBy: true },
    orderBy: [{ chapterId: "asc" }],
  });

  return { quizzes };
}
