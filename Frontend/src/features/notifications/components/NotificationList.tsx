import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { FileText, FileQuestion, Loader2 } from 'lucide-react';
import { cn } from '@/shared/lib/utils/cn';
import { EmptyState } from '@/shared/components/ui';
import type { NotificationItem } from '../api/notificationsApi';

const typeIcons = {
  NEW_LESSON: FileText,
  NEW_QUIZ: FileQuestion,
};

const typeColors = {
  NEW_LESSON: 'text-blue-500',
  NEW_QUIZ: 'text-amber-500',
};

const typeRoutes: Record<string, string> = {
  NEW_LESSON: '/student/lessons/',
};

interface NotificationListProps {
  notifications: NotificationItem[] | undefined;
  isLoading: boolean;
  onMarkAsRead: (id: string) => void;
}

export function NotificationList({ notifications, isLoading, onMarkAsRead }: NotificationListProps) {
  const { t } = useTranslation('student');
  const navigate = useNavigate();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 size={20} className="animate-spin text-text-secondary" />
      </div>
    );
  }

  if (!notifications || notifications.length === 0) {
    return (
      <EmptyState
        title={t('notifications.emptyTitle')}
        description={t('notifications.emptyDescription')}
      />
    );
  }

  return (
    <ul className="max-h-80 overflow-y-auto">
      {notifications.map((notification) => {
        const Icon = typeIcons[notification.type] ?? FileText;
        const iconColor = typeColors[notification.type] ?? 'text-text-secondary';
        const messageKey = notification.type === 'NEW_LESSON' ? 'notifications.newLesson' : 'notifications.newQuiz';
        const message = t(messageKey, { title: notification.resourceTitle });
        const route = typeRoutes[notification.type];

        return (
          <li key={notification.id}>
            <button
              type="button"
              onClick={() => {
                if (!notification.isRead) {
                  onMarkAsRead(notification.id);
                }
                if (notification.type === 'NEW_QUIZ') {
                  navigate('/student/quizzes');
                } else if (route) {
                  navigate(`${route}${notification.resourceId}`);
                }
              }}
              className={cn(
                'flex w-full items-start gap-3 px-4 py-3 text-start transition-colors hover:bg-gray-50',
                !notification.isRead && 'bg-cyan-50/40',
              )}
            >
              <Icon size={18} className={cn('mt-0.5 shrink-0', iconColor)} />
              <div className="min-w-0 flex-1">
                <p className={cn(
                  'line-clamp-2 font-cairo text-sm',
                  !notification.isRead ? 'font-bold text-navy-900' : 'font-medium text-text-secondary',
                )}>
                  {message}
                </p>
                <p className="mt-1 font-cairo text-[11px] text-gray-400">
                  {formatRelativeTime(notification.createdAt, t)}
                </p>
              </div>
              {!notification.isRead && (
                <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-cyan-500" />
              )}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function formatRelativeTime(dateString: string, t: (key: string) => string): string {
  const now = Date.now();
  const date = new Date(dateString).getTime();
  const diffMs = now - date;
  const diffMinutes = Math.floor(diffMs / 60000);

  if (diffMinutes < 1) return t('notifications.justNow');
  if (diffMinutes < 60) return `${diffMinutes} ${t('notifications.minutesAgo')}`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours} ${t('notifications.hoursAgo')}`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays} ${t('notifications.daysAgo')}`;

  return new Date(dateString).toLocaleDateString('ar-EG');
}
