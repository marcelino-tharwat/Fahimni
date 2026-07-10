import { Server as HTTPServer } from "http";
import { Server, type Socket } from "socket.io";
import jwt from "jsonwebtoken";
import { env } from "../../config/env.js";
import { prisma } from "../../config/database.js";

let io: Server | null = null;

export function getIO(): Server {
  if (!io) {
    throw new Error("Socket.IO not initialized. Call initializeSocket first.");
  }
  return io;
}

export function initializeSocket(httpServer: HTTPServer): Server {
  io = new Server(httpServer, {
    cors: {
      origin: env.FRONTEND_BASE_URL,
      credentials: true,
    },
    pingInterval: 25_000,
    pingTimeout: 20_000,
  });

  io.use(async (socket: Socket, next) => {
    try {
      const cookieHeader = socket.handshake.headers.cookie ?? "";
      const cookies = parseCookies(cookieHeader);
      const token = cookies.access_token;
      const authUserId = socket.handshake.auth?.userId as string | undefined;

      if (!token) {
        return next(new Error("Authentication required"));
      }

      let decoded: jwt.JwtPayload;
      try {
        decoded = jwt.verify(token, env.JWT_SECRET) as jwt.JwtPayload;
      } catch {
        return next(new Error("Invalid or expired token"));
      }

      const userId = (decoded.sub ?? decoded.userId) as string | undefined;
      if (!userId || typeof userId !== "string") {
        return next(new Error("Invalid token payload"));
      }

      if (authUserId && authUserId !== userId) {
        return next(new Error("User ID mismatch"));
      }

      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, role: true },
      });

      if (!user) {
        return next(new Error("User not found"));
      }

      socket.data.user = { id: user.id, role: user.role };
      next();
    } catch {
      next(new Error("Authentication failed"));
    }
  });

  io.on("connection", (socket: Socket) => {
    const user = socket.data.user as { id: string; role: string };
    const room = `user:${user.id}`;
    socket.join(room);

    socket.on("disconnect", () => {
      socket.leave(room);
    });
  });

  return io;
}

function parseCookies(cookieHeader: string): Record<string, string> {
  const result: Record<string, string> = {};
  cookieHeader.split(";").forEach((pair) => {
    const idx = pair.indexOf("=");
    if (idx !== -1) {
      const key = pair.substring(0, idx).trim();
      const value = pair.substring(idx + 1).trim();
      if (key) result[key] = value;
    }
  });
  return result;
}
