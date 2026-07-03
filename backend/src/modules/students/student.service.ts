import bcrypt from "bcryptjs";
import { prisma } from "../../config/database.js";
import { studentPublicFields } from "./student.types.js";
import { userPublicFields } from "../users/user.types.js";
import type { CreateStudentInput, UpdateStudentInput } from "./student.validation.js";
import type { ApiError } from "../../shared/types/common.types.js";

export class StudentService {
  public async list() {
    return prisma.studentProfile.findMany({
      select: { ...studentPublicFields, user: { select: userPublicFields } },
    });
  }

  public async getById(id: string) {
    const profile = await prisma.studentProfile.findUnique({
      where: { userId: id },
      select: { ...studentPublicFields, user: { select: userPublicFields } },
    });

    if (!profile) {
      const error = new Error("Student not found") as ApiError;
      error.status = 404;
      throw error;
    }

    return profile;
  }

  public async create(input: CreateStudentInput) {
    const { fullName, email, password, mobile, stageId } = input;

    const existing = await prisma.user.findFirst({
      where: { OR: [{ email }, { mobile }] },
    });

    if (existing) {
      const error = new Error("Email or mobile number already exists") as ApiError;
      error.status = 409;
      throw error;
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    return prisma.user.create({
      data: {
        fullName,
        email,
        mobile,
        password: hashedPassword,
        role: "STUDENT",
        studentProfile: { create: { stageId } },
      },
      select: { ...userPublicFields, studentProfile: true },
    });
  }

  public async update(id: string, input: UpdateStudentInput) {
    const profile = await prisma.studentProfile.findUnique({ where: { userId: id } });

    if (!profile) {
      const error = new Error("Student not found") as ApiError;
      error.status = 404;
      throw error;
    }

    if (input.email || input.mobile) {
      const duplicate = await prisma.user.findFirst({
        where: {
          OR: [
            ...(input.email ? [{ email: input.email }] : []),
            ...(input.mobile ? [{ mobile: input.mobile }] : []),
          ],
          NOT: { id },
        },
      });

      if (duplicate) {
        const error = new Error("Email or mobile number already in use") as ApiError;
        error.status = 409;
        throw error;
      }
    }

    const data = {
      ...(input.fullName !== undefined && { fullName: input.fullName }),
      ...(input.email !== undefined && { email: input.email }),
      ...(input.mobile !== undefined && { mobile: input.mobile }),
    };

    return prisma.user.update({
      where: { id },
      data,
      select: { ...userPublicFields, studentProfile: true },
    });
  }

  public async delete(id: string) {
    const profile = await prisma.studentProfile.findUnique({ where: { userId: id } });

    if (!profile) {
      const error = new Error("Student not found") as ApiError;
      error.status = 404;
      throw error;
    }

    await prisma.user.delete({ where: { id } });
  }
}
