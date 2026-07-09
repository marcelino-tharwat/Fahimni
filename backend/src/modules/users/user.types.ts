import type { Role, Status, TeacherApprovalState } from "../../generated/prisma/client.js";

export interface UserRecord {
  id: string;
  fullName: string;
  email: string | null;
  mobile: string;
  role: Role;
  status: Status;
  teacherApprovalState: TeacherApprovalState;
  createdAt: Date;
  updatedAt: Date;
}

export type SafeUserRecord = Omit<UserRecord, "password">;

export const userPublicFields = {
  id: true,
  fullName: true,
  email: true,
  mobile: true,
  role: true,
  status: true,
  teacherApprovalState: true,
  createdAt: true,
  updatedAt: true,
} as const;
