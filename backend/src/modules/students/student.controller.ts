import bcrypt from "bcryptjs";
import type { Request, Response, NextFunction } from "express";
import { prisma } from "../../config/database.js";
import { asyncHandler } from "../../shared/utils/asyncHandler.js";
import { okResponse } from "../../shared/utils/apiResponse.js";
import { AppError } from "../../shared/utils/AppError.js";
import { userPublicFields } from "../users/user.types.js";
import { studentPublicFields } from "./student.types.js";
import { getStudentProfileOverview } from "./student-profile.service.js";
import {
  assertStudentVisibleToTeacher,
  assertStageExistsAndActive,
} from "../teacher-access/teacher-access.service.js";
import type {
  CreateStudentInput,
  UpdateStudentInput,
} from "./student.validation.js";

const Student = prisma.studentProfile;

export class StudentController {

  /**
   * GET /api/students — scoped to students enrolled in at least one chapter
   * belonging to this teacher's stages. The route guard already ensures only
   * OPERATION can reach this handler.
   */
  public list = asyncHandler(
    async (req: Request, res: Response, _next: NextFunction) => {
      const teacherId = req.user!.id;

      const students = await prisma.studentProfile.findMany({
        where: {
          user: {
            enrollments: {
              some: {
                status: "ACTIVE",
                chapter: {
                  deletedAt: null,
                  teacherId,
                },
              },
            },
          },
        },
        select: {
          ...studentPublicFields,
          user: { select: userPublicFields },
          stage: { select: { name: true } },
        },
      });

      res
        .status(200)
        .json(okResponse("Students fetched successfully", students));
    },
  );

  /**
   * GET /api/students/me/profile — the authenticated student's aggregated
   * profile overview (identity, academic progress, courses, subscriptions,
   * achievements). The student id is taken from the auth context only; no id is
   * ever accepted from the request, so a student can only see their own data.
   */
  public getMyProfile = asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
      const studentId = req.user?.id;
      if (!studentId) {
        return next(new AppError("Unauthorized", 401));
      }
      const overview = await getStudentProfileOverview(studentId);
      res.status(200).json(okResponse("Profile fetched successfully", overview));
    },
  );

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

      if (req.user?.role === "OPERATION") {
        await assertStudentVisibleToTeacher(id, req.user.id);
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

      if (req.user?.role === "STUDENT") {
        if (req.user?.id !== id) {
          return next(
            new AppError("You can only update your own profile", 403),
          );
        }
      } else if (req.user?.role === "OPERATION") {
        await assertStudentVisibleToTeacher(id, req.user.id);
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

      // A teacher may only delete a student who is visible to them (has an active
      // enrollment in this teacher's own content). This mirrors the getById/update
      // scoping and prevents deleting another teacher's student. The teacher id is
      // taken from the auth context, never from the request.
      if (req.user?.role === "OPERATION") {
        await assertStudentVisibleToTeacher(id, req.user.id);
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

      // A teacher may only create a student under one of their own stages, so a
      // teacher cannot attach a student to another teacher's stage. The teacher id
      // is taken from the auth context, never from the request body.
      if (req.user?.role === "OPERATION") {
        await assertStageExistsAndActive(stageId);
      }

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
