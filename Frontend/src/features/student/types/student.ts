export interface StudentProfileUser {
  id: string;
  fullName: string;
  email: string;
  mobile: string;
  role: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface StudentProfile {
  id: string;
  userId: string;
  createdAt: string;
  updatedAt: string;
  user: StudentProfileUser;
}

export interface UpdateStudentProfileInput {
  fullName?: string;
  email?: string;
  mobile?: string;
}

export interface ChangePasswordInput {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

export interface EnrollmentRecord {
  id: string;
  chapterName: string;
  month: string;
  year: number;
  status: 'Active' | 'Inactive';
}

export interface StudentApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
}
