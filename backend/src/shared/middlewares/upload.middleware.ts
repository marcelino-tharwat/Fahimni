import multer, { type FileFilterCallback } from "multer";
import type { Request } from "express";
import { AppError } from "../utils/AppError.js";

const ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
];

const MAX_FILE_SIZE = 5 * 1024 * 1024;

const fileFilter = (
  _req: Request,
  file: Express.Multer.File,
  cb: FileFilterCallback,
): void => {
  if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new AppError("Only image files (JPEG, PNG, GIF, WebP) are allowed", 400));
  }
};

export const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter,
});
