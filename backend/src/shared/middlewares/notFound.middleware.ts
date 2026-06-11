import type { RequestHandler } from "express";
import type { ApiError } from "../types/common.types.js";

export const notFoundHandler: RequestHandler = (_req, _res, next) => {
  const error = new Error("Route not found") as ApiError;
  error.status = 404;
  next(error);
};
