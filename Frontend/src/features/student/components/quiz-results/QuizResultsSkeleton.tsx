import { Skeleton } from '@/shared/components/ui';

/**
 * Loading placeholder matching the results layout (hero ring + question cards).
 * Available for a future GET-results endpoint; the post-submit flow currently
 * receives its data synchronously via navigation state.
 */
export function QuizResultsSkeleton() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-5">
      <div className="flex flex-col items-center gap-4 rounded-card border border-gray-300 bg-white p-8 shadow-card">
        <Skeleton className="h-[120px] w-[120px] rounded-full" />
        <Skeleton className="h-5 w-48 rounded" />
        <Skeleton className="h-4 w-32 rounded" />
        <div className="grid w-full grid-cols-3 gap-3">
          <Skeleton className="h-20 rounded-xl" />
          <Skeleton className="h-20 rounded-xl" />
          <Skeleton className="h-20 rounded-xl" />
        </div>
      </div>

      {[1, 2, 3].map((i) => (
        <div key={i} className="flex flex-col gap-3 rounded-card border border-gray-300 bg-white p-5 shadow-card">
          <Skeleton className="h-4 w-40 rounded" />
          <Skeleton className="h-5 w-3/4 rounded" />
          <Skeleton className="h-12 w-full rounded-md" />
          <Skeleton className="h-12 w-full rounded-md" />
        </div>
      ))}
    </div>
  );
}
