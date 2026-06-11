import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { Tenant } from '@/shared/types';

export interface TenantState {
  currentTenant: Tenant | null;
}

const initialState: TenantState = {
  currentTenant: null,
};

const tenantSlice = createSlice({
  name: 'tenant',
  initialState,
  reducers: {
    setTenant: (state, action: PayloadAction<Tenant>) => {
      state.currentTenant = action.payload;
    },
    clearTenant: (state) => {
      state.currentTenant = null;
    },
  },
});

export const { setTenant, clearTenant } = tenantSlice.actions;

export function applyTenantTheme(tenant: Tenant | null) {
  if (!tenant) return;

  const root = document.documentElement;
  const { primary, secondary, accent } = tenant.brandColors;
  root.style.setProperty('--tenant-primary', primary);
  root.style.setProperty('--tenant-secondary', secondary);
  root.style.setProperty('--tenant-accent', accent);
}

export default tenantSlice.reducer;
