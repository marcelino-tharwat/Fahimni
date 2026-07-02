import { Router } from "express";
import { AttemptsController } from "./attempts.controller.js";
import { authenticateMiddleware } from "../../shared/middlewares/authenticate.middleware.js";
import { authorizeMiddleware } from "../../shared/middlewares/authorize.middleware.js";
import { validateRequest } from "../../shared/middlewares/validate.middleware.js";
import {
  submitAttemptSchema,
  saveDraftAnswersSchema,
  gradeEssaysSchema,
} from "./attempts.validation.js";

const controller = new AttemptsController();

// Mounted at /api/attempts
const attemptsRouter = Router();

// Student persists draft answers while the attempt is in progress.
attemptsRouter.patch(
  "/:attemptId/answers",
  authenticateMiddleware,
  authorizeMiddleware("STUDENT"),
  validateRequest(saveDraftAnswersSchema),
  controller.saveDraftAnswers,
);

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

// Teacher essay grading detail — before student GET /:attemptId.
attemptsRouter.get(
  "/:attemptId/essay-grading",
  authenticateMiddleware,
  authorizeMiddleware("OPERATION"),
  controller.getEssayGradingDetail,
);

// Student re-fetches their own submitted attempt results. Registered AFTER the
// more specific /:attemptId/* routes above so it never shadows them.
attemptsRouter.get(
  "/:attemptId",
  authenticateMiddleware,
  authorizeMiddleware("STUDENT"),
  controller.getAttemptResults,
);

export default attemptsRouter;
