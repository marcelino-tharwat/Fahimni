import express, { type Application } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import authRoutes from "./modules/auth/auth.routes.js";
import userRoutes from "./modules/users/user.routes.js";
import { rateLimiter } from "./shared/middlewares/rateLimiter.middleware.js";
import { requestIdMiddleware } from "./shared/middlewares/request-id.middleware.js";
import { requestLoggerMiddleware } from "./shared/middlewares/request-logger.middleware.js";
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
import tutorRouter from "./modules/ai/tutor/tutor.routes.js";
import enrollmentRoutes from "./modules/enrollment/enrollment.routes.js";
import paymentRoutes from "./modules/payment/payment.routes.js";
import promoCodeRoutes from "./modules/promo-code/promo-code.routes.js";
import quizRoutes from "./modules/quizzes/quizzes.routes.js";
import attemptsRoutes from "./modules/quizzes/attempts.routes.js";
import materialsRoutes from "./modules/materials/materials.routes.js";

export function createApp(): Application {
  const app = express();
  app.set("trust proxy", 1);
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
  app.use(requestIdMiddleware);
  app.use(requestLoggerMiddleware);
  app.use(rateLimiter);
  ``;

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
  app.use("/api/tutor", tutorRouter);

  app.use("/api/enrollments", enrollmentRoutes);
  app.use("/api/promo-codes", promoCodeRoutes);

  app.use("/api/payments", paymentRoutes);

  app.use("/api/quizzes", quizRoutes);
  app.use("/api/attempts", attemptsRoutes);
  app.use("/api", materialsRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
