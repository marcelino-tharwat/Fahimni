-- CreateTable
CREATE TABLE "lesson_material_downloads" (
    "id" TEXT NOT NULL,
    "student_id" TEXT NOT NULL,
    "material_id" TEXT NOT NULL,
    "first_downloaded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_downloaded_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lesson_material_downloads_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "lesson_material_downloads_material_id_idx" ON "lesson_material_downloads"("material_id");

-- CreateIndex
CREATE INDEX "lesson_material_downloads_student_id_idx" ON "lesson_material_downloads"("student_id");

-- CreateIndex
CREATE UNIQUE INDEX "lesson_material_downloads_student_id_material_id_key" ON "lesson_material_downloads"("student_id", "material_id");

-- AddForeignKey
ALTER TABLE "lesson_material_downloads" ADD CONSTRAINT "lesson_material_downloads_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lesson_material_downloads" ADD CONSTRAINT "lesson_material_downloads_material_id_fkey" FOREIGN KEY ("material_id") REFERENCES "lesson_materials"("id") ON DELETE CASCADE ON UPDATE CASCADE;
