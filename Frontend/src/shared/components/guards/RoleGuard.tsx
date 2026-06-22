import { Navigate, Outlet } from 'react-router-dom';
import { useAppSelector } from '@/shared/store/hooks';
import { Spinner } from '@/shared/components/ui';
import { dashboardPathByRole } from '@/features/auth/store/authSlice';

const serverRoleToRouteGroup: Record<string, string> = {
  STUDENT: 'student',
  OPERATION: 'teacher',
  ADMIN: 'super_admin',
};

interface RoleGuardProps {
  allowedRoles: string[];
}

export function RoleGuard({ allowedRoles }: RoleGuardProps) {
  const { user, status } = useAppSelector((state) => state.auth);

  if (status === 'idle' || status === 'loading') {
    return (
      <div className="flex h-screen items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  const routeGroup = serverRoleToRouteGroup[user.role];

  if (!routeGroup || !allowedRoles.includes(routeGroup)) {
    return <Navigate to={dashboardPathByRole[user.role] ?? '/auth'} replace />;
  }

  return <Outlet />;
}
