import { Router } from "express";
import { QuizzesController } from "./quizzes.controller.js";
import { QuestionsController } from "./questions.controller.js";
import { authenticateMiddleware } from "../../shared/middlewares/authenticate.middleware.js";
import { authorizeMiddleware } from "../../shared/middlewares/authorize.middleware.js";
import { requireActiveTeacherSubscription } from "../../shared/middlewares/teacher-access.middleware.js";
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
import { resultSettingsSchema } from "./attempts.validation.js";
import { AttemptsController } from "./attempts.controller.js";

const quizController = new QuizzesController();
const questionsController = new QuestionsController();
const attemptsController = new AttemptsController();

// ── Standalone routes (mounted at /api/quizzes) ────────────────────────
export const quizStandaloneRouter = Router();

quizStandaloneRouter.get(
  "/",
  authenticateMiddleware,
  authorizeMiddleware("OPERATION"), requireActiveTeacherSubscription,
  quizController.list,
);

quizStandaloneRouter.post(
  "/",
  authenticateMiddleware,
  authorizeMiddleware("OPERATION"), requireActiveTeacherSubscription,
  validateRequest(createQuizSchema),
  quizController.create,
);

// ── AI quiz generation (STORY-45) ──────────────────────────────────────
// Final route: POST /api/quizzes/generate
quizStandaloneRouter.post(
  "/generate",
  authenticateMiddleware,
  authorizeMiddleware("OPERATION"), requireActiveTeacherSubscription,
  validateRequest(generateQuizSchema),
  quizController.generate,
);

// Curriculum eligibility for the generator UI (source/allocation selection).
// Static path — registered before the parameterized /:id routes below.
quizStandaloneRouter.get(
  "/generator/sources",
  authenticateMiddleware,
  authorizeMiddleware("OPERATION"), requireActiveTeacherSubscription,
  quizController.generatorSources,
);

quizStandaloneRouter.get(
  "/essay-grading",
  authenticateMiddleware,
  authorizeMiddleware("OPERATION"), requireActiveTeacherSubscription,
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
  authorizeMiddleware("OPERATION"), requireActiveTeacherSubscription,
  validateRequest(reorderSchema),
  questionsController.reorderQuestions,
);

questionNestedRouter.post(
  "/",
  authenticateMiddleware,
  authorizeMiddleware("OPERATION"), requireActiveTeacherSubscription,
  validateRequest(addQuestionSchema),
  questionsController.addQuestion,
);

questionNestedRouter.put(
  "/:qId",
  authenticateMiddleware,
  authorizeMiddleware("OPERATION"), requireActiveTeacherSubscription,
  validateRequest(updateQuestionSchema),
  questionsController.updateQuestion,
);

questionNestedRouter.delete(
  "/:qId",
  authenticateMiddleware,
  authorizeMiddleware("OPERATION"), requireActiveTeacherSubscription,
  questionsController.deleteQuestion,
);

// Mount nested question routes BEFORE parameterized /:id routes
quizStandaloneRouter.use("/:quizId/questions", questionNestedRouter);

// ── Teacher quiz results & CSV export (STORY-68) ───────────────────────
// Static sub-paths registered before parameterized /:id routes.
quizStandaloneRouter.get(
  "/:quizId/essay-submissions",
  authenticateMiddleware,
  authorizeMiddleware("OPERATION"), requireActiveTeacherSubscription,
  attemptsController.getEssaySubmissions,
);

quizStandaloneRouter.get(
  "/:quizId/results/ungraded",
  authenticateMiddleware,
  authorizeMiddleware("OPERATION"), requireActiveTeacherSubscription,
  attemptsController.getUngradedResults,
);

quizStandaloneRouter.get(
  "/:quizId/results/export",
  authenticateMiddleware,
  authorizeMiddleware("OPERATION"), requireActiveTeacherSubscription,
  attemptsController.exportResults,
);

// Query params (sortBy/sortOrder) are validated inside the controller because
// Express 5 exposes req.query as a read-only getter (validateRequest can't
// reassign it).
quizStandaloneRouter.get(
  "/:quizId/results",
  authenticateMiddleware,
  authorizeMiddleware("OPERATION"), requireActiveTeacherSubscription,
  attemptsController.getResults,
);

// ── Result-visibility settings (teacher) ───────────────────────────────
// Registered before the parameterized /:id routes so the sub-path wins.
quizStandaloneRouter.get(
  "/:id/result-settings",
  authenticateMiddleware,
  authorizeMiddleware("OPERATION"), requireActiveTeacherSubscription,
  attemptsController.getResultSettings,
);

quizStandaloneRouter.put(
  "/:id/result-settings",
  authenticateMiddleware,
  authorizeMiddleware("OPERATION"), requireActiveTeacherSubscription,
  validateRequest(resultSettingsSchema),
  attemptsController.updateResultSettings,
);

// ── Publish & Assign ────────────────────────────────────────────────────
quizStandaloneRouter.patch(
  "/:id/publish",
  authenticateMiddleware,
  authorizeMiddleware("OPERATION"), requireActiveTeacherSubscription,
  validateRequest(publishQuizSchema),
  quizController.publishQuiz,
);

quizStandaloneRouter.post(
  "/:id/unpublish",
  authenticateMiddleware,
  authorizeMiddleware("OPERATION"), requireActiveTeacherSubscription,
  quizController.unpublishQuiz,
);

quizStandaloneRouter.post(
  "/:id/assign",
  authenticateMiddleware,
  authorizeMiddleware("OPERATION"), requireActiveTeacherSubscription,
  validateRequest(assignQuizSchema),
  quizController.assignQuiz,
);

// ── Parameterized quiz routes ──────────────────────────────────────────
quizStandaloneRouter.get(
  "/:id",
  authenticateMiddleware,
  authorizeMiddleware("OPERATION"), requireActiveTeacherSubscription,
  quizController.getById,
);

quizStandaloneRouter.put(
  "/:id",
  authenticateMiddleware,
  authorizeMiddleware("OPERATION"), requireActiveTeacherSubscription,
  validateRequest(updateQuizSchema),
  quizController.update,
);

quizStandaloneRouter.delete(
  "/:id",
  authenticateMiddleware,
  authorizeMiddleware("OPERATION"), requireActiveTeacherSubscription,
  quizController.delete,
);

export default quizStandaloneRouter;
