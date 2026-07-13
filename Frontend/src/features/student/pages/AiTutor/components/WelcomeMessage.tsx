import { BrainCircuit } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import styles from './WelcomeMessage.module.css';

export function WelcomeMessage() {
  const { t } = useTranslation('student');

  return (
    <div className={styles.wrap}>
      <div className={styles.avatar} aria-hidden>
        <BrainCircuit size={32} />
      </div>
      <div>
        <h2 className={styles.title}>{t('aiTutor.welcomeTitle')}</h2>
        <p className={styles.message}>{t('aiTutor.welcomeMessage')}</p>
        <p className={styles.subtitle}>{t('aiTutor.welcomeSubtitle')}</p>
      </div>
    </div>
  );
}
