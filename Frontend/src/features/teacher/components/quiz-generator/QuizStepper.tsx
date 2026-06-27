import { Check } from 'lucide-react';
import { cn } from '@/shared/lib/utils/cn';
import { useTranslation } from 'react-i18next';

interface QuizStepperProps {
  activeStep: number;
}

export function QuizStepper({ activeStep }: QuizStepperProps) {
  const { t } = useTranslation();
  const STEPS = [
    { num: '١', key: t('teacher:quizGenerator.step1') },
    { num: '٢', key: t('teacher:quizGenerator.step2') },
    { num: '٣', key: t('teacher:quizGenerator.step3') },
  ];

  return (
    <div className="flex items-start justify-center">
      {STEPS.map((step, index) => {
        const isActive = index === activeStep;
        const isPast = index < activeStep;
        return (
          <div key={step.num} className="flex items-start">
            <div className="flex flex-col items-center gap-2">
              <span
                className={cn(
                  'flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold transition-all duration-300',
                  isPast && 'bg-accent/90 text-white',
                  isActive && 'bg-accent text-white shadow-lg shadow-accent/30',
                  !isPast && !isActive && 'bg-gray-100 text-gray-400',
                )}
              >
                {isPast ? <Check size={14} /> : step.num}
              </span>
              <span
                className={cn(
                  'text-center font-cairo text-xs whitespace-nowrap hidden sm:block',
                  isPast && 'text-accent font-bold',
                  isActive && 'text-accent font-bold',
                  !isPast && !isActive && 'text-gray-400 font-medium',
                )}
              >
                {step.key}
              </span>
            </div>
            {index < STEPS.length - 1 && (
              <div
                className={cn(
                  'w-20 sm:w-32 h-0.5 mt-4 mx-2 transition-all duration-300',
                  isPast ? 'bg-accent' : 'bg-gray-300',
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
