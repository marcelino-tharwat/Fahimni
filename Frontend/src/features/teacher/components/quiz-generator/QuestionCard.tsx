import { useTranslation } from 'react-i18next';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Pencil, Trash2, CheckCircle2 } from 'lucide-react';
import { Badge } from '@/shared/components/ui';
import { cn } from '@/shared/lib/utils/cn';
import { optionLabel, typeBadge, type ReviewQuestion } from '@/features/teacher/lib/quizReview';

interface QuestionCardProps {
  question: ReviewQuestion;
  /** 1-based position in the current order. */
  index: number;
  /** When false the drag handle is shown but inert (e.g. while filtering). */
  reorderable?: boolean;
  /** Collapsed cards show only the header strip. */
  collapsed?: boolean;
  onEdit: () => void;
  onDelete: () => void;
}

export function QuestionCard({
  question,
  index,
  reorderable = true,
  collapsed = false,
  onEdit,
  onDelete,
}: QuestionCardProps) {
  const { t } = useTranslation();
  const tk = (k: string, o?: Record<string, unknown>) => t(`teacher:quizGenerator.review.${k}`, o);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: question.id,
  });
  const badge = typeBadge(question.type);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'overflow-hidden rounded-card border bg-surface shadow-sm transition-shadow',
        isDragging
          ? 'z-10 scale-[1.02] border-accent/60 opacity-95 shadow-modal'
          : 'border-border',
      )}
    >
      {/* Header strip */}
      <div className="flex items-center gap-2 border-b border-border bg-gray-50 px-4 py-2.5">
        <button
          type="button"
          className={cn(
            'rounded p-1 text-text-muted focus-visible:ring-2 focus-visible:ring-accent',
            reorderable ? 'cursor-grab touch-none hover:bg-gray-200' : 'cursor-default opacity-40',
          )}
          aria-label={tk('dragHandle', { number: index })}
          {...(reorderable ? { ...attributes, ...listeners } : { tabIndex: -1, 'aria-hidden': true })}
        >
          <GripVertical size={16} />
        </button>

        <span className="font-cairo text-sm font-semibold text-text-primary">
          {tk('questionLabel', { number: index })}
        </span>

        <Badge variant={badge.variant}>{tk(`types.${badge.key}`)}</Badge>

        <span className="font-cairo text-xs text-text-secondary">
          {tk('pointsLabel', { count: question.points })}
        </span>

        <div className="ms-auto flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={onEdit}
            className="rounded-button p-2 text-text-secondary hover:bg-accent/10 hover:text-accent focus-visible:ring-2 focus-visible:ring-accent"
            aria-label={tk('editQuestion', { number: index })}
          >
            <Pencil size={16} />
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="rounded-button p-2 text-text-secondary hover:bg-danger/10 hover:text-danger focus-visible:ring-2 focus-visible:ring-danger"
            aria-label={tk('deleteQuestion', { number: index })}
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      {/* Body */}
      {!collapsed && (
        <div className="flex flex-col gap-3 px-4 py-4">
          <p className="font-cairo text-[15px] font-medium text-text-primary">{question.content}</p>

          {(question.type === 'MCQ' || question.type === 'TRUE_FALSE') &&
            question.options.length > 0 && (
              <ul className="flex flex-col gap-1.5">
                {question.options.map((opt, i) => {
                  const isCorrect = question.correctAnswer != null && opt === question.correctAnswer;
                  return (
                    <li
                      key={`${question.id}-${i}`}
                      className={cn(
                        'flex items-center gap-2 rounded-button border px-3 py-2 font-cairo text-sm',
                        isCorrect
                          ? 'border-success/40 bg-success/10 text-success'
                          : 'border-border bg-surface text-text-secondary',
                      )}
                    >
                      {question.type === 'MCQ' && (
                        <span className="w-5 shrink-0 font-bold">{optionLabel(i)})</span>
                      )}
                      <span className="flex-1">{opt}</span>
                      {isCorrect && (
                        <span className="flex shrink-0 items-center gap-1 text-xs font-semibold text-success">
                          <CheckCircle2 size={14} />
                          {tk('correct')}
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}

          {/* Essay: only show a model answer if the backend actually has one. */}
          {question.type === 'ESSAY' && (
            <p className="font-cairo text-sm text-text-secondary">
              {question.correctAnswer
                ? `${tk('modelAnswer')}: ${question.correctAnswer}`
                : tk('essayManualGrading')}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
