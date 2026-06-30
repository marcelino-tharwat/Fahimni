import { MyCoursesContent } from './MyCoursesContent';

interface MyCoursesTabProps {
  /** Lazily fetch only when the tab is active. */
  active: boolean;
  /** Show the "explore more" section listing chapters the student hasn't joined. */
  showExplore?: boolean;
}

/** My Courses tab inside the dashboard / content page — real backend data only. */
export function MyCoursesTab({ active, showExplore = false }: MyCoursesTabProps) {
  return <MyCoursesContent enabled={active} showExplore={showExplore} />;
}
