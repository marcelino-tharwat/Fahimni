import { cn } from '@/shared/lib/utils/cn';
import { ESSAY_GRADING_NAVY } from '@/features/teacher/components/essay-grading/essayGradingTokens';

export function EssayAvatar({ name, size = 40 }: { name: string; size?: number }) {
  const initials = name
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('');
  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-full font-bold text-white"
      style={{
        width: size,
        height: size,
        fontSize: size <= 44 ? 13 : 17,
        background: ESSAY_GRADING_NAVY,
      }}
      aria-hidden
    >
      {initials}
    </div>
  );
}

type BadgeVariant = 'success' | 'danger' | 'default' | 'info' | 'warning' | 'cyan';

const BADGE_COLORS: Record<BadgeVariant, { bg: string; color: string; border: string }> = {
  success: { bg: '#ECFDF5', color: '#10B981', border: '#A7F3D0' },
  danger: { bg: '#FEF2F2', color: '#EF4444', border: '#FECACA' },
  default: { bg: '#F4F4F4', color: '#6B7280', border: '#E5E7EB' },
  info: { bg: '#F5F3FF', color: '#7C3AED', border: '#DDD6FE' },
  warning: { bg: '#FFFBEB', color: '#F59E0B', border: '#FDE68A' },
  cyan: { bg: 'rgba(0,201,219,.1)', color: '#00C9DB', border: 'rgba(0,201,219,.3)' },
};

export function EssayStatusBadge({
  label,
  variant = 'default',
}: {
  label: string;
  variant?: BadgeVariant;
}) {
  const c = BADGE_COLORS[variant];
  return (
    <span
      className="inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11px] font-semibold"
      style={{ background: c.bg, color: c.color, border: `1px solid ${c.border}` }}
    >
      {label}
    </span>
  );
}

export function EssayBreadcrumb({
  items,
  onNavigate,
}: {
  items: { label: string; active?: boolean; href?: string }[];
  onNavigate?: (href: string) => void;
}) {
  return (
    <nav aria-label="Breadcrumb" className="mb-5 flex flex-wrap items-center gap-1.5">
      {items.map((item, i) => (
        <div key={`${item.label}-${i}`} className="flex items-center gap-1.5">
          {i > 0 && (
            <span className="text-[#C4C9D0]" aria-hidden>
              /
            </span>
          )}
          {item.active || !item.href ? (
            <span className="text-sm font-semibold text-[#1A103D]">{item.label}</span>
          ) : (
            <button
              type="button"
              onClick={() => onNavigate?.(item.href!)}
              className="cursor-pointer text-sm text-[#00C9DB] transition-colors hover:text-[#0CA5AB]"
            >
              {item.label}
            </button>
          )}
        </div>
      ))}
    </nav>
  );
}

export function EssayGradingToast({ message, show }: { message: string; show: boolean }) {
  if (!show) return null;
  return (
    <div
      role="status"
      className="fixed start-1/2 top-20 z-50 flex -translate-x-1/2 items-center gap-3 rounded-xl border border-[#E5E7EB] bg-white px-4 py-3"
      style={{
        boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
        borderInlineStartWidth: 4,
        borderInlineStartColor: '#10B981',
      }}
    >
      <span className="shrink-0 text-[#10B981]" aria-hidden>
        ✓
      </span>
      <p className="text-sm font-medium text-[#1A103D]">{message}</p>
    </div>
  );
}

export function EssayPageShell({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('mx-auto flex w-full max-w-4xl flex-col gap-5', className)}>
      {children}
    </div>
  );
}
