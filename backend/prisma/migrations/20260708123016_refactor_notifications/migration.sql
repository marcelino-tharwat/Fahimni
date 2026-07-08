-- AlterEnum: remove NEW_CHAPTER (no rows exist yet so safe)
ALTER TYPE "NotificationType" RENAME TO "NotificationType_old";
CREATE TYPE "NotificationType" AS ENUM ('NEW_LESSON', 'NEW_QUIZ');
ALTER TABLE "notifications" ALTER COLUMN "type" TYPE "NotificationType" USING ("type"::text::"NotificationType");
DROP TYPE "NotificationType_old";

-- Replace title + message with a single resourceTitle column
ALTER TABLE "notifications" DROP COLUMN "title",
DROP COLUMN "message",
ADD COLUMN "resourceTitle" TEXT NOT NULL DEFAULT '';
ALTER TABLE "notifications" ALTER COLUMN "resourceTitle" DROP DEFAULT;
