export interface AiTutorSource {
  lessonId: string;
  lessonTitle: string;
  chapterName: string;
}

export interface AiTutorMessage {
  id: string;
  role: 'student' | 'assistant';
  content: string;
  sources?: AiTutorSource[];
  createdAt: string;
}
