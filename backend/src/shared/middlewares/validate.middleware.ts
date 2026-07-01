import type { Request, Response, NextFunction } from "express";
import type { ZodType } from "zod";

type RequestSource = "body" | "query" | "params";

export function validateRequest<T>(
  schema: ZodType<T>,
  source: RequestSource = "body",
) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req[source]);

    if (!result.success) {
      next(result.error);
      return;
    }

    req.validated ??= {};

    if (source === "query") {
      // Express 5 exposes req.query as a read-only getter — never reassign it.
      req.validated.query = result.data;
    } else if (source === "params") {
      req.validated.params = result.data;
      req.params = result.data as Request["params"];
    } else {
      req.validated.body = result.data;
      req.body = result.data;
    }

    next();
  };
}
