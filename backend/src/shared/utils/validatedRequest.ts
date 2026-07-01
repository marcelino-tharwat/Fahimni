import type { Request } from "express";
import { AppError } from "./AppError.js";

export class ValidatedRequestError extends AppError {
  constructor(message = "Validated request data is unavailable.") {
    super(message, 500, "VALIDATED_REQUEST_UNAVAILABLE");
  }
}

export function getValidatedQuery<T>(req: Request): T {
  if (req.validated?.query === undefined) {
    throw new ValidatedRequestError();
  }
  return req.validated.query as T;
}

export function getValidatedParams<T>(req: Request): T {
  if (req.validated?.params === undefined) {
    throw new ValidatedRequestError();
  }
  return req.validated.params as T;
}

export function getValidatedBody<T>(req: Request): T {
  if (req.validated?.body === undefined) {
    throw new ValidatedRequestError();
  }
  return req.validated.body as T;
}
