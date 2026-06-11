import { useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { applyTenantTheme, setTenant } from '@/features/tenant/store/tenantSlice';
import { useAppDispatch, useAppSelector } from '@/shared/store/hooks';
import { mockTenant } from '@/shared/mocks/tenant';

export function TenantGuard() {
  const dispatch = useAppDispatch();
  const currentTenant = useAppSelector((state) => state.tenant.currentTenant);

  useEffect(() => {
    if (!currentTenant) {
      // TODO: resolve the real tenant from the subdomain/path; mock for now.
      dispatch(setTenant(mockTenant));
      applyTenantTheme(mockTenant);
    }
  }, [currentTenant, dispatch]);

  return <Outlet />;
}
