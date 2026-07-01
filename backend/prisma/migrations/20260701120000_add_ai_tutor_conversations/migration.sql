-- STORY-69: persistent AI tutor conversations and messages (PostgreSQL via Prisma).

CREATE TYPE "AiMessageRole" AS ENUM ('STUDENT', 'ASSISTANT');
CREATE TYPE "AiMessageStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED');

CREATE TABLE "ai_conversations" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT 'محادثة جديدة',
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "ai_conversations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ai_messages" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "role" "AiMessageRole" NOT NULL,
    "content" TEXT NOT NULL,
    "status" "AiMessageStatus" NOT NULL DEFAULT 'PENDING',
    "citations" JSONB NOT NULL DEFAULT '[]',
    "clientMessageId" TEXT,
    "errorCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_messages_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ai_conversations_studentId_updatedAt_idx" ON "ai_conversations"("studentId", "updatedAt");
CREATE INDEX "ai_messages_conversationId_createdAt_idx" ON "ai_messages"("conversationId", "createdAt");
CREATE UNIQUE INDEX "ai_messages_conversationId_clientMessageId_key" ON "ai_messages"("conversationId", "clientMessageId");

ALTER TABLE "ai_conversations" ADD CONSTRAINT "ai_conversations_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ai_messages" ADD CONSTRAINT "ai_messages_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "ai_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
