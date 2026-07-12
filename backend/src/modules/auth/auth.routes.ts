import { Router } from 'express';
import { AuthController } from './auth.controller.js';
import { authenticateMiddleware } from '../../shared/middlewares/authenticate.middleware.js';
import { uploadProofDocuments } from '../../shared/middlewares/upload.middleware.js';

const router = Router();
const controller = new AuthController();

// POST /api/v1/auth/login
router.post('/login', controller.login);

// POST /api/v1/auth/google
router.post('/google', controller.googleAuth);
// POST /api/v1/auth/register
// `uploadProofDocuments` parses multipart teacher registrations (proof files land
// in req.files, text fields in req.body); JSON/student registrations pass straight
// through unaffected.
router.post('/register', uploadProofDocuments, controller.register);

// POST /api/v1/auth/forgot-password
router.post('/forgot-password', controller.forgotPassword);

// POST /api/v1/auth/reset-password
router.post('/reset-password', controller.resetPassword);

// POST /api/v1/auth/verify-otp
router.post('/verify-otp', controller.verifyOtp);

// POST /api/v1/auth/verify-email
router.post('/verify-email', controller.verifyEmail);

// POST /api/v1/auth/resend-verification
router.post('/resend-verification', controller.resendVerification);

// POST /api/v1/auth/refresh
router.post('/refresh', controller.refresh);

// GET /api/v1/auth/me (authenticated)
router.get('/me', authenticateMiddleware, controller.getMe);

// PATCH /api/v1/auth/change-password (authenticated)
router.patch('/change-password', authenticateMiddleware, controller.changePassword);

// PATCH /api/v1/auth/locale (authenticated)
router.patch('/locale', authenticateMiddleware, controller.updateLocale);

// POST /api/v1/auth/logout
router.post('/logout', controller.logoutUser);

export default router;
