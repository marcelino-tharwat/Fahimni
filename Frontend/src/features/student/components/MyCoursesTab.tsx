import { MyCoursesContent } from './MyCoursesContent';

interface MyCoursesTabProps {
  /** Lazily fetch only when the tab is active. */
  active: boolean;
}

/** My Courses tab inside the All Content page — real backend data only. */
export function MyCoursesTab({ active }: MyCoursesTabProps) {
  return <MyCoursesContent enabled={active} />;
}
