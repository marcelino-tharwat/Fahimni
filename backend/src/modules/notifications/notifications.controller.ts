import type { Request, Response, NextFunction } from "express";
import { asyncHandler } from "../../shared/utils/asyncHandler.js";
import { okResponse } from "../../shared/utils/apiResponse.js";
import { AppError } from "../../shared/utils/AppError.js";
import { notificationsService } from "./notifications.service.js";
import type { NotificationResponseDTO } from "./notifications.types.js";

export class NotificationsController {
  public list = asyncHandler(
    async (req: Request, res: Response, _next: NextFunction) => {
      const studentId = req.user!.id;
      const page = Number(req.query.page) || 1;
      const limit = Number(req.query.limit) || 20;
      const rawIsRead = req.query.isRead;
      const isRead = typeof rawIsRead === "string" ? rawIsRead : undefined;

      const result = await notificationsService.getNotifications(
        studentId,
        page,
        limit,
        isRead,
      );

      res.status(200).json(
        okResponse<{
          data: NotificationResponseDTO[];
          total: number;
          page: number;
          limit: number;
        }>("Notifications fetched successfully", result),
      );
    },
  );

  public getUnreadCount = asyncHandler(
    async (req: Request, res: Response, _next: NextFunction) => {
      const studentId = req.user!.id;
      const count = await notificationsService.getUnreadCount(studentId);

      res.status(200).json(okResponse<{ count: number }>("Unread count fetched", { count }));
    },
  );

  public markAsRead = asyncHandler(
    async (req: Request, res: Response, _next: NextFunction) => {
      const studentId = req.user!.id;
      const id = req.params.id;
      if (typeof id !== "string") {
        throw new AppError("Invalid notification ID", 400);
      }

      await notificationsService.markAsRead(id, studentId);

      res.status(200).json(okResponse("Notification marked as read"));
    },
  );
}
