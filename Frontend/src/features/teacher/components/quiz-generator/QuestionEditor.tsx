import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Button, Input } from '@/shared/components/ui';
import {
  MCQ_OPTION_COUNT,
  TF_OPTIONS,
  blankDraft,
  optionLabel,
  questionToDraft,
  validateQuestionDraft,
  type QuestionDraft,
  type ReviewQuestion,
  type ReviewQuestionType,
} from '@/features/teacher/lib/quizReview';

interface QuestionEditorProps {
  isOpen: boolean;
  /** Existing question to edit, or undefined to add a new one. */
  question?: ReviewQuestion;
  saving: boolean;
  /** Persistence error message (kept open on failure). */
  errorMessage?: string | null;
  onClose: () => void;
  onSave: (draft: QuestionDraft) => void;
}

const TYPES: ReviewQuestionType[] = ['MCQ', 'TRUE_FALSE', 'ESSAY'];

export function QuestionEditor({
  isOpen,
  question,
  saving,
  errorMessage,
  onClose,
  onSave,
}: QuestionEditorProps) {
  const { t } = useTranslation();
  const initial = useMemo<QuestionDraft>(
    () => (question ? questionToDraft(question) : blankDraft('MCQ')),
    [question],
  );

  const [draft, setDraft] = useState<QuestionDraft>(initial);
  const [showErrors, setShowErrors] = useState(false);
  // Re-seed when the target question changes (open for a different card).
  const [seededFor, setSeededFor] = useState<string | undefined>(question?.id);
  if (seededFor !== question?.id) {
    setSeededFor(question?.id);
    setDraft(initial);
    setShowErrors(false);
  }

  const errors = validateQuestionDraft(draft);
  const tk = (key: string) => t(`teacher:quizGenerator.review.${key}`);

  const setType = (type: ReviewQuestionType) => {
    // Preserve typed content; reset type-specific fields safely.
    setDraft((d) => ({ ...blankDraft(type), content: d.content }));
  };

  const setOption = (index: number, value: string) => {
    setDraft((d) => {
      const options = [...d.options];
      const prev = options[index];
      options[index] = value;
      // Keep correctAnswer pointing at the same option if its text changed.
      const correctAnswer = d.correctAnswer === prev ? value : d.correctAnswer;
      return { ...d, options, correctAnswer };
    });
  };

  const handleSave = () => {
    if (Object.keys(validateQuestionDraft(draft)).length > 0) {
      setShowErrors(true);
      return;
    }
    onSave(draft);
  };

  const fieldError = (key: keyof typeof errors) =>
    showErrors && errors[key] ? tk(errors[key] as string) : null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={question ? tk('editTitle') : tk('addTitle')}
      size="lg"
    >
      <div className="flex flex-col gap-4">
        {/* Type */}
        <label className="flex flex-col gap-1">
          <span className="font-cairo text-sm font-semibold text-text-primary">{tk('typeLabel')}</span>
          <select
            value={draft.type}
            onChange={(e) => setType(e.target.value as ReviewQuestionType)}
            className="min-h-[44px] rounded-button border border-border bg-surface px-3 font-cairo text-sm text-text-primary"
            aria-label={tk('typeLabel')}
          >
            {TYPES.map((tp) => (
              <option key={tp} value={tp}>
                {t(`teacher:quizGenerator.review.types.${tp === 'MCQ' ? 'mcq' : tp === 'TRUE_FALSE' ? 'trueFalse' : 'essay'}`)}
              </option>
            ))}
          </select>
        </label>

        {/* Content */}
        <label className="flex flex-col gap-1">
          <span className="font-cairo text-sm font-semibold text-text-primary">{tk('contentLabel')}</span>
          <textarea
            value={draft.content}
            onChange={(e) => setDraft((d) => ({ ...d, content: e.target.value }))}
            rows={3}
            className="rounded-button border border-border bg-surface p-3 font-cairo text-sm text-text-primary"
            aria-label={tk('contentLabel')}
            aria-invalid={Boolean(fieldError('content'))}
          />
          {fieldError('content') && (
            <span className="font-cairo text-xs text-danger">{fieldError('content')}</span>
          )}
        </label>

        {/* MCQ options */}
        {draft.type === 'MCQ' && (
          <div className="flex flex-col gap-2">
            <span className="font-cairo text-sm font-semibold text-text-primary">{tk('optionsLabel')}</span>
            {Array.from({ length: MCQ_OPTION_COUNT }).map((_, i) => {
              const value = draft.options[i] ?? '';
              const checked = draft.correctAnswer != null && value.trim().length > 0 && draft.correctAnswer === value;
              return (
                <div key={i} className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="mcq-correct"
                    checked={checked}
                    onChange={() => setDraft((d) => ({ ...d, correctAnswer: d.options[i] ?? '' }))}
                    aria-label={t('teacher:quizGenerator.review.markCorrect', { label: optionLabel(i) })}
                  />
                  <span className="w-5 font-cairo text-sm font-bold text-text-secondary">{optionLabel(i)}</span>
                  <Input
                    value={value}
                    onChange={(e) => setOption(i, e.target.value)}
                    aria-label={t('teacher:quizGenerator.review.optionInput', { label: optionLabel(i) })}
                    className="flex-1"
                  />
                </div>
              );
            })}
            {fieldError('options') && (
              <span className="font-cairo text-xs text-danger">{fieldError('options')}</span>
            )}
            {fieldError('correctAnswer') && (
              <span className="font-cairo text-xs text-danger">{fieldError('correctAnswer')}</span>
            )}
          </div>
        )}

        {/* True / False */}
        {draft.type === 'TRUE_FALSE' && (
          <div className="flex flex-col gap-2">
            <span className="font-cairo text-sm font-semibold text-text-primary">{tk('correctAnswerLabel')}</span>
            {TF_OPTIONS.map((opt) => (
              <label key={opt} className="flex items-center gap-2 font-cairo text-sm text-text-primary">
                <input
                  type="radio"
                  name="tf-correct"
                  checked={draft.correctAnswer === opt}
                  onChange={() => setDraft((d) => ({ ...d, correctAnswer: opt }))}
                />
                {opt}
              </label>
            ))}
            {fieldError('correctAnswer') && (
              <span className="font-cairo text-xs text-danger">{fieldError('correctAnswer')}</span>
            )}
          </div>
        )}

        {errorMessage && (
          <p className="font-cairo text-sm text-danger" role="alert">{errorMessage}</p>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose} disabled={saving}>
            {tk('cancel')}
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? tk('saving') : tk('save')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
