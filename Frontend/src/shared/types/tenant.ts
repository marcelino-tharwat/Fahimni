export interface BrandColors {
  primary: string;
  secondary: string;
  accent: string;
}

export type SubscriptionStatus = 'active' | 'trial' | 'expired' | 'suspended';

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  domain?: string;
  teacherName: string;
  subject: string;
  bio: string;
  logoUrl: string;
  teacherPhotoUrl: string;
  brandColors: BrandColors;
  subscriptionStatus: SubscriptionStatus;
}
