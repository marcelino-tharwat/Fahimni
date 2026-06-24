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
import stageRoutes from "./modules/stage/stage.routes.js";
import { chapterStandaloneRouter } from "./modules/chapter/chapter.routes.js";
import { lessonStandaloneRouter } from "./modules/lessons/lessons.routes.js";
import filesRoutes from "./modules/files/index.js";
import contentRoutes from "./modules/content/content.routes.js";
import dashboardRoutes from "./modules/dashboard/dashboard.routes.js";
import aiRouter from "./modules/ai/ai.routes.js";
import enrollmentRoutes from "./modules/enrollment/enrollment.routes.js";

export function createApp(): Application {
  const app = express();
  app.use(helmet());
  app.use(
    cors({
      origin: "http://localhost:5173",
      credentials: true,
    }),
  );
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
  app.use("/api/stages", stageRoutes);
  app.use("/api/chapters", chapterStandaloneRouter);
  app.use("/api/lessons", lessonStandaloneRouter);
  app.use("/api/v1", filesRoutes);
  app.use("/api/content", contentRoutes);
  app.use("/api/dashboard", dashboardRoutes);
  app.use("/api/ai", aiRouter);

  app.use("/api/enrollments", enrollmentRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
