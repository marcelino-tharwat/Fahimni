-- CreateEnum
CREATE TYPE "OtpType" AS ENUM ('EMAIL_VERIFICATION', 'PASSWORD_RESET');

-- CreateTable
CREATE TABLE "otps" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "type" "OtpType" NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "otps_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "otps" ADD CONSTRAINT "otps_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
