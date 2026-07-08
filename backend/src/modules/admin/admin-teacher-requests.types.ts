export type TeacherRequestStatus = "PENDING" | "APPROVED" | "REJECTED";

export interface ReviewerRef {
  id: string;
  fullName: string;
}

export interface AdminTeacherRequestListItem {
  id: string;
  publicReference: string;
  status: TeacherRequestStatus;
  fullName: string;
  email: string;
  mobile: string;
  specialization: string | null;
  createdAt: string;
  reviewedAt: string | null;
  reviewedBy: ReviewerRef | null;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}
export interface Paginated<T> {
  data: T[];
  meta: PaginationMeta;
}

/**
 * Safe document descriptor — original file name + mime type + availability only.
 * The raw Supabase storage `path`/key is NEVER surfaced; access is exclusively
 * via the short-lived signed-url endpoint.
 */
export interface SafeDocumentRef {
  index: number;
  fileName: string;
  mimeType: string | null;
  status: "AVAILABLE" | "UNAVAILABLE";
}

export interface AdminTeacherRequestDetail {
  request: {
    id: string;
    publicReference: string;
    status: TeacherRequestStatus;
    fullName: string;
    email: string;
    mobile: string;
    specialization: string | null;
    /** Not captured by the current schema — always null (kept for response shape). */
    experience: string | null;
    bio: string | null;
    adminNotes: string | null;
    createdAt: string;
    reviewedAt: string | null;
  };
  documents: SafeDocumentRef[];
  reviewedBy: ReviewerRef | null;
}

export interface SignedUrlResponse {
  url: string;
  expiresIn: number;
}

/**
 * Result of an approval. `accountProvisioning` communicates exactly what happened
 * to teacher-account creation — no password/token is ever returned.
 *  - CREATED_PENDING_PASSWORD_RESET: OPERATION user + TeacherProfile created; the
 *    teacher activates via the existing self-service password-reset (OTP) flow.
 *  - SKIPPED: createAccount=false — request approved, no user created.
 *  - EXISTING_USER_LINKED: an OPERATION user with the same email already exists.
 *  - CONFLICT: email/mobile belongs to a non-matching account — no user created.
 */
export type AccountProvisioning =
  | "CREATED_PENDING_PASSWORD_RESET"
  | "SKIPPED"
  | "EXISTING_USER_LINKED"
  | "CONFLICT";

export interface ApproveResponse {
  request: AdminTeacherRequestListItem;
  accountProvisioning: AccountProvisioning;
  conflictReason: string | null;
  createdTeacherId: string | null;
}

export interface RejectResponse {
  request: AdminTeacherRequestListItem;
}
