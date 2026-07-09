import { Navigate, Outlet } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAppSelector } from '@/shared/store/hooks';
import { Spinner } from '@/shared/components/ui';
import { teacherPlansApi } from '@/features/teacher/api/teacherPlans';

/**
 * Teacher feature access gate (frontend mirror of the backend
 * requireActiveTeacherSubscription middleware). Runs INSIDE RoleGuard(['teacher']),
 * so `user` is an OPERATION teacher.
 *
 *  - PENDING_REVIEW → /teacher/pending-review
 *  - REJECTED       → /teacher/rejected
 *  - APPROVED + ACTIVE subscription → allow feature routes
 *  - APPROVED + no active subscription → /teacher/plans (payment required)
 *
 * The backend enforces the same policy, so this is UX-only convenience.
 */
export function TeacherAccessGuard() {
  const user = useAppSelector((state) => state.auth.user);

  const approvalState = user?.teacherApprovalState;
  const isApproved = approvalState === 'APPROVED';

  // Only query the subscription once we know the teacher is approved.
  const { data, isLoading, isError } = useQuery({
    queryKey: ['teacher', 'subscription', 'me', 'guard'],
    queryFn: teacherPlansApi.getMySubscription,
    enabled: isApproved,
    staleTime: 30_000,
  });

  if (!user) return <Navigate to="/auth" replace />;

  if (approvalState === 'PENDING_REVIEW') {
    return <Navigate to="/teacher/pending-review" replace />;
  }
  if (approvalState === 'REJECTED') {
    return <Navigate to="/teacher/rejected" replace />;
  }
  // A teacher that never entered the approval lifecycle (legacy NONE) is treated
  // as not-yet-approved and sent to the plans/payment page.
  if (!isApproved) {
    return <Navigate to="/teacher/plans" replace />;
  }

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  const hasActiveSubscription = data?.subscription?.status === 'ACTIVE';
  if (isError || !hasActiveSubscription) {
    return <Navigate to="/teacher/plans" replace />;
  }

  return <Outlet />;
}
