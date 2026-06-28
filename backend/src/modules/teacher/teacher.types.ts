import type { Role, Status } from "../../generated/prisma/client.js";

export const teacherPublicFields = {
  id: true,
  userId: true,
  subject: true,
  bio: true,
  photoUrl: true,
  logoUrl: true,
  aiTutorDailyQueryLimit: true,
  createdAt: true,
  updatedAt: true,
} as const;

export interface TeacherProfileResponseDTO {
  id: string;
  userId: string;
  subject: string | null;
  bio: string | null;
  photoUrl: string | null;
  logoUrl: string | null;
  aiTutorDailyQueryLimit: number;
  createdAt: Date;
  updatedAt: Date;
  user: {
    id: string;
    fullName: string;
    email: string;
    mobile: string;
    role: Role;
    status: Status;
    createdAt: Date;
    updatedAt: Date;
  };
}

export type TeacherPublicFields = typeof teacherPublicFields;
