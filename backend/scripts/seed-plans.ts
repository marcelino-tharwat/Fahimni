import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { TEACHER_PLANS } from "../src/modules/teacher-plans/teacher-plan.seed-data.js";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
});
const prisma = new PrismaClient({ adapter });

async function seedPlans() {
  for (const plan of TEACHER_PLANS) {
    await prisma.teacherPlan.upsert({
      where: { code: plan.code },
      update: {
        name: plan.name,
        displayName: plan.displayName,
        description: plan.description,
        monthlyPrice: plan.monthlyPrice,
        yearlyPrice: plan.yearlyPrice ?? undefined,
        currency: plan.currency,
        billingInterval: plan.billingInterval,
        isActive: plan.isActive,
        isRecommended: plan.isRecommended,
        sortOrder: plan.sortOrder,
        features: plan.features,
        limits: plan.limits,
      },
      create: {
        code: plan.code,
        name: plan.name,
        displayName: plan.displayName,
        description: plan.description,
        monthlyPrice: plan.monthlyPrice,
        yearlyPrice: plan.yearlyPrice ?? undefined,
        currency: plan.currency,
        billingInterval: plan.billingInterval,
        isActive: plan.isActive,
        isRecommended: plan.isRecommended,
        sortOrder: plan.sortOrder,
        features: plan.features,
        limits: plan.limits,
      },
    });
    console.log(`Plan seeded: ${plan.code}`);
  }

  await prisma.$disconnect();
}

seedPlans().catch((e) => {
  console.error("Failed to seed plans:", e);
  process.exitCode = 1;
  prisma.$disconnect();
});
