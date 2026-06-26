import { Router } from 'express';
import { authenticateMiddleware } from '../../shared/middlewares/authenticate.middleware.js';
import { QuizzesController } from './quizzes.controller.js';
import { validateSubmitAttempt } from './quizzes.validation.js';

const router = Router();
const controller = new QuizzesController();

router.post('/:quizId/submit', authenticateMiddleware, validateSubmitAttempt, controller.submitAttempt);

export default router;
