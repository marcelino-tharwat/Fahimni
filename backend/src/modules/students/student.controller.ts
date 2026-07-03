import bcrypt from "bcryptjs";
import type { Request, Response, NextFunction } from "express";
import { prisma } from "../../config/database.js";
import { getAll } from "../../shared/utils/handlerFactory.js";
import { asyncHandler } from "../../shared/utils/asyncHandler.js";
import { okResponse } from "../../shared/utils/apiResponse.js";
import { AppError } from "../../shared/utils/AppError.js";
import { userPublicFields } from "../users/user.types.js";
import { studentPublicFields } from "./student.types.js";
import type {
  CreateStudentInput,
  UpdateStudentInput,
} from "./student.validation.js";

const Student = prisma.studentProfile;

export class StudentController {
  public list = getAll(Student);

  public getById = asyncHandler(
    async (req: Request, _res: Response, next: NextFunction) => {
      const id = req.params.id;
      if (typeof id !== "string") {
        return next(new AppError("Invalid student ID", 400));
      }

      if (req.user?.role === "STUDENT" && req.user?.id !== id) {
        return next(
          new AppError("You can only view your own profile", 403),
        );
      }

      const profile = await Student.findUnique({
        where: { userId: id },
        select: {
          ...studentPublicFields,
          user: { select: userPublicFields },
          stage: { select: { name: true } },
        },
      });
      if (!profile) {
        return next(new AppError("Student not found", 404));
      }
      _res
        .status(200)
        .json(okResponse("Student fetched successfully", profile));
    },
  );

  public update = asyncHandler(
    async (req: Request, _res: Response, next: NextFunction) => {
      const id = req.params.id;
      if (typeof id !== "string") {
        return next(new AppError("Invalid student ID", 400));
      }

      const profile = await Student.findUnique({ where: { userId: id } });
      if (!profile) {
        return next(new AppError("Student not found", 404));
      }

      if (req.user?.role === "STUDENT" && req.user?.id !== id) {
        return next(
          new AppError("You can only update your own profile", 403),
        );
      }

      const input = req.body as UpdateStudentInput;

      if ("stageId" in req.body) {
        return next(
          new AppError("Stage cannot be changed after registration", 400),
        );
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
          return next(
            new AppError("Email or mobile number already in use", 409),
          );
        }
      }

      const data = {
        ...(input.fullName !== undefined && { fullName: input.fullName }),
        ...(input.email !== undefined && { email: input.email }),
        ...(input.mobile !== undefined && { mobile: input.mobile }),
      };

      const user = await prisma.user.update({
        where: { id },
        data,
        select: {
          ...userPublicFields,
          studentProfile: { include: { stage: { select: { name: true } } } },
        },
      });

      _res.status(200).json(okResponse("Student updated successfully", user));
    },
  );

  public delete = asyncHandler(
    async (req: Request, _res: Response, next: NextFunction) => {
      const id = req.params.id;
      if (typeof id !== "string") {
        return next(new AppError("Invalid student ID", 400));
      }

      const profile = await Student.findUnique({ where: { userId: id } });
      if (!profile) {
        return next(new AppError("Student not found", 404));
      }

      await prisma.user.delete({ where: { id } });

      _res.status(200).json(okResponse("Student deleted successfully"));
    },
  );

  public create = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { fullName, email, password, mobile, stageId } =
        req.body as CreateStudentInput;

      const existing = await prisma.user.findFirst({
        where: { OR: [{ email }, { mobile }] },
      });
      if (existing) {
        return next(new AppError("Email or mobile number already exists", 409));
      }

      const hashedPassword = await bcrypt.hash(password, 10);

      const user = await prisma.user.create({
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

      res.status(201).json(okResponse("Student created successfully", user));
    } catch (error) {
      next(error as Error);
    }
  };
}
