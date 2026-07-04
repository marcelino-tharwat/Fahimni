import { Navigate, Outlet } from 'react-router-dom';
import { useAppSelector } from '@/shared/store/hooks';
import { Spinner } from '@/shared/components/ui';
import { dashboardPathByRole } from '@/features/auth/store/authSlice';

export function GuestGuard() {
  const { user, isAuthenticated, status } = useAppSelector(
    (state) => state.auth,
  );

  if (status === 'idle' || status === 'loading') {
    return (
      <div className="flex h-screen items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  if (isAuthenticated && user) {
    return <Navigate to={dashboardPathByRole[user.role] ?? '/auth'} replace />;
  }

  return <Outlet />;
}
