export class GeminiAuthError extends Error {
  constructor(message?: string) {
    super(message ?? "Gemini API authentication failed");
    this.name = "GeminiAuthError";
    Object.setPrototypeOf(this, GeminiAuthError.prototype);
  }
}

export class GeminiRateLimitError extends Error {
  constructor(message?: string) {
    super(message ?? "Gemini API rate limit exceeded");
    this.name = "GeminiRateLimitError";
    Object.setPrototypeOf(this, GeminiRateLimitError.prototype);
  }
}

export class GeminiContentBlockedError extends Error {
  constructor(message?: string) {
    super(message ?? "Gemini content blocked by safety filter");
    this.name = "GeminiContentBlockedError";
    Object.setPrototypeOf(this, GeminiContentBlockedError.prototype);
  }
}

export class GeminiTimeoutError extends Error {
  constructor(operation: string) {
    super(`Gemini API request timed out: ${operation}`);
    this.name = "GeminiTimeoutError";
    Object.setPrototypeOf(this, GeminiTimeoutError.prototype);
  }
}

export class GeminiNetworkError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GeminiNetworkError";
    Object.setPrototypeOf(this, GeminiNetworkError.prototype);
  }
}
