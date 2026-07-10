import { prisma } from "../../config/database.js";
import { Prisma } from "../../generated/prisma/client.js";
import { AppError } from "../../shared/utils/AppError.js";
import { logger } from "../../config/logger.js";
import { auditLogService } from "../../shared/services/auditLog.service.js";
import { FilesService } from "../files/files.service.js";
import type {
  AdminTeacherRequestDetail,
  AdminTeacherRequestListItem,
  ApproveResponse,
  Paginated,
  RejectResponse,
  RejectionMode,
  SafeDocumentRef,
  SignedUrlResponse,
  TeacherRequestStatus,
} from "./admin-teacher-requests.types.js";
import type {
  ApproveRequestInput,
  ListTeacherRequestsQuery,
  RejectRequestInput,
} from "./admin-teacher-requests.validation.js";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SIGNED_URL_TTL = 300;

interface ProofDocument {
  originalName?: string;
  mimeType?: string;
  size?: number;
  path?: string;
}

/** Parse the JSON proofDocuments column into a typed array (defensively). */
function parseProofDocuments(value: Prisma.JsonValue | null): ProofDocument[] {
  if (!Array.isArray(value)) return [];
  return (value as unknown[]).filter(
    (v) => v != null && typeof v === "object" && !Array.isArray(v),
  ) as ProofDocument[];
}

/** Map a mime type to a coarse preview hint for the admin UI (no path exposure). */
function previewTypeFor(mimeType: string | null | undefined): "PDF" | "IMAGE" | "OTHER" {
  if (!mimeType) return "OTHER";
  if (mimeType === "application/pdf") return "PDF";
  if (mimeType.startsWith("image/")) return "IMAGE";
  return "OTHER";
}

type RequestRow = {
  id: string;
  publicReference: string;
  status: TeacherRequestStatus;
  fullName: string;
  email: string;
  mobile: string;
  subject: string | null;
  bio: string | null;
  adminNotes: string | null;
  rejectionMode: string | null;
  reviewedById: string | null;
  reviewedAt: Date | null;
  userId: string | null;
  createdAt: Date;
};

const requestSelect = {
  id: true,
  publicReference: true,
  status: true,
  fullName: true,
  email: true,
  mobile: true,
  subject: true,
  bio: true,
  adminNotes: true,
  rejectionMode: true,
  reviewedById: true,
  reviewedAt: true,
  userId: true,
  createdAt: true,
} as const;

/**
 * Admin Teacher Registration Requests review model. ADMIN-only, read + review.
 *
 * SAFE FIELDS ONLY: proofDocuments' raw storage `path`/keys are never returned;
 * document access is exclusively through the short-lived signed-url endpoint.
 * No password / tokenVersion / provider payloads are ever surfaced.
 */
export class AdminTeacherRequestsService {
  constructor(private readonly filesService = new FilesService()) {}

  private toListItem(row: RequestRow, reviewerName: string | null): AdminTeacherRequestListItem {
    return {
      id: row.id,
      publicReference: row.publicReference,
      status: row.status,
      fullName: row.fullName,
      email: row.email,
      mobile: row.mobile,
      specialization: row.subject,
      createdAt: row.createdAt.toISOString(),
      reviewedAt: row.reviewedAt?.toISOString() ?? null,
      reviewedBy:
        row.reviewedById && reviewerName != null
          ? { id: row.reviewedById, fullName: reviewerName }
          : null,
    };
  }

  /** Resolve reviewer display names (id + fullName only) for a set of ids. */
  private async reviewerNames(ids: string[]): Promise<Map<string, string>> {
    const unique = [...new Set(ids)];
    if (unique.length === 0) return new Map();
    const users = await prisma.user.findMany({
      where: { id: { in: unique } },
      select: { id: true, fullName: true },
    });
    return new Map(users.map((u) => [u.id, u.fullName]));
  }

  async listRequests(query: ListTeacherRequestsQuery): Promise<Paginated<AdminTeacherRequestListItem>> {
    const { page, limit, q, status, sortBy, sort } = query;
    const where: Prisma.TeacherRegistrationRequestWhereInput = {
      ...(status ? { status } : {}),
      ...(q
        ? {
            OR: [
              { fullName: { contains: q, mode: "insensitive" } },
              { email: { contains: q, mode: "insensitive" } },
              { mobile: { contains: q } },
              { subject: { contains: q, mode: "insensitive" } },
              { publicReference: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
    };
    const orderBy: Prisma.TeacherRegistrationRequestOrderByWithRelationInput = { [sortBy]: sort };

    const [total, rows] = await prisma.$transaction([
      prisma.teacherRegistrationRequest.count({ where }),
      prisma.teacherRegistrationRequest.findMany({
        where,
        select: requestSelect,
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    const names = await this.reviewerNames(
      rows.map((r) => r.reviewedById).filter((v): v is string => v != null),
    );
    const data = rows.map((r) => this.toListItem(r, r.reviewedById ? names.get(r.reviewedById) ?? null : null));

    return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  private async loadRequest(requestId: string): Promise<RequestRow & { proofDocuments: Prisma.JsonValue }> {
    if (!UUID_RE.test(requestId)) {
      throw new AppError("Teacher request not found", 404, "TEACHER_REQUEST_NOT_FOUND");
    }
    const row = await prisma.teacherRegistrationRequest.findUnique({
      where: { id: requestId },
      select: { ...requestSelect, proofDocuments: true },
    });
    if (!row) {
      throw new AppError("Teacher request not found", 404, "TEACHER_REQUEST_NOT_FOUND");
    }
    return row;
  }

  async getDetail(requestId: string): Promise<AdminTeacherRequestDetail> {
    const row = await this.loadRequest(requestId);
    const docs = parseProofDocuments(row.proofDocuments);
    // Surface EVERY uploaded document (even ones missing a storable path, which
    // render as UNAVAILABLE) so the admin can see the full set. Size + previewType
    // help the UI distinguish PDFs from images; the raw path is never included.
    const documents: SafeDocumentRef[] = docs.map((d, index) => ({
      index,
      fileName: d.originalName ?? `document-${index + 1}`,
      mimeType: d.mimeType ?? null,
      size: typeof d.size === "number" && Number.isFinite(d.size) ? d.size : null,
      previewType: previewTypeFor(d.mimeType),
      status: d.path ? "AVAILABLE" : "UNAVAILABLE",
    }));

    const reviewerName = row.reviewedById
      ? (await this.reviewerNames([row.reviewedById])).get(row.reviewedById) ?? null
      : null;

    return {
      request: {
        id: row.id,
        publicReference: row.publicReference,
        status: row.status,
        fullName: row.fullName,
        email: row.email,
        mobile: row.mobile,
        specialization: row.subject,
        experience: null,
        bio: row.bio,
        adminNotes: row.adminNotes,
        createdAt: row.createdAt.toISOString(),
        reviewedAt: row.reviewedAt?.toISOString() ?? null,
      },
      documents,
      reviewedBy:
        row.reviewedById && reviewerName != null
          ? { id: row.reviewedById, fullName: reviewerName }
          : null,
    };
  }

  /**
   * Signed URL for one proof document. Never returns the raw storage key; the
   * error path never includes the path. Out-of-range / missing-path indices
   * short-circuit to DOCUMENT_UNAVAILABLE without touching external storage.
   */
  async getDocumentSignedUrl(requestId: string, documentIndex: number): Promise<SignedUrlResponse> {
    const row = await this.loadRequest(requestId);
    const docs = parseProofDocuments(row.proofDocuments);

    if (!Number.isInteger(documentIndex) || documentIndex < 0 || documentIndex >= docs.length) {
      throw new AppError("Document is not available", 404, "DOCUMENT_UNAVAILABLE");
    }
    const doc = docs[documentIndex]!;
    if (!doc.path) {
      throw new AppError("Document is not available", 404, "DOCUMENT_UNAVAILABLE");
    }

    try {
      const url = await this.filesService.getSignedUrl(doc.path, SIGNED_URL_TTL);
      return { url, expiresIn: SIGNED_URL_TTL };
    } catch (err) {
      // Never expose the storage path/key in the error; log the failure name only.
      logger.warn("teacher_request_document_sign_failed", {
        requestId,
        documentIndex,
        errorName: err instanceof Error ? err.name : "UnknownError",
      });
      throw new AppError("Document is not available", 409, "DOCUMENT_UNAVAILABLE");
    }
  }

  async approve(requestId: string, reviewerId: string, input: ApproveRequestInput): Promise<ApproveResponse> {
    const row = await this.loadRequest(requestId);
    if (row.status !== "PENDING") {
      throw new AppError("Only a pending request can be approved", 409, "REQUEST_NOT_PENDING");
    }

    // Resolve which teacher user (if any) to activate — NO random password is ever
    // generated. Preferred path: the request is linked (userId) to the pending user
    // created at unified registration. Legacy fallback: link an existing OPERATION
    // user with the same email; otherwise approve the request only.
    let accountProvisioning: ApproveResponse["accountProvisioning"];
    let conflictReason: string | null = null;
    let teacherUserId: string | null = null;

    if (row.userId) {
      accountProvisioning = "APPROVED_LINKED_USER_PAYMENT_REQUIRED";
      teacherUserId = row.userId;
    } else {
      const byEmail = await prisma.user.findUnique({
        where: { email: row.email },
        select: { id: true, role: true },
      });
      if (byEmail && byEmail.role === "OPERATION") {
        accountProvisioning = "EXISTING_USER_LINKED";
        teacherUserId = byEmail.id;
      } else if (byEmail) {
        accountProvisioning = "CONFLICT";
        conflictReason = "EMAIL_IN_USE_BY_NON_TEACHER";
      } else {
        // No safe user to provision without inventing a password → manual follow-up.
        accountProvisioning = "LEGACY_MANUAL_PROVISIONING_REQUIRED";
      }
    }

    const updated = await prisma.$transaction(async (tx) => {
      // Activate the linked/existing teacher: APPROVED + ACTIVE so they can log in
      // and reach the payment gate. Password is left untouched.
      if (teacherUserId) {
        await tx.user.update({
          where: { id: teacherUserId },
          data: { teacherApprovalState: "APPROVED", status: "ACTIVE" },
        });
      }

      const req = await tx.teacherRegistrationRequest.update({
        where: { id: requestId },
        data: {
          status: "APPROVED",
          reviewedById: reviewerId,
          reviewedAt: new Date(),
          // Backfill the link when we resolved an existing user for a legacy request.
          ...(row.userId ? {} : teacherUserId ? { userId: teacherUserId } : {}),
          ...(input.adminNotes !== undefined ? { adminNotes: input.adminNotes } : {}),
        },
        select: requestSelect,
      });

      await auditLogService.record(
        {
          action: "TEACHER_REQUEST_APPROVED",
          resourceType: "TeacherRegistrationRequest",
          resourceId: requestId,
          actorId: reviewerId,
          actorType: "ADMIN",
          details: {
            publicReference: req.publicReference,
            accountProvisioning,
            ...(teacherUserId ? { teacherUserId } : {}),
            ...(conflictReason ? { conflictReason } : {}),
          },
        },
        tx,
      );

      return req;
    });

    const reviewerName = (await this.reviewerNames([reviewerId])).get(reviewerId) ?? null;
    return {
      request: this.toListItem(updated, reviewerName),
      accountProvisioning,
      conflictReason,
      createdTeacherId: teacherUserId,
      paymentRequired: teacherUserId !== null,
      teacherUserId,
      teacherApprovalState: teacherUserId ? "APPROVED" : null,
      userStatus: teacherUserId ? "ACTIVE" : null,
    };
  }

  async reject(requestId: string, reviewerId: string, input: RejectRequestInput): Promise<RejectResponse> {
    const row = await this.loadRequest(requestId);
    if (row.status !== "PENDING") {
      throw new AppError("Only a pending request can be rejected", 409, "REQUEST_NOT_PENDING");
    }

    const updated = await prisma.$transaction(async (tx) => {
      // Block the linked teacher account (if any): REJECTED + INACTIVE but keep
      // them able to login for review-status page.
      if (row.userId) {
        await tx.user.update({
          where: { id: row.userId },
          data: { teacherApprovalState: "REJECTED", status: "INACTIVE" },
        });
      }

      const req = await tx.teacherRegistrationRequest.update({
        where: { id: requestId },
        data: {
          status: "REJECTED",
          reviewedById: reviewerId,
          reviewedAt: new Date(),
          adminNotes: input.adminNotes,
          rejectionMode: input.rejectionMode,
        },
        select: requestSelect,
      });
      await auditLogService.record(
        {
          action: "TEACHER_REQUEST_REJECTED",
          resourceType: "TeacherRegistrationRequest",
          resourceId: requestId,
          actorId: reviewerId,
          actorType: "ADMIN",
          details: {
            publicReference: req.publicReference,
            rejectionMode: input.rejectionMode,
            ...(row.userId ? { teacherUserId: row.userId } : {}),
          },
        },
        tx,
      );
      return req;
    });

    const reviewerName = (await this.reviewerNames([reviewerId])).get(reviewerId) ?? null;
    return { request: this.toListItem(updated, reviewerName), rejectionMode: updated.rejectionMode as RejectResponse["rejectionMode"] };
  }
}

export const adminTeacherRequestsService = new AdminTeacherRequestsService();
