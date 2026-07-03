import { prisma } from "../src/config/database.js";

async function main() {
  const quizLessons = await prisma.quizLesson.findMany({
    take: 30,
    include: {
      quiz: { select: { id: true, title: true, contentScope: true, status: true } },
      lesson: { select: { id: true, title: true, requiredQuizId: true, chapterId: true } },
    },
  });
  console.log("QuizLesson rows:", JSON.stringify(quizLessons, null, 2));

  const withRequired = await prisma.lesson.findMany({
    where: { deletedAt: null, requiredQuizId: { not: null } },
    select: { id: true, title: true, chapterId: true, sortOrder: true, requiredQuizId: true },
  });
  console.log("Lessons with requiredQuizId:", JSON.stringify(withRequired, null, 2));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
