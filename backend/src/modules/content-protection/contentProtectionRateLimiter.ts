import rateLimit from "express-rate-limit";

/**
 * Scoped rate limiter for the content-protection events endpoint.
 * Allows up to 20 requests per 60-second window per IP, which is sufficient
 * for reasonable client-side event reporting (copy/paste/print blocks, blur).
 * Blocked requests return a 429 without leaking information to the client.
 */
export const contentProtectionRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many requests, please try again later.",
    status: 429,
  },
});
