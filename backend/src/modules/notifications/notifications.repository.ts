import { prisma } from "../../config/database.js";
import type { NotificationType } from "../../generated/prisma/index.js";
import type { Prisma } from "../../generated/prisma/client.js";
import type { NotificationResponseDTO } from "./notifications.types.js";

interface CreateManyInput {
  studentId: string;
  type: NotificationType;
  resourceTitle: string;
  resourceType: string;
  resourceId: string;
  courseContextId?: string | null;
}

function buildWhere(studentId: string, isRead?: boolean): Prisma.NotificationWhereInput {
  const where: Prisma.NotificationWhereInput = { studentId };
  if (isRead !== undefined) {
    where.isRead = isRead;
  }
  return where;
}

export class NotificationsRepository {
  async createMany(data: CreateManyInput[]): Promise<number> {
    if (data.length === 0) return 0;
    const result = await prisma.notification.createMany({ data });
    return result.count;
  }

  async findByStudent(
    studentId: string,
    page: number,
    limit: number,
    isRead?: boolean,
  ): Promise<NotificationResponseDTO[]> {
    const where = buildWhere(studentId, isRead);

    const rows = await prisma.notification.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    });

    return rows as unknown as NotificationResponseDTO[];
  }

  async countByStudent(studentId: string, isRead?: boolean): Promise<number> {
    const where = buildWhere(studentId, isRead);
    return prisma.notification.count({ where });
  }

  async markAsRead(notificationId: string, studentId: string): Promise<void> {
    await prisma.notification.updateMany({
      where: { id: notificationId, studentId },
      data: { isRead: true },
    });
  }

  async markAllAsRead(studentId: string): Promise<void> {
    await prisma.notification.updateMany({
      where: { studentId, isRead: false },
      data: { isRead: true },
    });
  }
}

export const notificationsRepository = new NotificationsRepository();
