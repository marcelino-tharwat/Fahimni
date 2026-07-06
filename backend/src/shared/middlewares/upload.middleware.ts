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

const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter,
});

export const upload = imageUpload;

// ── PDF upload ─────────────────────────────────────────────────────────
const PDF_MAX_FILE_SIZE = 50 * 1024 * 1024;

const pdfFileFilter = (
  _req: Request,
  file: Express.Multer.File,
  cb: FileFilterCallback,
): void => {
  if (file.mimetype === "application/pdf") {
    cb(null, true);
  } else {
    cb(new AppError("Only PDF files are allowed", 400));
  }
};

const pdfUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: PDF_MAX_FILE_SIZE },
  fileFilter: pdfFileFilter,
});

export const uploadSingle = pdfUpload.single("file");
export const uploadBatch = pdfUpload.array("files", 10);

// ── Proof documents upload (teacher registration requests) ──────────────
const PROOF_ALLOWED_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
];

const PROOF_MAX_SIZE = 10 * 1024 * 1024;
const PROOF_MAX_COUNT = 5;

const proofFileFilter = (
  _req: Request,
  file: Express.Multer.File,
  cb: FileFilterCallback,
): void => {
  if (PROOF_ALLOWED_TYPES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new AppError("Only PDF, JPEG, PNG, and WebP files are allowed", 400));
  }
};

const proofUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: PROOF_MAX_SIZE },
  fileFilter: proofFileFilter,
});

export const uploadProofDocuments = proofUpload.array("proofDocuments", PROOF_MAX_COUNT);
