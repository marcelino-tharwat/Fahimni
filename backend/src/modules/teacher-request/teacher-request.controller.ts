import type { Request, Response, NextFunction } from "express";
import { TeacherRequestService } from "./teacher-request.service.js";

const service = new TeacherRequestService();

export class TeacherRequestController {
  create = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const files = (req.files as Express.Multer.File[]) ?? [];
      const result = await service.create(req.body, files);

      res.status(201).json({
        success: true,
        data: {
          publicReference: result.publicReference,
          status: result.status,
          createdAt: result.createdAt,
        },
      });
    } catch (error) {
      next(error);
    }
  };
}
