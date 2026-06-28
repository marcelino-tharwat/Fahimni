export interface GenerationConfig {
  temperature?: number;
  topP?: number;
  topK?: number;
  maxOutputTokens?: number;
  stopSequences?: string[];
  /**
   * When set to "application/json", instructs Gemini to return a raw JSON
   * response with no Markdown fences. Callers should still defensively parse
   * fenced JSON in case the model ignores the hint.
   */
  responseMimeType?: string;
}

/**
 * Per-call options for a Gemini generation request.
 */
export interface GenerateContentOptions {
  /**
   * Overrides the default generation timeout (30s) for this single call.
   * STORY-45 uses this to cap the quiz-generation Gemini call at 20s.
   */
  timeoutMs?: number;
  /**
   * Overrides the default system instruction for this single call. When omitted
   * the client keeps its default ("Always respond in Arabic"), so existing
   * callers are unaffected. STORY-63 (AI tutor) supplies a grounded, bilingual
   * tutor instruction here.
   */
  systemInstruction?: string;
}

export interface GeminiErrorBody {
  error?: {
    code: number;
    message: string;
    status: string;
  };
}

export interface SystemInstruction {
  parts: { text: string }[];
}

export interface Content {
  parts: { text: string }[];
}

export interface Candidate {
  content: Content;
  finishReason: string;
}

export interface GenerateContentResponse {
  candidates: Candidate[];
}

export interface EmbedContentResponse {
  embedding: {
    values: number[];
  };
}
