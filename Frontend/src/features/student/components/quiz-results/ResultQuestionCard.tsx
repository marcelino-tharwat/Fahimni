import { useTranslation } from 'react-i18next';
import { CheckCircle, XCircle, Clock, Lightbulb, Info, FileText } from 'lucide-react';
import { toLocalNum } from '@/shared/lib/utils/toLocalNum';
import { cn } from '@/shared/lib/utils/cn';
import type { QuestionResult } from '@/features/student/types/quizResults';
import { resolveResultTone } from '@/features/student/lib/quizResultStats';

interface ResultQuestionCardProps {
  result: QuestionResult;
  index: number;
}

type Tone = 'correct' | 'incorrect' | 'pending' | 'neutral';

function toneOf(result: QuestionResult): Tone {
  return resolveResultTone(result);
}

const TONE = {
  correct: { strip: 'bg-success-500', icon: CheckCircle, text: 'text-success-500' },
  incorrect: { strip: 'bg-danger-500', icon: XCircle, text: 'text-danger-500' },
  pending: { strip: 'bg-warning-500', icon: Clock, text: 'text-warning-500' },
  // Correctness hidden: neutral gray, no right/wrong signal.
  neutral: { strip: 'bg-gray-300', icon: FileText, text: 'text-gray-500' },
} as const;

export function ResultQuestionCard({ result, index }: ResultQuestionCardProps) {
  const { t } = useTranslation();
  const { question, studentAnswer, awardedPoints, maxPoints, feedback, correctAnswer, explanation } = result;

  // The backend now sends a dedicated per-question explanation; fall back to the
  // grading feedback when it isn't present (e.g. essay feedback).
  const explanationText = explanation ?? feedback;

  const tone = toneOf(result);
  const { strip, icon: StatusIcon, text } = TONE[tone];
  // The per-question score is rendered only when the backend actually sent it
  // (showPerQuestionScores). `scoreVisible === undefined` = legacy → visible.
  const scoreVisible = result.scoreVisible !== false;

  const statusLabel =
    tone === 'correct'
      ? t('quiz:results.correctAnswer')
      : tone === 'incorrect'
        ? t('quiz:results.wrongAnswer')
        : tone === 'pending'
          ? t('quiz:results.pendingGrading')
          : t('quiz:results.answered');

  const typeLabel = (() => {
    switch (question.type) {
      case 'mcq': return t('quiz:type.mcq');
      case 'tf': return t('quiz:type.tf');
      case 'essay': return t('quiz:type.essay');
      case 'fill': return t('quiz:type.fill');
    }
  })();

  const pointsNode = (() => {
    // No per-question score sent (showPerQuestionScores off) → render nothing.
    if (!scoreVisible) return null;
    if (tone === 'pending') {
      return (
        <span className="ms-auto text-small font-semibold text-gray-500">
          {t('quiz:results.pointsPending', { max: toLocalNum(maxPoints) })}
        </span>
      );
    }
    if (tone === 'incorrect') {
      return (
        <span className="ms-auto text-small font-semibold text-danger-500">
          {t('quiz:results.pointsZero')}
        </span>
      );
    }
    return (
      <span className="ms-auto text-small font-semibold text-success-500">
        {t('quiz:results.pointsEarned', { points: toLocalNum(awardedPoints ?? maxPoints) })}
      </span>
    );
  })();

  return (
    <div
      id={`qr-${question.id}`}
      className="flex overflow-hidden rounded-card border border-gray-300 bg-white shadow-card scroll-mt-4"
    >
      <div className={cn('w-1 shrink-0', strip)} />

      <div className="flex-1 p-5">
        {/* Header */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold text-navy-800">
            {t('quiz:results.question', { num: toLocalNum(index + 1) })}
          </span>
          <StatusIcon size={16} className={text} />
          <span className={cn('text-sm font-medium', text)}>{statusLabel}</span>
          <span className="rounded-badge border border-gray-300 bg-gray-100 px-2 py-0.5 text-caption font-semibold text-gray-600">
            {typeLabel}
          </span>
          {pointsNode}
        </div>

        {/* Question text */}
        <p className="mb-4 mt-3 text-base leading-relaxed text-navy-800">{question.text}</p>

        {/* Answer area */}
        {question.type === 'mcq' && question.options && (
          <McqOptions
            options={question.options}
            studentAnswer={studentAnswer}
            tone={tone}
            correctAnswer={correctAnswer}
          />
        )}

        {question.type === 'tf' && (
          <TrueFalse studentAnswer={studentAnswer} tone={tone} correctAnswer={correctAnswer} />
        )}

        {(question.type === 'essay' || question.type === 'fill') && (
          <FreeTextAnswer
            studentAnswer={studentAnswer}
            tone={tone}
            correctAnswer={correctAnswer}
          />
        )}

        {/* Explanation */}
        {explanationText && (
          <div className="mt-4 rounded-xl border border-purple-100 bg-purple-50 p-3">
            <div className="mb-1 flex items-center gap-1.5">
              <Lightbulb size={14} className="text-purple-500" />
              <span className="text-small font-semibold text-purple-500">
                {t('quiz:results.explanation')}
              </span>
            </div>
            <p className="text-xs leading-relaxed text-navy-800">{explanationText}</p>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── MCQ ─────────────────────────────────────────────── */

interface OptionsProps {
  options: NonNullable<QuestionResult['question']['options']>;
  studentAnswer: string;
  tone: Tone;
  correctAnswer?: string;
}

function McqOptions({ options, studentAnswer, tone, correctAnswer }: OptionsProps) {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col gap-2.5">
      {options.map((opt) => {
        // The backend returns studentAnswer/correctAnswer as the option *text*,
        // not the id — compare against opt.text so options highlight correctly.
        const selected = studentAnswer === opt.text;
        const isCorrectOption = correctAnswer != null && correctAnswer === opt.text;
        const showCorrect = isCorrectOption || (selected && tone === 'correct');
        const showWrong = selected && tone === 'incorrect';

        return (
          <div
            key={opt.id}
            className={cn(
              'flex items-center gap-3 rounded-md border-2 p-3.5 transition-colors',
              showCorrect && 'border-success-500 bg-success-50',
              showWrong && 'border-danger-500 bg-danger-50',
              !showCorrect && !showWrong && selected && 'border-cyan-500 bg-cyan-50',
              !showCorrect && !showWrong && !selected && 'border-gray-300 bg-white',
            )}
          >
            <span className="shrink-0">
              {showCorrect ? (
                <CheckCircle size={18} className="text-success-500" />
              ) : showWrong ? (
                <XCircle size={18} className="text-danger-500" />
              ) : (
                <span className="block h-4 w-4 rounded-full border-2 border-gray-400" />
              )}
            </span>
            <span
              className={cn(
                'text-sm font-bold shrink-0',
                showCorrect ? 'text-success-500' : showWrong ? 'text-danger-500' : 'text-gray-500',
              )}
            >
              {opt.label}
            </span>
            <span
              className={cn(
                'text-sm',
                showWrong ? 'text-danger-500 line-through' : 'text-navy-800',
              )}
            >
              {opt.text}
            </span>
            {isCorrectOption && !selected && (
              <span className="ms-auto text-caption font-semibold text-success-500">
                {t('quiz:results.correctAnswerLabel')}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ── True / False ────────────────────────────────────── */

interface TrueFalseProps {
  studentAnswer: string;
  tone: Tone;
  correctAnswer?: string;
}

function TrueFalse({ studentAnswer, tone, correctAnswer }: TrueFalseProps) {
  const { t } = useTranslation();
  const options = [
    { value: 'true', label: t('quiz:results.true') },
    { value: 'false', label: t('quiz:results.false') },
  ];

  return (
    <div className="flex flex-wrap gap-3">
      {options.map((opt) => {
        const selected = studentAnswer === opt.value;
        const isCorrectOption = correctAnswer != null && correctAnswer === opt.value;
        const showCorrect = isCorrectOption || (selected && tone === 'correct');
        const showWrong = selected && tone === 'incorrect';
        // Correctness hidden: still mark the student's own choice, but neutrally.
        const showNeutral = selected && !showCorrect && !showWrong;

        return (
          <div
            key={opt.value}
            className={cn(
              'flex min-w-[120px] items-center justify-center gap-2 rounded-xl border-2 px-6 py-3 text-sm font-semibold',
              showCorrect && 'border-success-500 bg-success-50 text-success-500',
              showWrong && 'border-danger-500 bg-danger-50 text-danger-500',
              showNeutral && 'border-cyan-500 bg-cyan-50 text-cyan-700',
              !showCorrect && !showWrong && !showNeutral && 'border-gray-300 bg-white text-gray-600',
            )}
          >
            {showCorrect && <CheckCircle size={16} />}
            {showWrong && <XCircle size={16} />}
            {opt.label}
          </div>
        );
      })}
    </div>
  );
}

/* ── Essay / Fill-in-the-blank ───────────────────────── */

interface FreeTextProps {
  studentAnswer: string;
  tone: Tone;
  correctAnswer?: string;
}

function FreeTextAnswer({ studentAnswer, tone, correctAnswer }: FreeTextProps) {
  const { t } = useTranslation();

  if (tone === 'pending') {
    return (
      <div className="flex flex-col gap-2">
        <div className="rounded-xl border border-warning-500/40 bg-warning-50 p-3">
          <p className="mb-1 text-small font-semibold text-warning-600">
            {t('quiz:results.yourAnswer')}
          </p>
          <p className="text-sm leading-relaxed text-navy-800">{studentAnswer || '—'}</p>
        </div>
        <div className="flex items-center gap-1.5 text-caption text-gray-500">
          <Info size={13} />
          <span>{t('quiz:results.teacherWillGrade')}</span>
        </div>
      </div>
    );
  }

  // Correctness hidden: show the student's answer with neutral styling only —
  // no right/wrong color, no correct-answer reveal.
  if (tone === 'neutral') {
    return (
      <div className="rounded-xl border-2 border-gray-300 bg-gray-50 p-3">
        <p className="mb-1 text-small font-semibold text-gray-600">
          {t('quiz:results.yourAnswer')}
        </p>
        <p className="font-mono text-sm leading-relaxed text-navy-800">{studentAnswer || '—'}</p>
      </div>
    );
  }

  const correct = tone === 'correct';

  return (
    <div className="flex flex-col gap-2">
      <div
        className={cn(
          'flex items-center gap-2 rounded-xl border-2 p-3',
          correct ? 'border-success-500 bg-success-50' : 'border-danger-500 bg-danger-50',
        )}
      >
        {correct ? (
          <CheckCircle size={16} className="shrink-0 text-success-500" />
        ) : (
          <XCircle size={16} className="shrink-0 text-danger-500" />
        )}
        <span className="text-small font-semibold text-gray-600">{t('quiz:results.yourAnswer')}</span>
        <span className="font-mono text-sm text-navy-800">{studentAnswer || '—'}</span>
      </div>

      {!correct && correctAnswer != null && (
        <div className="flex items-center gap-2 rounded-xl border-2 border-success-500 bg-success-50 p-3">
          <CheckCircle size={16} className="shrink-0 text-success-500" />
          <span className="text-small font-semibold text-success-500">
            {t('quiz:results.correctAnswerLabel')}
          </span>
          <span className="font-mono text-sm text-navy-800">{correctAnswer}</span>
        </div>
      )}
    </div>
  );
}
