import { ContentTreePage } from '@/features/teacher/components/content-tree/ContentTreePage';

/**
 * Route component for `/teacher/content/:stageId`.
 * The content-tree UI lives under components/content-tree; this page is a thin
 * wrapper so the route binding stays stable.
 */
export function StageDetailPage() {
  return <ContentTreePage />;
}
