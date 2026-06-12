import { Router } from 'express';
import { AuthController } from './auth.controller.js';

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

export default router;
