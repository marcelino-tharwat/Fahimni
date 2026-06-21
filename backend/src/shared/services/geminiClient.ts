import { logger } from '../../config/logger.js';
import {
  GeminiAuthError,
  GeminiRateLimitError,
  GeminiContentBlockedError,
  GeminiTimeoutError,
  GeminiNetworkError,
} from '../errors/geminiErrors.js';
import type {
  GenerationConfig,
  SystemInstruction,
  Content,
  GenerateContentResponse,
  EmbedContentResponse,
  GeminiErrorBody,
} from '../types/gemini.types.js';

const GENERATION_TIMEOUT_MS = 30_000;
const EMBED_TIMEOUT_MS = 10_000;
const MAX_RETRIES = 3;
const RETRY_DELAYS_MS = [500, 1_000, 2_000] as const;
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 30;

const GENERATION_URL =
  'https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}';
const EMBED_URL =
  'https://generativelanguage.googleapis.com/v1beta/models/${model}:embedContent?key=${apiKey}';

export class GeminiClient {
  private readonly apiKey: string;
  private readonly generationModel: string;
  private readonly embeddingModel: string;
  private readonly requestTimestamps: number[] = [];

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new GeminiAuthError(
        'GEMINI_API_KEY is not set in environment variables',
      );
    }
    this.apiKey = apiKey;
    this.generationModel =
      process.env.GEMINI_GENERATION_MODEL ?? 'gemini-2.0-flash';
    this.embeddingModel =
      process.env.GEMINI_EMBEDDING_MODEL ?? 'text-embedding-004';
  }

  /**
   * Generates content using the Gemini API.
   *
   * @param prompt - The user prompt to send to the model
   * @param config - Optional generation configuration (temperature, topP, maxOutputTokens, etc.)
   * @returns The generated text response
   * @throws {GeminiAuthError} If the API key is invalid or unauthorized
   * @throws {GeminiRateLimitError} If the rate limit is exceeded
   * @throws {GeminiContentBlockedError} If the response was blocked by safety filters
   * @throws {GeminiTimeoutError} If the request exceeds the 30-second timeout
   * @throws {GeminiNetworkError} If a network or parsing error occurs
   */
  public async generateContent(
    prompt: string,
    config?: GenerationConfig,
  ): Promise<string> {
    await this._enqueueIfNeeded();

    const body = this._buildGenerateRequestBody(prompt, config);

    const response = await this._withRetry(() =>
      this._fetchWithTimeout(
        GENERATION_URL.replace('${model}', this.generationModel).replace(
          '${apiKey}',
          this.apiKey,
        ),
        body,
        GENERATION_TIMEOUT_MS,
        'generateContent',
      ),
    );

    return this._parseGenerationResponse(response);
  }

  /**
   * Generates an embedding vector for the given text.
   *
   * @param text - The text to embed
   * @returns An array of numbers representing the embedding
   * @throws {GeminiAuthError} If the API key is invalid or unauthorized
   * @throws {GeminiRateLimitError} If the rate limit is exceeded
   * @throws {GeminiTimeoutError} If the request exceeds the 10-second timeout
   * @throws {GeminiNetworkError} If a network or parsing error occurs
   */
  public async embedContent(text: string): Promise<number[]> {
    await this._enqueueIfNeeded();

    const body = {
      model: `models/${this.embeddingModel}`,
      content: { parts: [{ text }] },
    };

    const response = await this._withRetry(() =>
      this._fetchWithTimeout(
        EMBED_URL.replace('${model}', this.embeddingModel).replace(
          '${apiKey}',
          this.apiKey,
        ),
        body,
        EMBED_TIMEOUT_MS,
        'embedContent',
      ),
    );

    return this._parseEmbeddingResponse(response);
  }

  /**
   * Returns usage statistics for the Gemini client.
   *
   * @returns An object with the number of requests made in the current sliding minute window
   */
  public getUsageStats(): { requestsThisMinute: number } {
    this._pruneTimestamps();
    return { requestsThisMinute: this.requestTimestamps.length };
  }

  private _buildGenerateRequestBody(
    prompt: string,
    config?: GenerationConfig,
  ): unknown {
    const systemInstruction: SystemInstruction = {
      parts: [
        { text: 'You are a helpful assistant. Always respond in Arabic.' },
      ],
    };

    const contents: Content[] = [
      {
        parts: [{ text: prompt }],
      },
    ];

    return {
      systemInstruction,
      contents,
      ...(config ? { generationConfig: config } : {}),
    };
  }

  private _parseGenerationResponse(response: unknown): string {
    const geminiResponse = response as GenerateContentResponse;

    if (!geminiResponse.candidates || geminiResponse.candidates.length === 0) {
      throw new GeminiNetworkError('Gemini response has no candidates');
    }

    const candidate = geminiResponse.candidates[0]!;

    if (candidate.finishReason === 'SAFETY') {
      throw new GeminiContentBlockedError();
    }

    const text = candidate.content?.parts?.[0]?.text;

    if (!text) {
      throw new GeminiNetworkError(
        'Gemini response contains no text in the first candidate part',
      );
    }

    return text;
  }

  private _parseEmbeddingResponse(response: unknown): number[] {
    const embeddingResponse = response as EmbedContentResponse;

    if (!embeddingResponse.embedding?.values) {
      throw new GeminiNetworkError(
        'Gemini embedding response is missing embedding values',
      );
    }

    return embeddingResponse.embedding.values;
  }

  private _pruneTimestamps(): void {
    const cutoff = Date.now() - RATE_LIMIT_WINDOW_MS;
    while (
      this.requestTimestamps.length > 0 &&
      this.requestTimestamps[0]! < cutoff
    ) {
      this.requestTimestamps.shift();
    }
  }

  private async _enqueueIfNeeded(): Promise<void> {
    this._pruneTimestamps();

    while (this.requestTimestamps.length >= RATE_LIMIT_MAX_REQUESTS) {
      const oldest = this.requestTimestamps[0]!;
      const waitTime = oldest + RATE_LIMIT_WINDOW_MS - Date.now();
      if (waitTime > 0) {
        await this._sleep(waitTime);
      }
      this._pruneTimestamps();
    }
  }

  private _recordRequest(): void {
    this.requestTimestamps.push(Date.now());
  }

  private async _sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private async _withRetry<T>(fn: () => Promise<T>): Promise<T> {
    let lastError: unknown;

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        const result = await fn();
        return result;
      } catch (error) {
        lastError = error;

        if (
          error instanceof GeminiAuthError ||
          error instanceof GeminiContentBlockedError ||
          error instanceof GeminiTimeoutError
        ) {
          throw error;
        }

        const isRetryable =
          error instanceof GeminiRateLimitError ||
          (error instanceof GeminiNetworkError && /5\d{2}/.test(error.message));

        if (isRetryable && attempt < MAX_RETRIES - 1) {
          const delay = RETRY_DELAYS_MS[attempt]!;
          logger.warn(
            `[GeminiClient] Retry attempt ${attempt + 1}/${MAX_RETRIES} after ${delay}ms`,
            error instanceof Error ? error.message : 'Unknown error',
          );
          await this._sleep(delay);
          continue;
        }

        break;
      }
    }

    throw lastError;
  }

  private async _fetchWithTimeout(
    url: string,
    body: unknown,
    timeoutMs: number,
    operation: string,
  ): Promise<unknown> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      this._recordRequest();

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (response.status === 401 || response.status === 403) {
        const errorBody = (await response
          .json()
          .catch(() => ({}))) as GeminiErrorBody;
        throw new GeminiAuthError(
          errorBody.error?.message ?? `HTTP ${response.status}`,
        );
      }

      if (response.status === 429) {
        const errorBody = (await response
          .json()
          .catch(() => ({}))) as GeminiErrorBody;
        throw new GeminiRateLimitError(
          errorBody.error?.message ?? 'Rate limit exceeded',
        );
      }

      if (response.status >= 500) {
        const errorBody = (await response
          .json()
          .catch(() => ({}))) as GeminiErrorBody;
        throw new GeminiNetworkError(
          errorBody.error?.message ?? `HTTP ${response.status} server error`,
        );
      }

      if (!response.ok) {
        const errorBody = (await response
          .json()
          .catch(() => ({}))) as GeminiErrorBody;
        throw new GeminiNetworkError(
          errorBody.error?.message ?? `HTTP ${response.status}`,
        );
      }

      return (await response.json()) as unknown;
    } catch (error) {
      if (
        error instanceof GeminiAuthError ||
        error instanceof GeminiRateLimitError ||
        error instanceof GeminiNetworkError
      ) {
        throw error;
      }

      if (error instanceof DOMException && error.name === 'AbortError') {
        throw new GeminiTimeoutError(operation);
      }

      throw new GeminiNetworkError(
        error instanceof Error ? error.message : 'Unknown network error',
      );
    } finally {
      clearTimeout(timeoutId);
    }
  }
}

export const geminiClient = new GeminiClient();
export {
  GeminiAuthError,
  GeminiRateLimitError,
  GeminiContentBlockedError,
  GeminiNetworkError,
};
