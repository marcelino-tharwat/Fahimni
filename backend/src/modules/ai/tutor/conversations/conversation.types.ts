/** Public citation shape persisted on assistant messages and returned to clients. */
export interface TutorCitationDto {
  lessonId: string;
  lessonTitle: string;
  chapterName: string;
}

export interface ConversationSummaryDto {
  id: string;
  title: string;
  isArchived: boolean;
  lastMessagePreview: string | null;
  messageCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface MessageDto {
  id: string;
  role: "STUDENT" | "ASSISTANT";
  content: string;
  status: "PENDING" | "COMPLETED" | "FAILED";
  citations: TutorCitationDto[];
  createdAt: string;
}

export interface UsageDto {
  limit: number;
  used: number;
  remaining: number;
  resetsAt: string;
}

export interface CursorMeta {
  nextCursor: string | null;
  hasMore: boolean;
}

export interface SendMessageResultDto {
  conversation: ConversationSummaryDto;
  studentMessage: MessageDto;
  assistantMessage: MessageDto | null;
  usage: UsageDto;
}
