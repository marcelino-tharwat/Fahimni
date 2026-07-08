export type TeacherRequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export type AccountProvisioning =
  | 'CREATED_PENDING_PASSWORD_RESET'
  | 'SKIPPED'
  | 'EXISTING_USER_LINKED'
  | 'CONFLICT';

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

export interface SafeDocumentRef {
  index: number;
  fileName: string;
  mimeType: string | null;
  status: 'AVAILABLE' | 'UNAVAILABLE';
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

export interface ApproveResponse {
  request: AdminTeacherRequestListItem;
  accountProvisioning: AccountProvisioning;
  conflictReason: string | null;
  createdTeacherId: string | null;
}

export interface TeacherRequestsQuery {
  page?: number;
  limit?: number;
  q?: string;
  status?: TeacherRequestStatus;
  sortBy?: 'createdAt' | 'reviewedAt' | 'fullName' | 'status';
  sort?: 'asc' | 'desc';
}
