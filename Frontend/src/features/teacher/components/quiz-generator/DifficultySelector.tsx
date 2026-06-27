import { useTranslation } from 'react-i18next';
import type { DifficultyLevel } from '@/features/teacher/types/quizGeneration';
import { cn } from '@/shared/lib/utils/cn';

interface DifficultySelectorProps {
  mode: 'uniform' | 'mixed';
  uniformValue: DifficultyLevel;
  mixedValue: { easy: number; medium: number; hard: number };
  onModeChange: (mode: 'uniform' | 'mixed') => void;
  onUniformChange: (val: DifficultyLevel) => void;
  onMixedChange: (val: { easy: number; medium: number; hard: number }) => void;
}

const DIFFICULTY_COLORS: Record<DifficultyLevel, string> = {
  easy: '#10b981',
  medium: '#f59e0b',
  hard: '#f43f5e',
};

const SLIDER_LABEL_CLASSES: Record<DifficultyLevel, string> = {
  easy: 'text-emerald-500',
  medium: 'text-amber-500',
  hard: 'text-rose-500',
};

const SLIDER_INPUT_CLASSES: Record<DifficultyLevel, string> = {
  easy: 'border-emerald-300 text-emerald-600',
  medium: 'border-amber-300 text-amber-600',
  hard: 'border-rose-300 text-rose-600',
};

const DIFF_CONFIG: Record<DifficultyLevel, { selBg: string; selBorder: string; selText: string }> = {
  easy:   { selBg: '#ECFDF5', selBorder: '#10B981', selText: '#059669' },
  medium: { selBg: '#FFFBEB', selBorder: '#F59E0B', selText: '#B45309' },
  hard:   { selBg: '#FEF2F2', selBorder: '#EF4444', selText: '#DC2626' },
};

export function DifficultySelector({
  mode,
  uniformValue,
  mixedValue,
  onModeChange,
  onUniformChange,
  onMixedChange,
}: DifficultySelectorProps) {
  const { t } = useTranslation();
  const levels: { value: DifficultyLevel; label: string }[] = [
    { value: 'easy', label: t('teacher:quizGenerator.easy') },
    { value: 'medium', label: t('teacher:quizGenerator.medium') },
    { value: 'hard', label: t('teacher:quizGenerator.hard') },
  ];

  const updateMixed = (changed: DifficultyLevel, raw: number) => {
    const newVal = Math.max(0, Math.min(100, Number.isNaN(raw) ? 0 : Math.round(raw)));
    const others = (['easy', 'medium', 'hard'] as const).filter((k) => k !== changed);
    const remaining = 100 - newVal;
    const oldOthersSum = others.reduce((s, k) => s + (mixedValue[k] || 0), 0);

    const next = { ...mixedValue, [changed]: newVal };

    if (oldOthersSum === 0) {
      next[others[0]] = Math.floor(remaining / 2);
      next[others[1]] = remaining - next[others[0]];
    } else {
      others.forEach((k) => {
        next[k] = Math.round(((mixedValue[k] || 0) / oldOthersSum) * remaining);
      });
      const sum = next.easy + next.medium + next.hard;
      if (sum !== 100) {
        next[others[1]] += 100 - sum;
      }
    }

    onMixedChange(next);
  };

  const total = mixedValue.easy + mixedValue.medium + mixedValue.hard;

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-3 gap-3">
        {levels.map(({ value: val, label }) => {
          const selected = mode === 'uniform' && uniformValue === val;
          const cfg = DIFF_CONFIG[val];
          return (
            <button
              key={val}
              type="button"
              onClick={() => {
                onModeChange('uniform');
                onUniformChange(val);
              }}
              className="h-10 w-full rounded-full border font-cairo text-sm font-medium transition-all"
              style={selected
                ? { background: cfg.selBg, borderColor: cfg.selBorder, color: cfg.selText }
                : { background: 'white', borderColor: '#E5E7EB', color: '#6B7280' }
              }
            >
              {label}
            </button>
          );
        })}
      </div>

      <div className="flex items-center gap-3 rounded-card border border-border bg-surface p-3">
        <div
          onClick={() => onModeChange(mode === 'mixed' ? 'uniform' : 'mixed')}
          className={cn(
            'relative h-[22px] w-11 shrink-0 cursor-pointer rounded-full transition-colors',
            mode === 'mixed' ? 'bg-accent' : 'bg-gray-200',
          )}
        >
          <span
            className={cn(
              'absolute top-0.5 h-[18px] w-[18px] rounded-full bg-white shadow-sm transition-all',
              mode === 'mixed' ? 'start-[23px]' : 'start-[2.5px]',
            )}
          />
        </div>
        <div className="flex flex-col">
          <span className="font-cairo text-sm font-medium text-text-primary">{t('teacher:quizGenerator.difficultyMixed')}</span>
          <span className="font-cairo text-xs text-text-secondary">
            {mode === 'mixed' ? t('teacher:quizGenerator.difficultyMixedHintOpen') : t('teacher:quizGenerator.difficultyMixedHintClosed')}
          </span>
        </div>
      </div>

      {mode === 'mixed' && (
        <div className="flex flex-col gap-3">
          {levels.map(({ value: val, label }) => {
            const color = DIFFICULTY_COLORS[val];
            const labelCls = SLIDER_LABEL_CLASSES[val];
            const inputCls = SLIDER_INPUT_CLASSES[val];
            return (
              <div key={val} className="flex items-center gap-3">
                <span className={cn('w-16 font-cairo text-sm', labelCls)}>{label}</span>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={mixedValue[val]}
                  onChange={(e) => updateMixed(val, Number(e.target.value))}
                  className="flex-1 h-2 cursor-pointer"
                  style={{ accentColor: color }}
                />
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={mixedValue[val]}
                  onChange={(e) => {
                    const raw = Number(e.target.value);
                    if (!Number.isNaN(raw)) updateMixed(val, raw);
                  }}
                  className={cn('w-16 h-9 rounded-input border bg-surface px-2 text-center font-cairo text-sm outline-none transition-colors focus:border-accent focus:ring-2 focus:ring-accent/20', inputCls)}
                />
                <span className="font-cairo text-xs text-text-secondary w-4">%</span>
              </div>
            );
          })}
          {total !== 100 && (
            <p className="font-cairo text-xs text-danger">{t('teacher:quizGenerator.difficultyMixedTotalError', { total })}</p>
          )}
        </div>
      )}
    </div>
  );
}
