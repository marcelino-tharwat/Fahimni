import "dotenv/config";
import { prisma } from "../src/config/database.js";
import { TEACHER_PLANS as PLANS } from "../src/modules/teacher-plans/teacher-plan.seed-data.js";

async function main() {
  console.log("Seeding teacher plans...");

  for (const plan of PLANS) {
    await prisma.teacherPlan.upsert({
      where: { code: plan.code },
      update: {
        name: plan.name,
        displayName: plan.displayName,
        description: plan.description,
        monthlyPrice: plan.monthlyPrice,
        yearlyPrice: plan.yearlyPrice,
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
        yearlyPrice: plan.yearlyPrice,
        currency: plan.currency,
        billingInterval: plan.billingInterval,
        isActive: plan.isActive,
        isRecommended: plan.isRecommended,
        sortOrder: plan.sortOrder,
        features: plan.features,
        limits: plan.limits,
      },
    });
    console.log(`  ✓ ${plan.code}`);
  }

  console.log("Teacher plans seeded successfully.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
