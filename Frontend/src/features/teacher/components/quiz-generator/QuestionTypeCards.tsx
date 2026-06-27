import { useTranslation } from 'react-i18next';
import type { QuestionTypeKey } from '@/features/teacher/types/quizGeneration';
import { CircleDot, ToggleLeft, MessageSquare, Check } from 'lucide-react';
import { cn } from '@/shared/lib/utils/cn';

interface QuestionTypeCardsProps {
  selected: QuestionTypeKey[];
  onChange: (types: QuestionTypeKey[]) => void;
}

export function QuestionTypeCards({ selected, onChange }: QuestionTypeCardsProps) {
  const { t } = useTranslation();
  const types: { value: QuestionTypeKey; label: string; desc: string; icon: typeof CircleDot; gradient: string }[] = [
    { value: 'MCQ', label: t('teacher:quizGenerator.questionType_mcq'), desc: t('teacher:quizGenerator.questionType_mcq_desc'), icon: CircleDot, gradient: 'from-accent to-cyan-400' },
    { value: 'TF', label: t('teacher:quizGenerator.questionType_tf'), desc: t('teacher:quizGenerator.questionType_tf_desc'), icon: ToggleLeft, gradient: 'from-purple-500 to-purple-700' },
    { value: 'ESSAY', label: t('teacher:quizGenerator.questionType_essay'), desc: t('teacher:quizGenerator.questionType_essay_desc'), icon: MessageSquare, gradient: 'from-purple-500 to-purple-700' },
  ];
  const toggle = (val: QuestionTypeKey) => {
    if (selected.includes(val)) {
      onChange(selected.filter((t) => t !== val));
    } else {
      onChange([...selected, val]);
    }
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      {types.map(({ value, label, desc, icon: Icon, gradient }) => {
        const active = selected.includes(value);
        return (
          <button
            key={value}
            type="button"
            onClick={() => toggle(value)}
            className={cn(
              'border-2 rounded-[14px] p-4 text-start flex items-start gap-3 transition-all duration-150 cursor-pointer bg-white',
              active
                ? 'border-cyan-500 bg-cyan-500/6'
                : 'border-gray-300 hover:border-gray-400',
            )}
          >
            <span className={cn('flex w-10 h-10 shrink-0 items-center justify-center rounded-xl text-white bg-gradient-to-br', gradient)}>
              <Icon size={20} />
            </span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-semibold text-navy-800">{label}</span>
                {active && (
                  <span className="flex w-5 h-5 shrink-0 items-center justify-center rounded-full bg-cyan-500 text-white">
                    <Check size={11} />
                  </span>
                )}
              </div>
              <span className="block text-xs text-gray-500 mt-0.5">{desc}</span>
            </div>
          </button>
        );
      })}
    </div>
  );
}
