import { useEffect, useRef, useCallback } from 'react';
import { useAppDispatch } from '@/shared/store/hooks';
import { addToast } from '@/shared/store/slices/toastSlice';
import type { ProtectionPolicy, BlockedAction } from './protectionTypes';
import { BLOCKED_MESSAGES } from './protectionTypes';

const TOAST_RATE_LIMIT_MS = 3000;

function isCtrlCmd(e: KeyboardEvent): boolean {
  return e.ctrlKey || e.metaKey;
}

export function useContentProtection(
  containerRef: { current: HTMLElement | null },
  policy: ProtectionPolicy,
  enabled: boolean = true,
) {
  const dispatch = useAppDispatch();
  const lastToastRef = useRef<Partial<Record<BlockedAction, number>>>({});
  const policyRef = useRef<ProtectionPolicy>(policy);

  useEffect(() => {
    policyRef.current = policy;
  }, [policy]);

  const showBlockedToast = useCallback(
    (action: BlockedAction) => {
      const now = Date.now();
      const last = lastToastRef.current[action] ?? 0;
      if (now - last < TOAST_RATE_LIMIT_MS) return;
      lastToastRef.current[action] = now;

      dispatch(
        addToast({
          type: 'warning',
          message: BLOCKED_MESSAGES[action],
        }),
      );
    },
    [dispatch],
  );

  useEffect(() => {
    if (!enabled) return;

    const container = containerRef.current;
    if (!container) return;

    const handleCopy = (e: ClipboardEvent) => {
      if (policyRef.current.disableCopy) {
        e.preventDefault();
        showBlockedToast('copy');
      }
    };

    const handleCut = (e: ClipboardEvent) => {
      if (policyRef.current.disableCut) {
        e.preventDefault();
        showBlockedToast('cut');
      }
    };

    const handlePaste = (e: ClipboardEvent) => {
      if (policyRef.current.disablePaste) {
        e.preventDefault();
        showBlockedToast('paste');
      }
    };

    const handleContextMenu = (e: MouseEvent) => {
      if (policyRef.current.disableContextMenu) {
        e.preventDefault();
        showBlockedToast('contextmenu');
      }
    };

    const handleSelectStart = (e: Event) => {
      if (policyRef.current.disableSelection) {
        e.preventDefault();
      }
    };

    const handleDragStart = (e: DragEvent) => {
      if (policyRef.current.disableDragStart) {
        e.preventDefault();
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isCtrlCmd(e)) return;
      const key = e.key.toLowerCase();

      const p = policyRef.current;

      if (key === 'c' && p.disableCopy) {
        e.preventDefault();
        showBlockedToast('copy');
      } else if (key === 'x' && p.disableCut) {
        e.preventDefault();
        showBlockedToast('cut');
      } else if (key === 'v' && p.disablePaste) {
        e.preventDefault();
        showBlockedToast('paste');
      } else if (key === 'p' && p.disablePrint) {
        e.preventDefault();
        showBlockedToast('print');
      } else if (key === 's' && (p.disableCopy || p.disablePrint)) {
        e.preventDefault();
      } else if (key === 'u' && (p.disableCopy || p.disablePrint)) {
        e.preventDefault();
      }
    };

    container.addEventListener('copy', handleCopy);
    container.addEventListener('cut', handleCut);
    container.addEventListener('paste', handlePaste);
    container.addEventListener('contextmenu', handleContextMenu);
    container.addEventListener('selectstart', handleSelectStart);
    container.addEventListener('dragstart', handleDragStart);
    container.addEventListener('keydown', handleKeyDown);

    let printOverlay: HTMLDivElement | null = null;

    const handleBeforePrint = () => {
      if (!policyRef.current.disablePrint) return;

      showBlockedToast('print');

      printOverlay = document.createElement('div');
      printOverlay.id = 'print-protection-overlay';
      printOverlay.style.cssText = [
        'position: fixed; inset: 0; z-index: 999999;',
        'background: white; display: flex;',
        'align-items: center; justify-content: center;',
        'font-size: 24px; font-family: sans-serif; direction: rtl;',
      ].join(' ');
      printOverlay.textContent = BLOCKED_MESSAGES.print;
      document.body.appendChild(printOverlay);
    };

    const handleAfterPrint = () => {
      if (printOverlay && printOverlay.parentNode) {
        printOverlay.parentNode.removeChild(printOverlay);
        printOverlay = null;
      }
    };

    window.addEventListener('beforeprint', handleBeforePrint);
    window.addEventListener('afterprint', handleAfterPrint);

    if (policy.disableSelection) {
      container.style.userSelect = 'none';
      container.style.webkitUserSelect = 'none';
    }

    return () => {
      container.removeEventListener('copy', handleCopy);
      container.removeEventListener('cut', handleCut);
      container.removeEventListener('paste', handlePaste);
      container.removeEventListener('contextmenu', handleContextMenu);
      container.removeEventListener('selectstart', handleSelectStart);
      container.removeEventListener('dragstart', handleDragStart);
      container.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('beforeprint', handleBeforePrint);
      window.removeEventListener('afterprint', handleAfterPrint);
      if (printOverlay && printOverlay.parentNode) {
        printOverlay.parentNode.removeChild(printOverlay);
      }
      container.style.userSelect = '';
      container.style.webkitUserSelect = '';
    };
  }, [enabled, containerRef, showBlockedToast, policy.disableSelection]);
}
