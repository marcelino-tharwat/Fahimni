import type { PrismaClient } from "../../src/generated/prisma/client.js";
import { seedId } from "./ids.js";
import { randomChoice, randomInt, daysAgo } from "./helpers.js";
import { SCALE, BATCH_SIZE } from "./constants.js";

export async function seedEnrollments(
  prisma: PrismaClient,
  studentIds: string[],
  chapterData: { id: string; price: number | null; stageId: string }[],
  teacherIds: string[],
) {
  const enrollmentData: {
    id: string; studentId: string; chapterId: string;
    enrolledAt: Date; status: "ACTIVE";
    price: number; paymentMethod: "FREE" | "PROMO" | "PAYMOB";
    promoCodeId: string | null;
  }[] = [];

  const paymentData: {
    id: string; studentId: string; chapterId: string;
    paymobOrderId: string; amount: number; currency: string;
    status: "SUCCESS"; createdAt: Date;
  }[] = [];

  const seenPairs = new Set<string>();

  // Each student gets ~5 enrollments
  for (const studentId of studentIds) {
    const numEnrollments = SCALE.ENROLLMENTS_PER_STUDENT;
    const availableChapters = chapterData.filter(c => c.price !== null || Math.random() > 0.3);

    for (let e = 0; e < numEnrollments && e < availableChapters.length; e++) {
      const chapter = randomChoice(availableChapters);
      const pairKey = `${studentId}-${chapter.id}`;
      if (seenPairs.has(pairKey)) continue;
      seenPairs.add(pairKey);

      const isFree = chapter.price === null || chapter.price === 0;
      const paymentMethod = isFree ? "FREE" as const : randomChoice(["PAYMOB", "PAYMOB", "PROMO"] as const);
      const price = isFree ? 0 : (paymentMethod === "PROMO" ? 0 : chapter.price!);

      enrollmentData.push({
        id: seedId(`enrollment-${studentId.slice(0, 8)}-${chapter.id.slice(0, 8)}`),
        studentId,
        chapterId: chapter.id,
        enrolledAt: daysAgo(randomInt(1, 60)),
        status: "ACTIVE",
        price,
        paymentMethod,
        promoCodeId: paymentMethod === "PROMO" ? null : null,
      });

      if (paymentMethod === "PAYMOB" && price > 0) {
        paymentData.push({
          id: seedId(`payment-${studentId.slice(0, 8)}-${chapter.id.slice(0, 8)}`),
          studentId,
          chapterId: chapter.id,
          paymobOrderId: `PAY-${Date.now()}-${randomInt(1000, 9999)}`,
          amount: price,
          currency: "EGP",
          status: "SUCCESS",
          createdAt: daysAgo(randomInt(1, 60)),
        });
      }
    }
  }

  // Batch insert enrollments
  const enrollmentChunks = enrollmentData.reduce(
    (acc, item, i) => {
      const chunkIndex = Math.floor(i / BATCH_SIZE);
      if (!acc[chunkIndex]) acc[chunkIndex] = [];
      acc[chunkIndex].push(item);
      return acc;
    },
    [] as typeof enrollmentData[],
  );

  for (const chunk of enrollmentChunks) {
    await prisma.enrollment.createMany({ data: chunk, skipDuplicates: true });
  }

  // Batch insert payment transactions
  const paymentChunks = paymentData.reduce(
    (acc, item, i) => {
      const chunkIndex = Math.floor(i / BATCH_SIZE);
      if (!acc[chunkIndex]) acc[chunkIndex] = [];
      acc[chunkIndex].push(item);
      return acc;
    },
    [] as typeof paymentData[],
  );

  for (const chunk of paymentChunks) {
    await prisma.paymentTransaction.createMany({ data: chunk, skipDuplicates: true });
  }

  console.log(`  ✓ Enrollments: ${enrollmentData.length} created`);
  console.log(`  ✓ Payment Transactions: ${paymentData.length} created`);
}
