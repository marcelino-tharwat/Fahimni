import { v4 as uuidv4 } from "uuid";
import { prisma } from "../../config/database.js";
import { supabase } from "../../config/supabase.js";
import { logger } from "../../config/logger.js";
import { AppError } from "../../shared/utils/AppError.js";
import type {
  CreateTeacherRequestInput,
  TrackTeacherRequestInput,
} from "./teacher-request.validation.js";

export interface TrackTeacherRequestResult {
  reference: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  submittedAt: string;
  reviewedAt: string | null;
}

const SUPABASE_BUCKET = process.env.SUPABASE_BUCKET_NAME!;
const MAX_REF_RETRIES = 5;

interface ProofFile {
  originalName: string;
  mimeType: string;
  size: number;
  path: string;
}

export class TeacherRequestService {
  async create(
    input: CreateTeacherRequestInput,
    files: Express.Multer.File[],
  ): Promise<{ publicReference: string; status: string; createdAt: Date }> {
    // 1. Check for existing PENDING request with same email
    const pendingEmail = await prisma.teacherRegistrationRequest.findFirst({
      where: { email: input.email, status: "PENDING" },
      select: { id: true },
    });
    if (pendingEmail) {
      throw new AppError("لديك طلب قيد المراجعة بالفعل", 409, "DUPLICATE_PENDING_REQUEST");
    }

    // 2. Check for existing PENDING request with same mobile
    const pendingMobile = await prisma.teacherRegistrationRequest.findFirst({
      where: { mobile: input.mobile, status: "PENDING" },
      select: { id: true },
    });
    if (pendingMobile) {
      throw new AppError("لديك طلب قيد المراجعة بالفعل", 409, "DUPLICATE_PENDING_REQUEST");
    }

    // 3. Check for existing OPERATION user with same email or mobile
    const existingUser = await prisma.user.findFirst({
      where: {
        role: "OPERATION",
        OR: [
          { email: input.email },
          { mobile: input.mobile },
        ],
      },
      select: { id: true },
    });
    if (existingUser) {
      throw new AppError("هذا الحساب مسجل كمدرس بالفعل", 409, "EXISTING_OPERATION_USER");
    }

    // 4. Generate publicReference with retry-on-conflict for concurrency safety.
    //    Random 6-digit suffix avoids race-condition collisions that a count()
    //    query would cause. The DB unique constraint is the final guard; the
    //    retry loop handles the vanishingly unlikely P2002 collision.
    const year = new Date().getFullYear();
    let request: Awaited<ReturnType<typeof prisma.teacherRegistrationRequest.create>>;

    for (let attempt = 0; ; attempt++) {
      const seq = String(100000 + Math.floor(Math.random() * 900000));
      const publicReference = `TR-${year}-${seq}`;

      try {
        request = await prisma.teacherRegistrationRequest.create({
          data: {
            publicReference,
            fullName: input.fullName,
            email: input.email,
            mobile: input.mobile,
            subject: input.subject ?? null,
            bio: input.bio ?? null,
            status: "PENDING",
            proofDocuments: [],
          },
        });
        break;
      } catch (err) {
        const isCollision =
          err != null &&
          typeof err === "object" &&
          "code" in err &&
          (err as Record<string, unknown>).code === "P2002";

        if (!isCollision || attempt >= MAX_REF_RETRIES - 1) {
          throw err;
        }
        logger.warn("public_reference_retry", { attempt: attempt + 1 });
      }
    }

    // 5. Upload proof documents to storage
    const proofDocuments: ProofFile[] = [];
    try {
      for (const file of files) {
        const ext = file.originalname.split(".").pop() ?? "bin";
        const key = `teacher-registration-requests/${request.id}/${uuidv4()}.${ext}`;

        const { error } = await supabase.storage
          .from(SUPABASE_BUCKET)
          .upload(key, file.buffer, { contentType: file.mimetype });

        if (error) {
          throw new AppError("Failed to upload proof documents", 500, "PROOF_UPLOAD_FAILED");
        }

        proofDocuments.push({
          originalName: file.originalname,
          mimeType: file.mimetype,
          size: file.size,
          path: key,
        });
      }
    } catch (uploadError) {
      // Rollback: delete the request record
      await prisma.teacherRegistrationRequest
        .delete({ where: { id: request.id } })
        .catch((err) => {
          logger.warn("cleanup_request_delete_failed", {
            errorName: err instanceof Error ? err.name : "UnknownError",
            referenceId: request.id,
          });
        });

      // Rollback: delete already-uploaded storage files
      for (const doc of proofDocuments) {
        await supabase.storage
          .from(SUPABASE_BUCKET)
          .remove([doc.path])
          .catch((err) => {
            logger.warn("cleanup_storage_remove_failed", {
              errorName: err instanceof Error ? err.name : "UnknownError",
              fileKey: doc.path.split("/").pop(),
            });
          });
      }

      throw uploadError instanceof AppError
        ? uploadError
        : new AppError("Failed to upload proof documents", 500, "PROOF_UPLOAD_FAILED");
    }

    // 6. Update request with proof document metadata
    await prisma.teacherRegistrationRequest.update({
      where: { id: request.id },
      data: { proofDocuments: JSON.parse(JSON.stringify(proofDocuments)) },
    });

    return {
      publicReference: request.publicReference,
      status: "PENDING",
      createdAt: request.createdAt,
    };
  }

  /**
   * Public status lookup. Requires the public reference AND a matching contact
   * (email or mobile) so a bare reference cannot reveal a request's status. A
   * mismatch returns the same 404 as a non-existent reference (no enumeration).
   * Only the safe status fields are returned — never adminNotes, reviewedById,
   * proofDocuments, userId, or storage paths.
   */
  async track(input: TrackTeacherRequestInput): Promise<TrackTeacherRequestResult> {
    const notFound = () =>
      new AppError("لم يتم العثور على طلب مطابق", 404, "TEACHER_REQUEST_NOT_FOUND");

    const request = await prisma.teacherRegistrationRequest.findUnique({
      where: { publicReference: input.reference.trim() },
      select: {
        publicReference: true,
        status: true,
        email: true,
        mobile: true,
        createdAt: true,
        reviewedAt: true,
      },
    });

    if (!request) throw notFound();

    // Constant-shape contact verification: the supplied email/mobile must match
    // the stored record. Requiring reference + contact prevents status leakage.
    const emailMatches =
      input.email != null && request.email.toLowerCase() === input.email.toLowerCase();
    const mobileMatches = input.mobile != null && request.mobile === input.mobile;
    if (!emailMatches && !mobileMatches) throw notFound();

    return {
      reference: request.publicReference,
      status: request.status,
      submittedAt: request.createdAt.toISOString(),
      reviewedAt: request.reviewedAt ? request.reviewedAt.toISOString() : null,
    };
  }
}
