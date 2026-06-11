import { Navigate, Outlet } from 'react-router-dom';
import { useAppSelector } from '@/shared/store/hooks';
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
  const user = useAppSelector((state) => state.auth.user);

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  const routeGroup = serverRoleToRouteGroup[user.role];

  if (!routeGroup || !allowedRoles.includes(routeGroup)) {
    return <Navigate to={dashboardPathByRole[user.role] ?? '/auth'} replace />;
  }

  return <Outlet />;
}
