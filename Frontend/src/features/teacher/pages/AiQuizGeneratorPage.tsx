import { useTranslation } from 'react-i18next';
import { Sparkles } from 'lucide-react';
import { Button, Card, Input } from '@/shared/components/ui';
import { addToast } from '@/shared/store/slices/toastSlice';
import { useAppDispatch } from '@/shared/store/hooks';
import { cn } from '@/shared/lib/utils/cn';

export function AiQuizGeneratorPage() {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();

  const steps = [
    { num: '١', labelKey: 'teacher:quizGenerator.step1' },
    { num: '٢', labelKey: 'teacher:quizGenerator.step2' },
    { num: '٣', labelKey: 'teacher:quizGenerator.step3' },
  ];
  const activeStep = 0;

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <h1 className="font-cairo text-2xl font-bold text-text-primary">
        {t('teacher:quizGenerator.title')}
      </h1>

      {/* Stepper */}
      <div className="flex items-center gap-3">
        {steps.map((step, index) => {
          const isActive = index === activeStep;
          return (
            <div
              key={step.labelKey}
              className={cn(
                'flex items-center gap-2 font-cairo text-sm font-medium',
                isActive ? 'text-accent' : 'text-text-secondary',
              )}
            >
              <span
                className={cn(
                  'flex h-7 w-7 items-center justify-center rounded-full text-sm',
                  isActive ? 'bg-accent text-white' : 'bg-gray-200 text-text-secondary',
                )}
              >
                {step.num}
              </span>
              <span>{t(step.labelKey)}</span>
            </div>
          );
        })}
      </div>

      {/* Step 1 form */}
      <Card padding="lg" className="flex flex-col gap-4">
        <Input label={t('teacher:quizGenerator.topic')} placeholder="مثال: الأحماض والقواعد" />
        <Input
          type="number"
          label={t('teacher:quizGenerator.questionCount')}
          defaultValue={5}
          min={1}
        />

        <div className="flex w-full flex-col gap-1">
          <label htmlFor="difficulty" className="text-start font-cairo text-sm font-medium text-text-primary">
            {t('teacher:quizGenerator.difficulty')}
          </label>
          <select
            id="difficulty"
            className="h-[48px] w-full rounded-input border border-border bg-surface px-3 font-cairo text-text-primary outline-none focus:border-accent"
            defaultValue="medium"
          >
            <option value="easy">سهل</option>
            <option value="medium">متوسط</option>
            <option value="hard">صعب</option>
          </select>
        </div>

        <Button
          className="self-start"
          onClick={() => dispatch(addToast({ type: 'info', message: 'جارٍ توليد الاختبار بالذكاء الاصطناعي...' }))}
        >
          <Sparkles size={18} />
          {t('teacher:quizGenerator.generateBtn')}
        </Button>
      </Card>
    </div>
  );
}
