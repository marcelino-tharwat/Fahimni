import express, { type Application } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import authRoutes from "./modules/auth/auth.routes.js";
import userRoutes from "./modules/users/user.routes.js";
import { rateLimiter } from "./shared/middlewares/rateLimiter.middleware.js";
import { errorHandler } from "./shared/middlewares/errorHandler.middleware.js";
import { notFoundHandler } from "./shared/middlewares/notFound.middleware.js";
import studentRoutes from "./modules/students/student.routes.js";
import teacherRoutes from "./modules/teacher/teacher.routes.js";
import quizRoutes from "./modules/quizzes/quizzes.routes.js";

export function createApp(): Application {
  const app = express();
  app.use(helmet());
  app.use(cors());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());
  app.use(rateLimiter);

  app.get("/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  app.use("/api/v1/auth", authRoutes);
  app.use("/api/users", userRoutes);
  app.use("/api/students", studentRoutes);
  app.use("/api/teachers", teacherRoutes);
  app.use("/api/v1/quizzes", quizRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
