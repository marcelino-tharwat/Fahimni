import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import { env } from "../../config/env.js";
import type { Role } from "../../generated/prisma/client.js";

export class TokenService {
  public generateAccessToken(userId: string, tokenVersion: number) {
    return jwt.sign(
      { sub: userId, ver: tokenVersion },
      env.JWT_SECRET as never,
      {
        expiresIn: env.JWT_EXPIRES_IN as never,
      } as never,
    );
  }

  public generateRegisterToken(userId: string, role: Role, tokenVersion: number) {
    return jwt.sign({ userId, role, ver: tokenVersion }, env.JWT_SECRET, {
      expiresIn: (env.JWT_EXPIRES_IN ?? "30d") as never,
    });
  }

  public generateRefreshToken(userId: string, tokenVersion: number) {
    return jwt.sign(
      { sub: userId, ver: tokenVersion },
      env.JWT_REFRESH_SECRET as never,
      {
        expiresIn: env.JWT_REFRESH_EXPIRES_IN as never,
        // Unique per issuance so two tokens minted in the same second are
        // distinct — required for correct rotation & replay detection.
        jwtid: crypto.randomUUID(),
      } as never,
    );
  }
}
