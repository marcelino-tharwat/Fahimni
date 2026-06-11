import type { Request, Response, NextFunction } from "express";
import { asyncHandler } from "../../shared/utils/asyncHandler.js";
import { okResponse } from "../../shared/utils/apiResponse.js";
import { AppError } from "../../shared/utils/AppError.js";
import { TeacherService } from "./teacher.service.js";
import type { TeacherProfileResponseDTO } from "./teacher.types.js";
import type { UpdateTeacherProfileInput } from "./teacher.validation.js";

const teacherService = new TeacherService();

export class TeacherController {
  public getProfile = asyncHandler(
    async (req: Request, res: Response, _next: NextFunction) => {
      const profile = await teacherService.getProfile(req.user!.id);

      res
        .status(200)
        .json(okResponse<TeacherProfileResponseDTO>(
          "Teacher profile fetched successfully",
          profile,
        ));
    },
  );

  public updateProfile = asyncHandler(
    async (req: Request, res: Response, _next: NextFunction) => {
      const input = req.body as UpdateTeacherProfileInput;
      const updated = await teacherService.updateProfile(req.user!.id, input);

      res
        .status(200)
        .json(okResponse<TeacherProfileResponseDTO>(
          "Teacher profile updated successfully",
          updated,
        ));
    },
  );

  public uploadPhoto = asyncHandler(
    async (req: Request, res: Response, _next: NextFunction) => {
      const file = req.file;
      if (!file) {
        throw new AppError("No photo file provided", 400);
      }

      const updated = await teacherService.uploadPhoto(req.user!.id, file);

      res
        .status(200)
        .json(okResponse<TeacherProfileResponseDTO>(
          "Photo uploaded successfully",
          updated,
        ));
    },
  );

  public uploadLogo = asyncHandler(
    async (req: Request, res: Response, _next: NextFunction) => {
      const file = req.file;
      if (!file) {
        throw new AppError("No logo file provided", 400);
      }

      const updated = await teacherService.uploadLogo(req.user!.id, file);

      res
        .status(200)
        .json(okResponse<TeacherProfileResponseDTO>(
          "Logo uploaded successfully",
          updated,
        ));
    },
  );
}
