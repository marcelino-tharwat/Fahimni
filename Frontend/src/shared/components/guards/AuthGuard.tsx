import { Navigate, Outlet } from 'react-router-dom';
import { useAppSelector } from '@/shared/store/hooks';
import { Spinner } from '@/shared/components/ui';

export function AuthGuard() {
  const { isAuthenticated, status } = useAppSelector((state) => state.auth);

  if (status === 'loading') {
    return (
      <div className="flex h-screen items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/auth" replace />;
  }

  return <Outlet />;
}
