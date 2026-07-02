import type { Request, Response, NextFunction } from "express";
import { asyncHandler } from "../../shared/utils/asyncHandler.js";
import { okResponse } from "../../shared/utils/apiResponse.js";
import { EnrollmentService } from "./enrollment.service.js";
import type {
  EnrollmentResponseDTO,
  EnrollmentListItemDTO,
} from "./enrollment.types.js";
import type {
  CreateEnrollmentInput,
  FreeEnrollmentInput,
} from "./enrollment.validation.js";

const enrollmentService = new EnrollmentService();

export class EnrollmentController {
  public create = asyncHandler(
    async (req: Request, res: Response, _next: NextFunction) => {
      const studentId = req.user!.id;
      const input = req.body as CreateEnrollmentInput;

      const enrollment = await enrollmentService.createEnrollment(
        studentId,
        input,
      );

      res
        .status(201)
        .json(okResponse<EnrollmentResponseDTO>(
          "Enrollment created successfully",
          enrollment,
        ));
    },
  );

  public createFree = asyncHandler(
    async (req: Request, res: Response, _next: NextFunction) => {
      const studentId = req.user!.id;
      const { chapterId } = req.body as FreeEnrollmentInput;

      const enrollment = await enrollmentService.enrollFree(
        studentId,
        chapterId,
      );

      res
        .status(201)
        .json(okResponse<EnrollmentResponseDTO>(
          "Enrollment created successfully",
          enrollment,
        ));
    },
  );

  public getMyEnrollments = asyncHandler(
    async (req: Request, res: Response, _next: NextFunction) => {
      const studentId = req.user!.id;

      const enrollments = await enrollmentService.getMyEnrollments(studentId);

      res
        .status(200)
        .json(okResponse<EnrollmentListItemDTO[]>(
          "Enrollments retrieved successfully",
          enrollments,
        ));
    },
  );

  public getStudentEnrollments = asyncHandler(
    async (req: Request, res: Response, _next: NextFunction) => {
      const studentId = req.params.studentId as string;
      const actorId = req.user!.id;
      const actorRole = req.user!.role!;

      const enrollments = await enrollmentService.getStudentEnrollments(
        studentId,
        actorId,
        actorRole,
      );

      res
        .status(200)
        .json(okResponse<EnrollmentListItemDTO[]>(
          "Enrollments retrieved successfully",
          enrollments,
        ));
    },
  );

  public deactivate = asyncHandler(
    async (req: Request, res: Response, _next: NextFunction) => {
      const id = req.params.id as string;
      const actorId = req.user!.id;

      const enrollment = await enrollmentService.deactivateEnrollment(
        id,
        actorId,
      );

      res
        .status(200)
        .json(okResponse<EnrollmentResponseDTO>(
          "Enrollment deactivated successfully",
          enrollment,
        ));
    },
  );
}
