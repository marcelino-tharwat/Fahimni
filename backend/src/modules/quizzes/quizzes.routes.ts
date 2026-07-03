import { Router } from "express";
import { QuizzesController } from "./quizzes.controller.js";
import { QuestionsController } from "./questions.controller.js";
import { authenticateMiddleware } from "../../shared/middlewares/authenticate.middleware.js";
import { authorizeMiddleware } from "../../shared/middlewares/authorize.middleware.js";
import { validateRequest } from "../../shared/middlewares/validate.middleware.js";
import {
  createQuizSchema,
  updateQuizSchema,
  addQuestionSchema,
  updateQuestionSchema,
  reorderSchema,
  assignQuizSchema,
  publishQuizSchema,
} from "./quizzes.validation.js";
import { generateQuizSchema } from "./dto/generate-quiz.dto.js";
import { AttemptsController } from "./attempts.controller.js";

const quizController = new QuizzesController();
const questionsController = new QuestionsController();
const attemptsController = new AttemptsController();

// ── Standalone routes (mounted at /api/quizzes) ────────────────────────
export const quizStandaloneRouter = Router();

quizStandaloneRouter.get(
  "/",
  authenticateMiddleware,
  authorizeMiddleware("OPERATION"),
  quizController.list,
);

quizStandaloneRouter.post(
  "/",
  authenticateMiddleware,
  authorizeMiddleware("OPERATION"),
  validateRequest(createQuizSchema),
  quizController.create,
);

// ── AI quiz generation (STORY-45) ──────────────────────────────────────
// Final route: POST /api/quizzes/generate
quizStandaloneRouter.post(
  "/generate",
  authenticateMiddleware,
  authorizeMiddleware("OPERATION"),
  validateRequest(generateQuizSchema),
  quizController.generate,
);

quizStandaloneRouter.get(
  "/essay-grading",
  authenticateMiddleware,
  authorizeMiddleware("OPERATION"),
  attemptsController.getEssayGradingHub,
);

// ── Student quiz-taking (STORY-48) ─────────────────────────────────────
// Static routes must be registered before parameterized /:id routes.
quizStandaloneRouter.get(
  "/student",
  authenticateMiddleware,
  authorizeMiddleware("STUDENT"),
  attemptsController.getStudentQuizList,
);

quizStandaloneRouter.get(
  "/assigned",
  authenticateMiddleware,
  authorizeMiddleware("STUDENT"),
  attemptsController.getAssigned,
);

quizStandaloneRouter.post(
  "/:id/attempt",
  authenticateMiddleware,
  authorizeMiddleware("STUDENT"),
  attemptsController.startAttempt,
);

// ── Nested question routes (mounted at /:quizId/questions) ─────────────
const questionNestedRouter = Router({ mergeParams: true });

questionNestedRouter.patch(
  "/reorder",
  authenticateMiddleware,
  authorizeMiddleware("OPERATION"),
  validateRequest(reorderSchema),
  questionsController.reorderQuestions,
);

questionNestedRouter.post(
  "/",
  authenticateMiddleware,
  authorizeMiddleware("OPERATION"),
  validateRequest(addQuestionSchema),
  questionsController.addQuestion,
);

questionNestedRouter.put(
  "/:qId",
  authenticateMiddleware,
  authorizeMiddleware("OPERATION"),
  validateRequest(updateQuestionSchema),
  questionsController.updateQuestion,
);

questionNestedRouter.delete(
  "/:qId",
  authenticateMiddleware,
  authorizeMiddleware("OPERATION"),
  questionsController.deleteQuestion,
);

// Mount nested question routes BEFORE parameterized /:id routes
quizStandaloneRouter.use("/:quizId/questions", questionNestedRouter);

// ── Teacher quiz results & CSV export (STORY-68) ───────────────────────
// Static sub-paths registered before parameterized /:id routes.
quizStandaloneRouter.get(
  "/:quizId/essay-submissions",
  authenticateMiddleware,
  authorizeMiddleware("OPERATION"),
  attemptsController.getEssaySubmissions,
);

quizStandaloneRouter.get(
  "/:quizId/results/ungraded",
  authenticateMiddleware,
  authorizeMiddleware("OPERATION"),
  attemptsController.getUngradedResults,
);

quizStandaloneRouter.get(
  "/:quizId/results/export",
  authenticateMiddleware,
  authorizeMiddleware("OPERATION"),
  attemptsController.exportResults,
);

// Query params (sortBy/sortOrder) are validated inside the controller because
// Express 5 exposes req.query as a read-only getter (validateRequest can't
// reassign it).
quizStandaloneRouter.get(
  "/:quizId/results",
  authenticateMiddleware,
  authorizeMiddleware("OPERATION"),
  attemptsController.getResults,
);

// ── Publish & Assign ────────────────────────────────────────────────────
quizStandaloneRouter.patch(
  "/:id/publish",
  authenticateMiddleware,
  authorizeMiddleware("OPERATION"),
  validateRequest(publishQuizSchema),
  quizController.publishQuiz,
);

quizStandaloneRouter.post(
  "/:id/unpublish",
  authenticateMiddleware,
  authorizeMiddleware("OPERATION"),
  quizController.unpublishQuiz,
);

quizStandaloneRouter.post(
  "/:id/assign",
  authenticateMiddleware,
  authorizeMiddleware("OPERATION"),
  validateRequest(assignQuizSchema),
  quizController.assignQuiz,
);

// ── Parameterized quiz routes ──────────────────────────────────────────
quizStandaloneRouter.get(
  "/:id",
  authenticateMiddleware,
  authorizeMiddleware("OPERATION"),
  quizController.getById,
);

quizStandaloneRouter.put(
  "/:id",
  authenticateMiddleware,
  authorizeMiddleware("OPERATION"),
  validateRequest(updateQuizSchema),
  quizController.update,
);

quizStandaloneRouter.delete(
  "/:id",
  authenticateMiddleware,
  authorizeMiddleware("OPERATION"),
  quizController.delete,
);

export default quizStandaloneRouter;
