import { applyTenantTheme, setTenant } from '@/features/tenant/store/tenantSlice';
import { useAppDispatch, useAppSelector } from '@/shared/store/hooks';

export function useTenant() {
  const dispatch = useAppDispatch();
  const currentTenant = useAppSelector((state) => state.tenant.currentTenant);

  return {
    tenant: currentTenant,
    setTenant: (tenant: Parameters<typeof setTenant>[0]) => dispatch(setTenant(tenant)),
    applyTheme: () => applyTenantTheme(currentTenant),
  };
}
