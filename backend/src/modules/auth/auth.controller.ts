import type { Request, Response, NextFunction } from "express";
import {
  forgotPasswordSchema,
  registerSchema,
  resetPasswordSchema,
  verifyOtpSchema,
  changePasswordSchema,
} from "./auth.validation.js";
import { AuthService } from "./auth.service.js";
import { loginSchema } from "./auth.validation.js";

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
        res.status(400).json({
          success: false,
          message: "Validation error",
          errors: parsed.error.flatten().fieldErrors,
        });
        return;
      }

      const result = await authService.loginUser(parsed.data);

      res.cookie("access_token", result.accessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        maxAge: 15 * 60 * 1000,
      });

      res.status(200).json({
        message: "Login successful",
        data: {
          user: result.user,
          refreshToken: result.refreshToken,
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
        res.status(400).json({
          success: false,
          message: "Validation error",
          errors: parsed.error.flatten().fieldErrors,
        });
        return;
      }

      const result = await authService.registerUser(parsed.data);

      res.cookie("access_token", result.accessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        maxAge: 15 * 60 * 1000,
      });

      res.status(201).json({
        message: "Registration successful",
        data: {
          user: result.user,
          refreshToken: result.refreshToken,
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
        res.status(400).json({
          success: false,
          message: "Validation error",
          errors: parsed.error.flatten().fieldErrors,
        });
        return;
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
        res.status(400).json({
          success: false,
          message: "Validation error",
          errors: parsed.error.flatten().fieldErrors,
        });
        return;
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
        res.status(400).json({
          success: false,
          message: "Validation error",
          errors: parsed.error.flatten().fieldErrors,
        });
        return;
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
      const { refreshToken } = req.body;
      if (!refreshToken) {
        res.status(400).json({ success: false, message: "Refresh token required" });
        return;
      }

      const result = await authService.refreshAccessToken(refreshToken);

      res.cookie("access_token", result.accessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        maxAge: 15 * 60 * 1000,
      });

      res.status(200).json({
        message: "Token refreshed",
        data: {
          user: result.user,
          refreshToken: result.refreshToken,
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
      res.clearCookie("access_token", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
      });

      res.status(200).json({ message: "Logged out successfully" });
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
        res.status(400).json({
          success: false,
          message: "Validation error",
          errors: parsed.error.flatten().fieldErrors,
        });
        return;
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
}
