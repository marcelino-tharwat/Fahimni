import type { Request, Response, NextFunction } from "express";
import { asyncHandler } from "../../shared/utils/asyncHandler.js";
import { okResponse } from "../../shared/utils/apiResponse.js";
import { materialsService } from "./materials.service.js";

export class MaterialsController {
  downloadMaterial = asyncHandler(
    async (req: Request, res: Response, _next: NextFunction) => {
      const materialId = req.params.materialId as string;
      await materialsService.downloadForStudent(req.user!.id, materialId, res);
    },
  );

  previewMaterial = asyncHandler(
    async (req: Request, res: Response, _next: NextFunction) => {
      const materialId = req.params.materialId as string;
      await materialsService.previewForStudent(req.user!.id, materialId, res);
    },
  );

  getDownloadStatuses = asyncHandler(async (req: Request, res: Response) => {
    const materialId = req.params.materialId as string;
    const data = await materialsService.getDownloadStatusesForTeacher(
      req.user!.id,
      materialId,
    );
    res
      .status(200)
      .json(okResponse("Material download statuses fetched successfully", data));
  });
}
