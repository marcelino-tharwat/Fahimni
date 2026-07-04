import type { Request, Response, NextFunction } from "express";
import { prisma } from "../../config/database.js";
import { FilesService } from "./files.service.js";
import { assertMaterialPathOwnedByTeacher } from "../materials/material-access.service.js";

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

      const { lessonId } = req.body;
      if (!lessonId) {
        res
          .status(400)
          .json({ success: false, message: "lessonId is required" });
        return;
      }

      const { record, indexingStatus } = await filesService.uploadAndSave(
        file,
        req.user!.id,
        lessonId,
      );

      res.status(201).json({ success: true, filePath: record.filePath, indexingStatus });
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

      await assertMaterialPathOwnedByTeacher(req.user!.id, path);
      const signedUrl = await filesService.getSignedUrl(path, 600);

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

      const { lessonId } = req.body;
      if (!lessonId) {
        res
          .status(400)
          .json({ success: false, message: "lessonId is required" });
        return;
      }

      const results = await Promise.all(
        files.map((f) => filesService.uploadAndSave(f, req.user!.id, lessonId)),
      );

      res
        .status(201)
        .json({
          success: true,
          files: results.map((r) => ({ filePath: r.record.filePath, indexingStatus: r.indexingStatus })),
        });
    } catch (error) {
      next(error);
    }
  };

  delete = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const path = req.query.path as string | undefined;
      if (!path) {
        res.status(400).json({ success: false, message: "path query parameter is required" });
        return;
      }

      await filesService.deleteFile(path);

      await prisma.lessonMaterial.updateMany({
        where: { filePath: path, deletedAt: null },
        data: { deletedAt: new Date() },
      });

      res.status(200).json({ success: true, message: "File deleted successfully" });
    } catch (error) {
      next(error);
    }
  };
}
