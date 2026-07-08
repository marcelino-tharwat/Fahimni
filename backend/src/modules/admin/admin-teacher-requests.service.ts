import crypto from "node:crypto";
import bcrypt from "bcryptjs";
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
  reviewedById: string | null;
  reviewedAt: Date | null;
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
  reviewedById: true,
  reviewedAt: true,
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
    const documents: SafeDocumentRef[] = docs.map((d, index) => ({
      index,
      fileName: d.originalName ?? `document-${index + 1}`,
      mimeType: d.mimeType ?? null,
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

    const createAccount = input.createAccount ?? true;
    let accountProvisioning: ApproveResponse["accountProvisioning"] = "SKIPPED";
    let conflictReason: string | null = null;
    let createdTeacherId: string | null = null;

    // Resolve account-provisioning outcome BEFORE the transaction (read-only checks).
    if (createAccount) {
      const [byEmail, byMobile] = await Promise.all([
        prisma.user.findUnique({ where: { email: row.email }, select: { id: true, role: true } }),
        prisma.user.findUnique({ where: { mobile: row.mobile }, select: { id: true, role: true } }),
      ]);

      if (byEmail) {
        if (byEmail.role === "OPERATION") {
          accountProvisioning = "EXISTING_USER_LINKED";
          createdTeacherId = byEmail.id;
        } else {
          accountProvisioning = "CONFLICT";
          conflictReason = "EMAIL_IN_USE_BY_NON_TEACHER";
        }
      } else if (byMobile) {
        accountProvisioning = "CONFLICT";
        conflictReason = "MOBILE_IN_USE";
      } else {
        accountProvisioning = "CREATED_PENDING_PASSWORD_RESET";
      }
    }

    const updated = await prisma.$transaction(async (tx) => {
      // Provision the teacher account inside the same transaction as the review
      // so a failure rolls the whole approval back.
      if (accountProvisioning === "CREATED_PENDING_PASSWORD_RESET") {
        // Random, un-disclosed password — NEVER returned or logged. The teacher
        // activates their login via the existing self-service password-reset flow.
        const randomPassword = crypto.randomBytes(24).toString("base64url");
        const hashed = await bcrypt.hash(randomPassword, 10);
        const created = await tx.user.create({
          data: {
            fullName: row.fullName,
            email: row.email,
            mobile: row.mobile,
            password: hashed,
            role: "OPERATION",
            status: "ACTIVE",
            teacherProfile: {
              create: {
                subject: row.subject ?? null,
                bio: row.bio ?? null,
              },
            },
          },
          select: { id: true },
        });
        createdTeacherId = created.id;
      }

      const req = await tx.teacherRegistrationRequest.update({
        where: { id: requestId },
        data: {
          status: "APPROVED",
          reviewedById: reviewerId,
          reviewedAt: new Date(),
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
            ...(createdTeacherId ? { createdTeacherId } : {}),
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
      createdTeacherId,
    };
  }

  async reject(requestId: string, reviewerId: string, input: RejectRequestInput): Promise<RejectResponse> {
    const row = await this.loadRequest(requestId);
    if (row.status !== "PENDING") {
      throw new AppError("Only a pending request can be rejected", 409, "REQUEST_NOT_PENDING");
    }

    const updated = await prisma.$transaction(async (tx) => {
      const req = await tx.teacherRegistrationRequest.update({
        where: { id: requestId },
        data: {
          status: "REJECTED",
          reviewedById: reviewerId,
          reviewedAt: new Date(),
          adminNotes: input.adminNotes,
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
          details: { publicReference: req.publicReference },
        },
        tx,
      );
      return req;
    });

    const reviewerName = (await this.reviewerNames([reviewerId])).get(reviewerId) ?? null;
    return { request: this.toListItem(updated, reviewerName) };
  }
}

export const adminTeacherRequestsService = new AdminTeacherRequestsService();
