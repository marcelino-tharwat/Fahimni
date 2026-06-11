-- CreateTable
CREATE TABLE "teacher_profiles" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "bio" TEXT NOT NULL,
    "photoUrl" TEXT,
    "logoUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "teacher_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "teacher_profiles_userId_key" ON "teacher_profiles"("userId");

-- AddForeignKey
ALTER TABLE "teacher_profiles" ADD CONSTRAINT "teacher_profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
