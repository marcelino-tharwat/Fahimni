import { useEffect, useRef, type KeyboardEvent } from 'react';
import { ArrowUp } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Spinner } from '@/shared/components/ui';
import styles from './ChatInput.module.css';

const MAX_CHARS = 500;
const NEAR_LIMIT = 480;

interface ChatInputProps {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  disabled?: boolean;
  loading?: boolean;
}

export function ChatInput({
  value,
  onChange,
  onSend,
  disabled = false,
  loading = false,
}: ChatInputProps) {
  const { t } = useTranslation('student');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const hasText = value.trim().length > 0;
  const canSend = hasText && !disabled && !loading && value.length <= MAX_CHARS;

  function resize() {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }

  useEffect(() => {
    resize();
  }, [value]);

  function handleKey(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (canSend) onSend();
    }
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.inner}>
        <div className={styles.textareaWrap}>
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => onChange(e.target.value.slice(0, MAX_CHARS))}
            onKeyDown={handleKey}
            disabled={disabled || loading}
            placeholder={loading ? t('aiTutor.placeholderLoading') : t('aiTutor.placeholder')}
            rows={1}
            className={styles.textarea}
            aria-label={t('aiTutor.placeholder')}
          />
          {value.length >= NEAR_LIMIT && (
            <span
              className={`${styles.counter} ${
                value.length >= MAX_CHARS ? styles.counterDanger : styles.counterWarn
              }`}
            >
              {t('aiTutor.charLimit', { current: value.length, max: MAX_CHARS })}
            </span>
          )}
        </div>
        <button
          type="button"
          className={`${styles.sendBtn} ${canSend ? styles.sendBtnActive : ''}`}
          onClick={onSend}
          disabled={!canSend}
          aria-label={t('aiTutor.send')}
        >
          {loading ? <Spinner size="sm" className="text-white" /> : <ArrowUp size={18} />}
        </button>
      </div>
      <p className={styles.hint}>{t('aiTutor.keyboardHint')}</p>
    </div>
  );
}
