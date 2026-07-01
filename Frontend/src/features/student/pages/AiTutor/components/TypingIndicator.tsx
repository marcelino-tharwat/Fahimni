import { BrainCircuit } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import styles from './TypingIndicator.module.css';

export function TypingIndicator() {
  const { t } = useTranslation('student');

  return (
    <div className={styles.typingRow} role="status" aria-live="polite">
      <div className={styles.botAvatar} aria-hidden>
        <BrainCircuit size={16} />
      </div>
      <div>
        <div className={styles.typingBubble}>
          <div className={styles.dotsWrap} aria-hidden>
            <span className={styles.dot} />
            <span className={styles.dot} />
            <span className={styles.dot} />
          </div>
        </div>
        <p className={styles.typingLabel}>{t('aiTutor.typing')}</p>
      </div>
    </div>
  );
}
