import type { Request, Response, NextFunction } from 'express';
import { QuizzesService } from './quizzes.service.js';
import { okResponse } from '../../shared/utils/apiResponse.js';

const quizzesService = new QuizzesService();

export class QuizzesController {
  submitAttempt = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const quizId = req.params.quizId as string | undefined;
      const studentId = req.user?.id;

      if (!quizId) {
        res.status(400).json({ success: false, message: 'Quiz ID is required' });
        return;
      }

      if (!studentId) {
        res.status(401).json({ success: false, message: 'Not authenticated' });
        return;
      }

      const result = await quizzesService.submitAttempt({
        quizId,
        studentId,
        answers: req.body.answers,
      });

      res.status(201).json(okResponse('Quiz submitted and graded successfully', result));
    } catch (error) {
      next(error);
    }
  };
}
