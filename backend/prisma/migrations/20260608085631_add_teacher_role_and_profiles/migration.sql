-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'TEACHER';

-- CreateTable
CREATE TABLE "student_profiles" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "student_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "teacher_profiles" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "teacher_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "student_profiles_userId_key" ON "student_profiles"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "teacher_profiles_userId_key" ON "teacher_profiles"("userId");

-- AddForeignKey
ALTER TABLE "student_profiles" ADD CONSTRAINT "student_profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teacher_profiles" ADD CONSTRAINT "teacher_profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
