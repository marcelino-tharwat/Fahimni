import { useRef, type ReactNode } from 'react';
import { useContentProtection } from './useContentProtection';
import { PrivacyBlurOverlay } from './PrivacyBlurOverlay';
import type { ProtectionPolicy } from './protectionTypes';
import { cn } from '@/shared/lib/utils/cn';

interface ProtectedContentProps {
  children: ReactNode;
  policy: ProtectionPolicy;
  className?: string;
}

export function ProtectedContent({ children, policy, className }: ProtectedContentProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useContentProtection(containerRef, policy, true);

  return (
    <div
      ref={containerRef}
      className={cn('relative', className)}
    >
      {children}
      {policy.blurOnHidden && <PrivacyBlurOverlay />}
    </div>
  );
}
