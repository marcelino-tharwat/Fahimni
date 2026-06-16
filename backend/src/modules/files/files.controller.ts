import type { Request, Response, NextFunction } from "express";
import { FilesService } from "./files.service.js";

const filesService = new FilesService();

export class FilesController {
  uploadSingle = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const file = req.file;
      if (!file) {
        res.status(400).json({ success: false, message: "No file provided" });
        return;
      }

      const { teacherId, lessonId } = req.body;
      if (!teacherId || !lessonId) {
        res
          .status(400)
          .json({ success: false, message: "teacherId and lessonId are required" });
        return;
      }

      const record = await filesService.uploadAndSave(
        file,
        teacherId,
        lessonId,
      );

      res.status(201).json({ success: true, filePath: record.filePath });
    } catch (error) {
      next(error);
    }
  };

  getSignedUrl = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const path = req.query.path as string | undefined;
      if (!path) {
        res
          .status(400)
          .json({ success: false, message: "path query parameter is required" });
        return;
      }

      const signedUrl = await filesService.getSignedUrl(path);

      res.status(200).json({ signedUrl });
    } catch (error) {
      next(error);
    }
  };

  uploadBatch = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const files = req.files as Express.Multer.File[] | undefined;
      if (!files || files.length === 0) {
        res
          .status(400)
          .json({ success: false, message: "No files provided" });
        return;
      }

      const { teacherId, lessonId } = req.body;
      if (!teacherId || !lessonId) {
        res
          .status(400)
          .json({ success: false, message: "teacherId and lessonId are required" });
        return;
      }

      const records = await Promise.all(
        files.map((f) => filesService.uploadAndSave(f, teacherId, lessonId)),
      );

      res
        .status(201)
        .json({
          success: true,
          files: records.map((r) => r.filePath),
        });
    } catch (error) {
      next(error);
    }
  };
}
