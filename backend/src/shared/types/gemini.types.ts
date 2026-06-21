export interface GenerationConfig {
  temperature?: number;
  topP?: number;
  topK?: number;
  maxOutputTokens?: number;
  stopSequences?: string[];
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
