export interface ActivityItem {
  id: string;
  actionKey: 'upload' | 'enrollment' | 'edit' | 'pdf' | 'delete';
  timestamp: string;
  title?: string;
  formattedTime?: string;
}

export interface GradeEngagement {
  labelKey: string;
  count: number;
  barColor: string;
  percentage: number;
}
