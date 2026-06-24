import { describe, it, expect, vi, beforeEach } from 'vitest';

import {
  GeminiClient,
  GeminiAuthError,
  GeminiRateLimitError,
  GeminiContentBlockedError,
  GeminiNetworkError,
} from './geminiClient.js';
import { GeminiTimeoutError } from '../errors/geminiErrors.js';
vi.hoisted(() => {
  process.env.GEMINI_API_KEY = 'test-api-key';
});

const mockFetch = vi.hoisted(() => vi.fn());
vi.stubGlobal('fetch', mockFetch);

function mockGenerateContentResponse(text: string) {
  return {
    candidates: [
      { content: { parts: [{ text }], role: 'model' }, finishReason: 'STOP' },
    ],
  };
}

function mockEmbedContentResponse(values: number[]) {
  return { embedding: { values } };
}

function setEnv(overrides?: Record<string, string>) {
  process.env.GEMINI_API_KEY = 'test-api-key';
  process.env.GEMINI_GENERATION_MODEL = 'gemini-2.0-flash';
  process.env.GEMINI_EMBEDDING_MODEL = 'text-embedding-004';
  if (overrides) {
    Object.assign(process.env, overrides);
  }
}

describe('GeminiClient', () => {
  let client: GeminiClient;

  beforeEach(() => {
    vi.clearAllMocks();
    setEnv();
    client = new GeminiClient();
  });

  describe('constructor', () => {
    it('uses default model names when env vars are not set', () => {
      delete process.env.GEMINI_GENERATION_MODEL;
      delete process.env.GEMINI_EMBEDDING_MODEL;
      const c = new GeminiClient();
      expect(c).toBeInstanceOf(GeminiClient);
    });
  });

  describe('generateContent', () => {
    it('returns the generated text on a successful response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockGenerateContentResponse('مرحباً')),
      });

      const result = await client.generateContent('Say hello');

      expect(result).toBe('مرحباً');
    });

    it('sends the system instruction instructing Arabic responses', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockGenerateContentResponse('ok')),
      });

      await client.generateContent('Hello');

      const body = JSON.parse(mockFetch.mock.calls[0]![1]!.body as string);
      expect(body.systemInstruction.parts[0].text).toBe(
        'You are a helpful assistant. Always respond in Arabic.',
      );
    });

    it('sends the user prompt in the contents array', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockGenerateContentResponse('ok')),
      });

      await client.generateContent('What is 2+2?');

      const body = JSON.parse(mockFetch.mock.calls[0]![1]!.body as string);
      expect(body.contents[0].parts[0].text).toBe('What is 2+2?');
    });

    it('passes generationConfig when provided', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockGenerateContentResponse('ok')),
      });

      await client.generateContent('Hi', {
        temperature: 0.5,
        maxOutputTokens: 100,
      });

      const body = JSON.parse(mockFetch.mock.calls[0]![1]!.body as string);
      expect(body.generationConfig.temperature).toBe(0.5);
      expect(body.generationConfig.maxOutputTokens).toBe(100);
    });

    it('throws GeminiContentBlockedError when finishReason is SAFETY', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            candidates: [
              {
                content: { parts: [{ text: '' }], role: 'model' },
                finishReason: 'SAFETY',
              },
            ],
          }),
      });

      await expect(client.generateContent('bad content')).rejects.toThrow(
        GeminiContentBlockedError,
      );
    });

    it('throws GeminiNetworkError when candidates array is empty', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ candidates: [] }),
      });

      await expect(client.generateContent('test')).rejects.toThrow(
        GeminiNetworkError,
      );
    });

    it('throws GeminiNetworkError when first candidate has no text', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            candidates: [
              { content: { parts: [], role: 'model' }, finishReason: 'STOP' },
            ],
          }),
      });

      await expect(client.generateContent('test')).rejects.toThrow(
        GeminiNetworkError,
      );
    });

    it('throws GeminiAuthError on HTTP 401', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: () =>
          Promise.resolve({
            error: {
              message: 'API key invalid',
              code: 401,
              status: 'UNAUTHENTICATED',
            },
          }),
      });

      await expect(client.generateContent('test')).rejects.toThrow(
        GeminiAuthError,
      );
    });

    it('throws GeminiAuthError on HTTP 403', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
        json: () => Promise.resolve({}),
      });

      await expect(client.generateContent('test')).rejects.toThrow(
        GeminiAuthError,
      );
    });

    it('throws GeminiRateLimitError on HTTP 429', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        json: () => Promise.resolve({}),
      });

      await expect(client.generateContent('test')).rejects.toThrow(
        GeminiRateLimitError,
      );
    });

    it('throws GeminiNetworkError on HTTP 500', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: () =>
          Promise.resolve({
            error: { message: 'Internal error', code: 500, status: 'INTERNAL' },
          }),
      });

      await expect(client.generateContent('test')).rejects.toThrow(
        GeminiNetworkError,
      );
    });

    it('throws GeminiTimeoutError when fetch is aborted', async () => {
      mockFetch.mockRejectedValueOnce(
        new DOMException('The operation was aborted', 'AbortError'),
      );

      await expect(client.generateContent('test')).rejects.toThrow(
        GeminiTimeoutError,
      );
    });

    it('throws GeminiNetworkError on network failure', async () => {
      mockFetch.mockRejectedValueOnce(new Error('fetch failed'));

      await expect(client.generateContent('test')).rejects.toThrow(
        GeminiNetworkError,
      );
    });
  });

  describe('embedContent', () => {
    it('returns the embedding vector on success', async () => {
      const expected = [0.1, 0.2, 0.3];
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockEmbedContentResponse(expected)),
      });

      const result = await client.embedContent('some text');

      expect(result).toEqual(expected);
    });

    it('throws GeminiNetworkError when embedding values are missing', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ embedding: {} }),
      });

      await expect(client.embedContent('test')).rejects.toThrow(
        GeminiNetworkError,
      );
    });
  });

  describe('getUsageStats', () => {
    it('returns zero when no requests have been made', () => {
      const freshClient = new GeminiClient();
      expect(freshClient.getUsageStats()).toEqual({ requestsThisMinute: 0 });
    });

    it('reports requests after generateContent calls', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockGenerateContentResponse('ok')),
      });

      await client.generateContent('first');
      await client.generateContent('second');

      const stats = client.getUsageStats();
      expect(stats.requestsThisMinute).toBeGreaterThanOrEqual(2);
    });
  });

  describe('retry logic', () => {
    it('retries on 429 and succeeds on third attempt', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 429,
          json: () => Promise.resolve({}),
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 429,
          json: () => Promise.resolve({}),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: () => Promise.resolve(mockGenerateContentResponse('done')),
        });

      const result = await client.generateContent('test');

      expect(result).toBe('done');
      expect(mockFetch).toHaveBeenCalledTimes(3);
    }, 10_000);

    it('retries on 500 and succeeds on second attempt', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          json: () => Promise.resolve({}),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: () => Promise.resolve(mockGenerateContentResponse('recovered')),
        });

      const result = await client.generateContent('test');

      expect(result).toBe('recovered');
      expect(mockFetch).toHaveBeenCalledTimes(2);
    }, 10_000);

    it('does not retry on GeminiAuthError', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: () => Promise.resolve({}),
      });

      await expect(client.generateContent('test')).rejects.toThrow(
        GeminiAuthError,
      );
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('does not retry on GeminiContentBlockedError', async () => {
      // SAFETY finish reason is checked after fetch succeeds, so no HTTP retry
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            candidates: [
              {
                content: { parts: [{ text: '' }], role: 'model' },
                finishReason: 'SAFETY',
              },
            ],
          }),
      });

      await expect(client.generateContent('test')).rejects.toThrow(
        GeminiContentBlockedError,
      );
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('does not retry on GeminiTimeoutError', async () => {
      mockFetch.mockRejectedValueOnce(
        new DOMException('aborted', 'AbortError'),
      );

      await expect(client.generateContent('test')).rejects.toThrow(
        GeminiTimeoutError,
      );
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });
  });
});
