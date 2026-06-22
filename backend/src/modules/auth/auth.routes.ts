import { Router } from 'express';
import { AuthController } from './auth.controller.js';
import { authenticateMiddleware } from '../../shared/middlewares/authenticate.middleware.js';

const router = Router();
const controller = new AuthController();

// POST /api/v1/auth/login
router.post('/login', controller.login);
// POST /api/v1/auth/register
router.post('/register', controller.register);

// POST /api/v1/auth/forgot-password
router.post('/forgot-password', controller.forgotPassword);

// POST /api/v1/auth/reset-password
router.post('/reset-password', controller.resetPassword);

// POST /api/v1/auth/verify-otp
router.post('/verify-otp', controller.verifyOtp);

// POST /api/v1/auth/refresh
router.post('/refresh', controller.refresh);

// GET /api/v1/auth/me (authenticated)
router.get('/me', authenticateMiddleware, controller.getMe);

// PATCH /api/v1/auth/change-password (authenticated)
router.patch('/change-password', authenticateMiddleware, controller.changePassword);

// POST /api/v1/auth/logout
router.post('/logout', controller.logoutUser);

export default router;
