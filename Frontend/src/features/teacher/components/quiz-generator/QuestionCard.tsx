import { useTranslation } from 'react-i18next';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Pencil, Trash2, CheckCircle2 } from 'lucide-react';
import { Card, Badge } from '@/shared/components/ui';
import { cn } from '@/shared/lib/utils/cn';
import { optionLabel, typeBadge, type ReviewQuestion } from '@/features/teacher/lib/quizReview';

interface QuestionCardProps {
  question: ReviewQuestion;
  /** 1-based position in the current order. */
  index: number;
  onEdit: () => void;
  onDelete: () => void;
}

export function QuestionCard({ question, index, onEdit, onDelete }: QuestionCardProps) {
  const { t } = useTranslation();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: question.id,
  });
  const badge = typeBadge(question.type);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  };

  return (
    <div ref={setNodeRef} style={style}>
    <Card padding="lg" className="flex flex-col gap-3 border border-border">
      <div className="flex items-start gap-2">
        <button
          type="button"
          className="mt-0.5 cursor-grab touch-none rounded p-1 text-text-secondary hover:bg-gray-100 focus-visible:ring-2 focus-visible:ring-accent"
          aria-label={t('teacher:quizGenerator.review.dragHandle', { number: index })}
          {...attributes}
          {...listeners}
        >
          <GripVertical size={18} />
        </button>

        <span className="mt-0.5 font-cairo text-sm font-bold text-text-secondary">{index}.</span>

        <div className="flex-1">
          <Badge variant={badge.variant}>
            {t(`teacher:quizGenerator.review.types.${badge.key}`)}
          </Badge>
          <p className="mt-2 font-cairo text-base font-semibold text-text-primary">{question.content}</p>
        </div>

        <div className="flex shrink-0 gap-1">
          <button
            type="button"
            onClick={onEdit}
            className="rounded p-2 text-text-secondary hover:bg-gray-100 focus-visible:ring-2 focus-visible:ring-accent"
            aria-label={t('teacher:quizGenerator.review.editQuestion', { number: index })}
          >
            <Pencil size={16} />
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="rounded p-2 text-danger hover:bg-danger/10 focus-visible:ring-2 focus-visible:ring-danger"
            aria-label={t('teacher:quizGenerator.review.deleteQuestion', { number: index })}
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      {/* Options preview */}
      {(question.type === 'MCQ' || question.type === 'TRUE_FALSE') && question.options.length > 0 && (
        <ul className="flex flex-col gap-2 ps-7">
          {question.options.map((opt, i) => {
            const isCorrect = question.correctAnswer != null && opt === question.correctAnswer;
            return (
              <li
                key={`${question.id}-${i}`}
                className={cn(
                  'flex items-center gap-2 rounded-button border p-2 font-cairo text-sm',
                  isCorrect
                    ? 'border-success bg-success/10 text-success'
                    : 'border-border text-text-primary',
                )}
              >
                <input type="radio" checked={isCorrect} readOnly aria-hidden tabIndex={-1} />
                {question.type === 'MCQ' && (
                  <span className="w-5 font-bold text-text-secondary">{optionLabel(i)}</span>
                )}
                <span className="flex-1">{opt}</span>
                {isCorrect && (
                  <span className="flex items-center gap-1 text-xs font-semibold text-success">
                    <CheckCircle2 size={14} />
                    {t('teacher:quizGenerator.review.correct')}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {/* Essay: only show a model answer if the backend actually has one. */}
      {question.type === 'ESSAY' && (
        <p className="ps-7 font-cairo text-sm text-text-secondary">
          {question.correctAnswer
            ? `${t('teacher:quizGenerator.review.modelAnswer')}: ${question.correctAnswer}`
            : t('teacher:quizGenerator.review.essayManualGrading')}
        </p>
      )}
    </Card>
    </div>
  );
}
