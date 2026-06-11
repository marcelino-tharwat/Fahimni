-- DropForeignKey
ALTER TABLE "teacher_profiles" DROP CONSTRAINT "teacher_profiles_userId_fkey";

-- DropTable
DROP TABLE "teacher_profiles";

-- AlterEnum
CREATE TYPE "Role_new" AS ENUM ('ADMIN', 'STUDENT', 'OPERATION');
ALTER TABLE "User" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "User" ALTER COLUMN "role" TYPE "Role_new" USING ("role"::text::"Role_new");
ALTER TABLE "User" ALTER COLUMN "role" SET DEFAULT 'STUDENT';
DROP TYPE "Role";
ALTER TYPE "Role_new" RENAME TO "Role";
