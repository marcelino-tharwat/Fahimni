export interface TutorCitation {
  lessonId: string;
  lessonTitle: string;
  chapterName: string;
}

export interface TutorUsage {
  used: number;
  limit: number;
  remaining: number;
  resetsAt: string;
}

export interface TutorAskResponse {
  answer: string;
  citations: TutorCitation[];
}

export type TutorMessageRole = 'STUDENT' | 'ASSISTANT';
export type TutorMessageStatus = 'PENDING' | 'COMPLETED' | 'FAILED';

export interface TutorMessage {
  id: string;
  role: TutorMessageRole;
  content: string;
  status: TutorMessageStatus;
  citations: TutorCitation[];
  createdAt: string;
  errorCode?: string;
}

export interface TutorConversationSummary {
  id: string;
  title: string;
  isArchived: boolean;
  lastMessagePreview: string | null;
  messageCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface TutorCursorMeta {
  nextCursor: string | null;
  hasMore: boolean;
}

export interface TutorCursorPage<T> {
  data: T[];
  meta: TutorCursorMeta;
}

export interface TutorSendMessageResponse {
  conversation: TutorConversationSummary;
  studentMessage: TutorMessage;
  assistantMessage: TutorMessage | null;
  usage: TutorUsage;
}

/** UI-layer message including optimistic / error state. */
export interface AiTutorChatMessage {
  id: string;
  role: 'student' | 'assistant';
  content: string;
  status?: TutorMessageStatus;
  citations?: TutorCitation[];
  createdAt?: string;
  failed?: boolean;
  errorCode?: string;
  clientMessageId?: string;
}
