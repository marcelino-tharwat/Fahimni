export type IndexingStatus = "pending" | "indexing" | "ready" | "failed";

export interface TextChunk {
  content: string;
  index: number;
  charStart: number;
  charEnd: number;
}

export interface SimilarChunk {
  id: string;
  content: string;
  lessonId: string;
  score: number;
  metadata: Record<string, unknown>;
}

export interface IndexLessonBody {
  pdfText: string;
  metadata?: Record<string, unknown>;
}
