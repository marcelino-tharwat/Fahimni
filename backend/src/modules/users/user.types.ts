import type { Role, Status } from "../../generated/prisma/client.js";

export interface UserRecord {
  id: string;
  fullName: string;
  email: string | null;
  mobile: string;
  role: Role;
  status: Status;
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
  createdAt: true,
  updatedAt: true,
} as const;
