-- CreateTable
CREATE TABLE "lesson_materials" (
    "id" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lesson_materials_pkey" PRIMARY KEY ("id")
);
