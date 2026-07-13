import type { PrismaClient } from "../../src/generated/prisma/client.js";
import { seedId } from "./ids.js";
import { randomChoice, daysAgo, randomInt } from "./helpers.js";
import { BATCH_SIZE } from "./constants.js";

export async function seedNotifications(
  prisma: PrismaClient,
  studentIds: string[],
  chapterData: { id: string; name: string }[],
) {
  const notificationData: {
    id: string; studentId: string; type: "NEW_LESSON" | "NEW_QUIZ";
    resourceTitle: string; resourceType: string; resourceId: string;
    courseContextId: string | null; isRead: boolean; createdAt: Date;
  }[] = [];

  const lessonTitles = [
    "مقدمة عن المادة", "القانون الأساسي", "التمارين العملية",
    "مراجعة الفصل", "اختبار قصير", "شرح نظري",
    "تطبيقات عملية", "مناقشة المفاهيم", "مراجعة شاملة",
  ];

  const quizTitles = [
    "اختبار الفصل الأول", "اختبار منتصف الفصل", "اختبار نهائي",
    "اختبار قصير", "اختبار تكويني",
  ];

  for (const studentId of studentIds) {
    const numNotifications = randomInt(3, 15);
    for (let n = 0; n < numNotifications; n++) {
      const type = randomChoice(["NEW_LESSON", "NEW_QUIZ"] as const);
      const chapter = randomChoice(chapterData);

      notificationData.push({
        id: seedId(`notif-${studentId.slice(0, 8)}-${n}`),
        studentId,
        type,
        resourceTitle: type === "NEW_LESSON"
          ? randomChoice(lessonTitles)
          : randomChoice(quizTitles),
        resourceType: type === "NEW_LESSON" ? "Lesson" : "Quiz",
        resourceId: seedId(`resource-${n}`),
        courseContextId: chapter.id,
        isRead: Math.random() > 0.4,
        createdAt: daysAgo(randomInt(1, 30)),
      });
    }
  }

  const chunks = notificationData.reduce(
    (acc, item, i) => {
      const chunkIndex = Math.floor(i / BATCH_SIZE);
      if (!acc[chunkIndex]) acc[chunkIndex] = [];
      acc[chunkIndex].push(item);
      return acc;
    },
    [] as typeof notificationData[],
  );

  for (const chunk of chunks) {
    await prisma.notification.createMany({ data: chunk, skipDuplicates: true });
  }

  console.log(`  ✓ Notifications: ${notificationData.length} created`);
}
