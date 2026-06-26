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
attemptsRouter.post(
  "/:attemptId/grade-essays",
  authenticateMiddleware,
  authorizeMiddleware("OPERATION"),
  validateRequest(gradeEssaysSchema),
  controller.gradeEssays,
);

export default attemptsRouter;
