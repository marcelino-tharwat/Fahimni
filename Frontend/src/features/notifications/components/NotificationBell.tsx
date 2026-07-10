import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { Bell } from 'lucide-react';
import { useUnreadCount, useNotifications, useMarkAsRead } from '../api/notificationsApi';
import { NotificationList } from './NotificationList';

function getDropdownPosition(button: HTMLButtonElement | null): CSSProperties {
  if (!button) return { insetInlineEnd: 16, top: 64 };
  const rect = button.getBoundingClientRect();
  const isRtl = document.dir === 'rtl';
  return {
    top: rect.bottom + 8,
    [isRtl ? 'left' : 'right']: isRtl ? rect.left : window.innerWidth - rect.right,
  };
}

export function NotificationBell() {
  const [isOpen, setIsOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { data: unreadCount = 0 } = useUnreadCount();
  const { data: listData, isLoading } = useNotifications(1, 10);
  const markAsRead = useMarkAsRead();

  useEffect(() => {
    if (!isOpen) return;
    const handlePointer = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('mousedown', handlePointer);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handlePointer);
      document.removeEventListener('keydown', handleKey);
    };
  }, [isOpen]);

  const handleMarkAsRead = (id: string) => {
    markAsRead.mutate(id);
  };

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-label="Notifications"
        aria-expanded={isOpen}
        className="relative rounded-btn p-2 text-navy-600 transition-colors hover:bg-gray-100"
      >
        <Bell size={20} />
        {unreadCount > 0 && (
          <span className="absolute -end-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger-500 px-1 font-cairo text-[10px] font-bold leading-none text-white">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && createPortal(
        <div
          ref={dropdownRef}
          className="fixed z-[100] w-80 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-lg"
          style={getDropdownPosition(buttonRef.current)}
        >
          <div className="border-b border-gray-100 px-4 py-3">
            <h3 className="font-cairo text-sm font-bold text-navy-900">
              الإشعارات
            </h3>
          </div>
          <NotificationList
            notifications={listData?.data}
            isLoading={isLoading}
            onMarkAsRead={handleMarkAsRead}
          />
        </div>,
        document.body,
      )}
    </div>
  );
}
