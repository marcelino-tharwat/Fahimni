export class AppError extends Error {
  public readonly statusCode: number;
  public readonly status: 'fail' | 'error';
  public readonly isOperational: boolean;
  public readonly code?: string;
  /** Safe string metadata for clients (e.g. attemptId on ATTEMPT_ALREADY_SUBMITTED). */
  public readonly meta?: Record<string, string>;

  constructor(
    message: string,
    statusCode: number,
    code?: string,
    meta?: Record<string, string>,
  ) {
    super(message);
    this.statusCode = statusCode;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    this.isOperational = true;
    if (code !== undefined) {
      this.code = code;
    }
    if (meta !== undefined) {
      this.meta = meta;
    }
    Object.setPrototypeOf(this, AppError.prototype);
  }
}
