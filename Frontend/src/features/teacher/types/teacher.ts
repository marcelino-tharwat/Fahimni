/**
 * Teacher profile types — mirror the backend DTO from
 * backend/src/modules/teacher/teacher.types.ts exactly.
 *
 * Dates arrive as ISO strings over the wire (the backend serialises
 * `Date` to JSON), so they are typed as `string` here.
 */

/** The nested `user` object embedded in a teacher profile response. */
export interface TeacherProfileUser {
  id: string;
  fullName: string;
  email: string;
  mobile: string;
  role: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

/** Shape of `data` returned by the teacher profile endpoints. */
export interface TeacherProfile {
  id: string;
  userId: string;
  subject: string | null;
  bio: string | null;
  photoUrl: string | null;
  logoUrl: string | null;
  createdAt: string;
  updatedAt: string;
  user: TeacherProfileUser;
}

/**
 * Body accepted by `PUT /teachers/profile`.
 *
 * NOTE: the backend's update service currently only persists
 * `subject` / `bio` (plus photoUrl/logoUrl via the dedicated upload
 * routes). `fullName` / `email` / `mobile` are validated and accepted
 * with a 200 response but are NOT written to the User record yet.
 */
export interface UpdateTeacherProfileInput {
  fullName?: string;
  email?: string;
  mobile?: string;
  subject?: string;
  bio?: string;
}

/** Standard success envelope used by the backend (shared/utils/apiResponse.ts). */
export interface TeacherApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
}

/** Standard error envelope. `errors` is present on Zod validation failures. */
export interface TeacherApiError {
  success: false;
  message: string;
  errors?: Record<string, string[]>;
}

export type TeacherProfileResponse = TeacherApiResponse<TeacherProfile>;
