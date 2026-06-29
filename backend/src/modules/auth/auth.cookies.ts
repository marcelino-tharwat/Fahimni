import crypto from "node:crypto";
import type { CookieOptions, Response } from "express";
import { env } from "../../config/env.js";

/**
 * Centralized auth cookie configuration (AUTH refresh repair).
 *
 * One source of truth for the access + refresh cookie names and options so that
 * login, refresh, and logout set and CLEAR cookies with identical attributes
 * (mismatched options are why a cookie can fail to clear on logout).
 *
 * Transport: both tokens are HttpOnly cookies — never JSON, never JS-readable.
 * The refresh cookie is path-scoped to the auth routes that need it so it is not
 * attached to every API request.
 */
export const ACCESS_COOKIE = "access_token";
export const REFRESH_COOKIE = "refresh_token";

/** Refresh cookie path — covers /api/v1/auth/refresh, /logout, /me. */
const REFRESH_COOKIE_PATH = "/api/v1/auth";
const ACCESS_MAX_AGE_MS = 15 * 60 * 1000; // 15m (matches access JWT)
const REFRESH_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7d (matches refresh JWT)

const isProd = env.NODE_ENV === "production";

/**
 * Base cookie options shared by set + clear. SameSite=strict matches the
 * existing app (same-site frontend/backend on localhost ports). In a cross-site
 * production deployment this must become SameSite=None + Secure — documented in
 * the repair report rather than changed blindly here.
 */
const baseOptions: CookieOptions = {
  httpOnly: true,
  secure: isProd,
  sameSite: "strict",
};

const accessOptions: CookieOptions = { ...baseOptions, path: "/" };
const refreshOptions: CookieOptions = { ...baseOptions, path: REFRESH_COOKIE_PATH };

/** Set both auth cookies with their canonical options. */
export function setAuthCookies(
  res: Response,
  accessToken: string,
  refreshToken: string,
): void {
  res.cookie(ACCESS_COOKIE, accessToken, { ...accessOptions, maxAge: ACCESS_MAX_AGE_MS });
  res.cookie(REFRESH_COOKIE, refreshToken, { ...refreshOptions, maxAge: REFRESH_MAX_AGE_MS });
}

/** Refresh only the access cookie (used after a successful token refresh). */
export function setAccessCookie(res: Response, accessToken: string): void {
  res.cookie(ACCESS_COOKIE, accessToken, { ...accessOptions, maxAge: ACCESS_MAX_AGE_MS });
}

/** Clear both auth cookies using options that match how they were set. */
export function clearAuthCookies(res: Response): void {
  res.clearCookie(ACCESS_COOKIE, accessOptions);
  res.clearCookie(REFRESH_COOKIE, refreshOptions);
}

/**
 * Deterministic SHA-256 hash of a refresh token. Only the hash is persisted, so
 * a database leak never exposes usable refresh tokens. Lookups hash the incoming
 * token and compare hashes.
 */
export function hashRefreshToken(rawToken: string): string {
  return crypto.createHash("sha256").update(rawToken).digest("hex");
}
