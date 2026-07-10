import { prisma } from "../../config/database.js";
import { notificationsRepository } from "./notifications.repository.js";
import type { NotificationResponseDTO } from "./notifications.types.js";
import type { NotificationType } from "../../generated/prisma/index.js";
import { getIO } from "../../shared/services/socket.service.js";

interface NotifyInput {
  type: NotificationType;
  resourceTitle: string;
  resourceType: string;
  resourceId: string;
  courseContextId?: string | null;
}

export class NotificationsService {
  async notifyChapterEnrolledStudents(
    chapterId: string,
    input: NotifyInput,
  ): Promise<void> {
    const enrollments = await prisma.enrollment.findMany({
      where: { chapterId, status: "ACTIVE" },
      select: { studentId: true },
    });

    if (enrollments.length === 0) return;

    const data = enrollments.map((e) => ({
      studentId: e.studentId,
      type: input.type,
      resourceTitle: input.resourceTitle,
      resourceType: input.resourceType,
      resourceId: input.resourceId,
      courseContextId: input.courseContextId ?? chapterId,
    }));

    await notificationsRepository.createMany(data);

    const targetRooms = enrollments.map((e) => `user:${e.studentId}`);
    try {
      const io = getIO();
      io.to(targetRooms).emit("notification:new");
    } catch {
      // socket not available — fallback to polling
    }
  }

  async getNotifications(
    studentId: string,
    page: number,
    limit: number,
    isRead?: string,
  ): Promise<{ data: NotificationResponseDTO[]; total: number; page: number; limit: number }> {
    const isReadFilter = isRead === "true" ? true : isRead === "false" ? false : undefined;

    const [data, total] = await Promise.all([
      notificationsRepository.findByStudent(studentId, page, limit, isReadFilter),
      notificationsRepository.countByStudent(studentId, isReadFilter),
    ]);

    return { data, total, page, limit };
  }

  async getUnreadCount(studentId: string): Promise<number> {
    return notificationsRepository.countByStudent(studentId, false);
  }

  async markAsRead(notificationId: string, studentId: string): Promise<void> {
    await notificationsRepository.markAsRead(notificationId, studentId);
  }
}

export const notificationsService = new NotificationsService();
