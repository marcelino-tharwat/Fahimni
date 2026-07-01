declare global {
  namespace Express {
    interface Request {
      requestId?: string;
      user?: {
        id: string;
        role?: string;
      };
      validated?: {
        body?: unknown;
        params?: unknown;
        query?: unknown;
      };
    }
  }
}

export {};
