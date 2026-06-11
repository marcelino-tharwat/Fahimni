import { prisma } from "../../config/database.js";
import { userPublicFields } from "../users/user.types.js";
import { teacherPublicFields } from "./teacher.types.js";
import type { TeacherProfileResponseDTO } from "./teacher.types.js";
import type { UpdateTeacherProfileInput } from "./teacher.validation.js";
import { AppError } from "../../shared/utils/AppError.js";
import { UploadService } from "../../shared/upload.service.js";

type TeacherProfileUpdateData = {
  subject?: string | null;
  bio?: string | null;
  photoUrl?: string | null;
  logoUrl?: string | null;
};

const uploadService = new UploadService();

export class TeacherService {
  public async getProfile(userId: string): Promise<TeacherProfileResponseDTO> {
    const profile = await prisma.teacherProfile.findUnique({
      where: { userId },
      select: {
        ...teacherPublicFields,
        user: { select: userPublicFields },
      },
    });

    if (!profile) {
      throw new AppError("Teacher profile not found", 404);
    }

    return profile as unknown as TeacherProfileResponseDTO;
  }

  public async updateProfile(
    userId: string,
    input: UpdateTeacherProfileInput,
  ): Promise<TeacherProfileResponseDTO> {
    const existing = await prisma.teacherProfile.findUnique({
      where: { userId },
    });

    if (!existing) {
      throw new AppError("Teacher profile not found", 404);
    }

    const data = this.buildUpdateData(input);

    const updated = await prisma.teacherProfile.update({
      where: { userId },
      data,
      select: {
        ...teacherPublicFields,
        user: { select: userPublicFields },
      },
    });

    return updated as unknown as TeacherProfileResponseDTO;
  }

  public async uploadPhoto(
    userId: string,
    file: Express.Multer.File,
  ): Promise<TeacherProfileResponseDTO> {
    const existing = await prisma.teacherProfile.findUnique({
      where: { userId },
    });

    if (!existing) {
      throw new AppError("Teacher profile not found", 404);
    }

    const photoUrl = await uploadService.uploadPhoto(file.buffer);

    const updated = await prisma.teacherProfile.update({
      where: { userId },
      data: { photoUrl },
      select: {
        ...teacherPublicFields,
        user: { select: userPublicFields },
      },
    });

    return updated as unknown as TeacherProfileResponseDTO;
  }

  public async uploadLogo(
    userId: string,
    file: Express.Multer.File,
  ): Promise<TeacherProfileResponseDTO> {
    const existing = await prisma.teacherProfile.findUnique({
      where: { userId },
    });

    if (!existing) {
      throw new AppError("Teacher profile not found", 404);
    }

    const logoUrl = await uploadService.uploadLogo(file.buffer);

    const updated = await prisma.teacherProfile.update({
      where: { userId },
      data: { logoUrl },
      select: {
        ...teacherPublicFields,
        user: { select: userPublicFields },
      },
    });

    return updated as unknown as TeacherProfileResponseDTO;
  }

  private buildUpdateData(
    input: UpdateTeacherProfileInput,
  ): TeacherProfileUpdateData {
    const data: TeacherProfileUpdateData = {};

    if (input.subject !== undefined) {
      data.subject = input.subject === "" ? null : input.subject;
    }
    if (input.bio !== undefined) {
      data.bio = input.bio === "" ? null : input.bio;
    }
    if (input.photoUrl !== undefined) {
      data.photoUrl = input.photoUrl === "" ? null : input.photoUrl;
    }
    if (input.logoUrl !== undefined) {
      data.logoUrl = input.logoUrl === "" ? null : input.logoUrl;
    }

    return data;
  }
}
