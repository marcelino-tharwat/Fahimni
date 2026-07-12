import { Navigate, Outlet } from 'react-router-dom';
import { useAppSelector } from '@/shared/store/hooks';
import { Spinner } from '@/shared/components/ui';

export function AuthGuard() {
  const { isAuthenticated, status, user } = useAppSelector((state) => state.auth);

  // `idle` = bootstrap (initAuth) hasn't resolved yet on this page load; `loading`
  // = it is in flight. In both cases auth is still UNKNOWN, so we must NOT treat
  // the empty in-memory user as "logged out" and redirect — that was the
  // browser-refresh bug. Only decide once the status is settled.
  if (status === 'idle' || status === 'loading') {
    return (
      <div className="flex h-screen items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/auth" replace />;
  }

  // Belt and suspenders: any stale/edge-case session that reaches the guard
  // with an unverified user is still routed away from protected pages, even
  // though the register/login flows already avoid establishing one.
  if (user && user.emailVerified === false) {
    return <Navigate to="/verify-email-pending" state={{ email: user.email }} replace />;
  }

  return <Outlet />;
}
