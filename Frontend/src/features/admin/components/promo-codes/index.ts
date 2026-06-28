// Barrel for the admin promo-codes feature components (SCRUM-425).
//
// Note: the Phase 3A/3B component prop interfaces (StatCardsProps, CodeChipProps,
// FilterTabsProps, PaginationProps, PromoCodeTableProps) are declared locally and
// NOT exported from their modules, so they cannot be re-exported here without
// editing those (out-of-scope) files. Only `FilterValue` and the two modal prop
// interfaces are exported types.

export { StatCards } from './StatCards';

export { CodeChip } from './CodeChip';

export { FilterTabs } from './FilterTabs';
export type { FilterValue } from './FilterTabs';

export { PromoCodeTable } from './PromoCodeTable';

export { Pagination } from './Pagination';

export { GenerateConfirmModal } from './GenerateConfirmModal';
export type { GenerateConfirmModalProps } from './GenerateConfirmModal';

export { GenerateSuccessModal } from './GenerateSuccessModal';
export type { GenerateSuccessModalProps } from './GenerateSuccessModal';
