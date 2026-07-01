import { Link } from 'react-router-dom';
import { AlertCircle, BookOpen, BrainCircuit } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { AiTutorChatMessage } from '@/shared/types/aiTutor';
import { useDirection } from '@/shared/hooks/useDirection';
import styles from './ChatMessage.module.css';

interface ChatMessageProps {
  message: AiTutorChatMessage;
  errorMessageKey?: string;
  onRetry?: (messageId: string) => void;
}

export function ChatMessage({ message, errorMessageKey, onRetry }: ChatMessageProps) {
  const { t } = useTranslation('student');
  const direction = useDirection();
  const isStudent = message.role === 'student';
  const isFailed = message.status === 'FAILED' || message.failed;

  if (isStudent) {
    return (
      <div className={`${styles.bubbleRow} ${styles.bubbleRowStudent}`} dir={direction}>
        <div className={styles.studentWrap}>
          <div className={styles.studentBubble}>{message.content}</div>
        </div>
      </div>
    );
  }

  if (isFailed) {
    return (
      <div className={`${styles.bubbleRow} ${styles.bubbleRowAssistant}`} dir={direction}>
        <div className={styles.assistantWrap}>
          <div className={styles.botAvatar} aria-hidden>
            <BrainCircuit size={16} />
          </div>
          <div className={styles.assistantCol}>
            <div className={`${styles.assistantBubble} ${styles.errorBubble}`}>
              <div className={styles.errorHeader}>
                <AlertCircle size={16} aria-hidden />
                <span>{t(errorMessageKey ?? 'aiTutor.errorTitle')}</span>
              </div>
              {onRetry && (
                <button
                  type="button"
                  className={styles.retryBtn}
                  onClick={() => onRetry(message.id)}
                >
                  {t('aiTutor.retry')}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`${styles.bubbleRow} ${styles.bubbleRowAssistant}`} dir={direction}>
      <div className={styles.assistantWrap}>
        <div className={styles.botAvatar} aria-hidden>
          <BrainCircuit size={16} />
        </div>
        <div className={styles.assistantCol}>
          <div className={styles.assistantBubble}>{message.content}</div>
          {message.citations && message.citations.length > 0 && (
            <div className={styles.citations}>
              {message.citations.map((c) => (
                <Link
                  key={c.lessonId}
                  to={`/student/lessons/${c.lessonId}`}
                  className={styles.citation}
                  rel="noopener noreferrer"
                >
                  <BookOpen size={10} aria-hidden />
                  {c.lessonTitle}
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
