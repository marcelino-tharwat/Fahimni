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
 *  - not approved (legacy NONE) → /teacher/plans
 *  - APPROVED (FREE_PLAN or PAID_PLAN) → allow feature routes
 *
 * An APPROVED teacher WITHOUT a paid subscription is entitled to the FREE plan
 * and is NOT redirected to /teacher/plans — they can still upgrade from there.
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

  // An APPROVED teacher is entitled to at least the FREE plan. Both FREE_PLAN and
  // PAID_PLAN grant feature access; only PENDING/REJECTED/NOT_APPROVED block. On a
  // failed lookup we still allow the approved teacher through (FREE entitlement) —
  // the backend gate remains the authoritative check.
  const blocked =
    data?.accessState === 'PENDING_REVIEW' ||
    data?.accessState === 'REJECTED' ||
    data?.accessState === 'NOT_APPROVED';
  if (!isError && blocked) {
    return <Navigate to="/teacher/plans" replace />;
  }

  return <Outlet />;
}
