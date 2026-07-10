import type { NotificationType } from "../../generated/prisma/index.js";

export interface CreateNotificationDTO {
  studentId: string;
  type: NotificationType;
  resourceTitle: string;
  resourceType: string;
  resourceId: string;
  courseContextId?: string | null;
}

export interface NotificationResponseDTO {
  id: string;
  type: NotificationType;
  resourceTitle: string;
  resourceType: string;
  resourceId: string;
  courseContextId: string | null;
  isRead: boolean;
  createdAt: Date;
}

export const notificationPublicFields = {
  id: true,
  type: true,
  resourceTitle: true,
  resourceType: true,
  resourceId: true,
  courseContextId: true,
  isRead: true,
  createdAt: true,
} as const;

