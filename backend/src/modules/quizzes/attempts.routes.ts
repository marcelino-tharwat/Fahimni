import { Router } from "express";
import { AttemptsController } from "./attempts.controller.js";
import { authenticateMiddleware } from "../../shared/middlewares/authenticate.middleware.js";
import { authorizeMiddleware } from "../../shared/middlewares/authorize.middleware.js";
import { validateRequest } from "../../shared/middlewares/validate.middleware.js";
import {
  submitAttemptSchema,
  gradeEssaysSchema,
} from "./attempts.validation.js";

const controller = new AttemptsController();

// Mounted at /api/attempts
const attemptsRouter = Router();

// Student submits all answers for their own attempt.
attemptsRouter.post(
  "/:attemptId/submit",
  authenticateMiddleware,
  authorizeMiddleware("STUDENT"),
  validateRequest(submitAttemptSchema),
  controller.submit,
);

// Teacher grades pending essay answers.
// STORY-68 specifies PATCH; the original POST is kept as a backward-compatible
// alias. Both map to the same handler + validation.
const gradeEssaysChain = [
  authenticateMiddleware,
  authorizeMiddleware("OPERATION"),
  validateRequest(gradeEssaysSchema),
  controller.gradeEssays,
] as const;

attemptsRouter.post("/:attemptId/grade-essays", ...gradeEssaysChain);
attemptsRouter.patch("/:attemptId/grade-essays", ...gradeEssaysChain);

// Student re-fetches their own submitted attempt results. Registered AFTER the
// more specific /:attemptId/* routes above so it never shadows them.
attemptsRouter.get(
  "/:attemptId",
  authenticateMiddleware,
  authorizeMiddleware("STUDENT"),
  controller.getAttemptResults,
);

export default attemptsRouter;
