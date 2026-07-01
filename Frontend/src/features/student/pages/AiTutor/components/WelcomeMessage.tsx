import { BrainCircuit } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import styles from './WelcomeMessage.module.css';

const SUGGESTIONS_AR = [
  'إيه أهم قوانين الكيمياء الحرارية؟',
  'اشرحلي التحليل الكهربائي',
  'إيه الفرق بين الأحماض والقواعد؟',
];

const SUGGESTIONS_EN = [
  'What are the key laws of thermochemistry?',
  'Explain electrolysis simply',
  'What is the difference between acids and bases?',
];

interface WelcomeMessageProps {
  onSuggest: (text: string) => void;
}

export function WelcomeMessage({ onSuggest }: WelcomeMessageProps) {
  const { t, i18n } = useTranslation('student');
  const suggestions = i18n.language === 'ar' ? SUGGESTIONS_AR : SUGGESTIONS_EN;

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
      <div className={styles.chips}>
        {suggestions.map((s) => (
          <button key={s} type="button" className={styles.chip} onClick={() => onSuggest(s)}>
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}
