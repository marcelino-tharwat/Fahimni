import { useTranslation } from 'react-i18next';
import type { TutorConversationSummary } from '@/shared/types/aiTutor';
import { Spinner } from '@/shared/components/ui';
import styles from './ConversationList.module.css';

interface ConversationListProps {
  conversations: TutorConversationSummary[];
  activeId?: string;
  loading?: boolean;
  error?: boolean;
  hasMore?: boolean;
  showArchived?: boolean;
  onSelect: (id: string) => void;
  onToggleArchiveFilter: () => void;
  onLoadMore?: () => void;
  onRetry?: () => void;
}

export function ConversationList({
  conversations,
  activeId,
  loading,
  error,
  hasMore,
  showArchived,
  onSelect,
  onToggleArchiveFilter,
  onLoadMore,
  onRetry,
}: ConversationListProps) {
  const { t } = useTranslation('student');

  return (
    <>
      <div className={styles.toolbar}>
        <span className={styles.toolbarTitle}>{t('aiTutor.history')}</span>
        <button type="button" className={styles.filterBtn} onClick={onToggleArchiveFilter}>
          {showArchived ? t('aiTutor.showActive') : t('aiTutor.showArchived')}
        </button>
      </div>
      <div className={styles.list}>
        {loading && conversations.length === 0 && <Spinner className="mx-auto" />}
        {error && (
          <div className={styles.empty}>
            <p>{t('aiTutor.historyError')}</p>
            {onRetry && (
              <button type="button" className={styles.filterBtn} onClick={onRetry}>
                {t('aiTutor.retry')}
              </button>
            )}
          </div>
        )}
        {!loading && !error && conversations.length === 0 && (
          <p className={styles.empty}>{t('aiTutor.historyEmpty')}</p>
        )}
        {conversations.map((c) => (
          <button
            key={c.id}
            type="button"
            className={`${styles.item} ${c.id === activeId ? styles.itemActive : ''}`}
            onClick={() => onSelect(c.id)}
          >
            <span className={styles.itemTitle}>{c.title}</span>
            {c.lastMessagePreview && (
              <span className={styles.itemPreview}>{c.lastMessagePreview}</span>
            )}
          </button>
        ))}
        {hasMore && onLoadMore && (
          <button type="button" className={styles.loadMore} onClick={onLoadMore}>
            {t('aiTutor.loadMore')}
          </button>
        )}
      </div>
    </>
  );
}
