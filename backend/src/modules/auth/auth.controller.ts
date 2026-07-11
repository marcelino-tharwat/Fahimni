import type { Request, Response, NextFunction } from "express";
import {
  forgotPasswordSchema,
  registerSchema,
  resetPasswordSchema,
  verifyOtpSchema,
  changePasswordSchema,
  updateLocaleSchema,
} from "./auth.validation.js";
import { AuthService } from "./auth.service.js";
import { loginSchema } from "./auth.validation.js";
import {
  REFRESH_COOKIE,
  setAuthCookies,
  clearAuthCookies,
} from "./auth.cookies.js";

const authService = new AuthService();

export class AuthController {
  public login = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const parsed = loginSchema.safeParse(req.body);

      if (!parsed.success) {
        throw parsed.error;
      }

      const result = await authService.loginUser(parsed.data);

      // Both tokens are HttpOnly cookies — the refresh token is never in JSON.
      setAuthCookies(res, result.accessToken, result.refreshToken);

      res.status(200).json({
        message: "Login successful",
        data: {
          user: result.user,
          // Present for all teacher logins:
          //  - TEACHER_PENDING_REVIEW / TEACHER_REJECTED (restricted mode)
          //  - ACTIVE_TEACHER / FREE_TEACHER (approved — normal access)
          ...(result.accessState ? { accessState: result.accessState } : {}),
        },
      });
    } catch (error) {
      next(error);
    }
  };

  public register = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      // Validate request body with Zod schema
      const parsed = registerSchema.safeParse(req.body);

      if (!parsed.success) {
        throw parsed.error;
      }

      // Proof documents (teacher registration) arrive as multipart files; absent
      // for JSON/student registration.
      const files = (req.files as Express.Multer.File[] | undefined) ?? [];
      const result = await authService.registerUser(parsed.data, files);

      // Teacher registration is pending admin review — no session/tokens issued,
      // so the teacher cannot reach any teacher endpoint until approved + active.
      if (result.pending) {
        res.status(201).json({
          message: "تم إرسال طلبك للمراجعة من الإدارة",
          data: {
            user: result.user,
            pendingReview: true,
            trackingReference: result.trackingReference,
          },
        });
        return;
      }

      setAuthCookies(res, result.accessToken, result.refreshToken);

      res.status(201).json({
        message: "Registration successful",
        data: {
          user: result.user,
        },
      });
    } catch (error) {
      // Pass service errors (409, 500, etc.) to the global error handler
      next(error);
    }
  };

  public forgotPassword = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const parsed = forgotPasswordSchema.safeParse(req.body);

      if (!parsed.success) {
        throw parsed.error;
      }

      const response = await authService.forgotPassword(parsed.data);
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  };

  public verifyOtp = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const parsed = verifyOtpSchema.safeParse(req.body);

      if (!parsed.success) {
        throw parsed.error;
      }

      const response = await authService.verifyOtp(parsed.data);
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  };

  public resetPassword = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const parsed = resetPasswordSchema.safeParse(req.body);

      if (!parsed.success) {
        throw parsed.error;
      }

      const response = await authService.resetPassword(parsed.data);
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  };

  public getMe = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const user = await authService.getMe(req.user!.id);

      res.status(200).json({
        message: "Profile retrieved successfully",
        data: { user },
      });
    } catch (error) {
      next(error);
    }
  };

  public refresh = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      // Refresh token comes from the HttpOnly cookie. A legacy body token is
      // still accepted as a transitional fallback (does not block the fix).
      const refreshToken: string | undefined =
        (req.cookies?.[REFRESH_COOKIE] as string | undefined) ??
        (typeof req.body?.refreshToken === "string" ? req.body.refreshToken : undefined);

      if (!refreshToken) {
        res.status(401).json({ success: false, message: "Refresh token required" });
        return;
      }

      const result = await authService.refreshAccessToken(refreshToken);

      // Rotate both cookies; refresh token never appears in JSON.
      setAuthCookies(res, result.accessToken, result.refreshToken);

      res.status(200).json({
        message: "Token refreshed",
        data: {
          user: result.user,
        },
      });
    } catch (err) {
      next(err);
    }
  };

  public logoutUser = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      // Revoke the DB refresh session (idempotent), then clear both cookies
      // with options matching how they were set.
      const refreshToken = req.cookies?.[REFRESH_COOKIE] as string | undefined;
      await authService.logout(refreshToken);
      clearAuthCookies(res);

      res.status(200).json({ message: "Logged out successfully" });
    } catch (error) {
      next(error);
    }
  };

  public googleAuth = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const { credential } = req.body;
      if (!credential || typeof credential !== "string") {
        res.status(400).json({ success: false, message: "Google credential is required" });
        return;
      }

      const result = await authService.googleAuth(credential);

      setAuthCookies(res, result.accessToken, result.refreshToken);

      res.status(200).json({
        message: "Google sign-in successful",
        data: { user: result.user },
      });
    } catch (error) {
      next(error);
    }
  };

  public changePassword = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const parsed = changePasswordSchema.safeParse(req.body);

      if (!parsed.success) {
        throw parsed.error;
      }

      const response = await authService.changePassword(
        req.user!.id,
        parsed.data,
      );
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  };

  public updateLocale = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const parsed = updateLocaleSchema.safeParse(req.body);

      if (!parsed.success) {
        throw parsed.error;
      }

      const user = await authService.updateLocale(req.user!.id, parsed.data);
      res.status(200).json({
        message: "Locale updated successfully",
        data: { user },
      });
    } catch (error) {
      next(error);
    }
  };
}
