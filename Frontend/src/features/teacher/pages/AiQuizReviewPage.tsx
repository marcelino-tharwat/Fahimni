import { useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { ArrowLeft, ArrowRight, Plus, AlertCircle, RefreshCw } from 'lucide-react';
import { Button, Card, Badge, Spinner, EmptyState } from '@/shared/components/ui';
import { ConfirmDialog } from '@/shared/components/ui';
import { QuizStepper } from '@/features/teacher/components/quiz-generator';
import { QuestionCard } from '@/features/teacher/components/quiz-generator/QuestionCard';
import { QuestionEditor } from '@/features/teacher/components/quiz-generator/QuestionEditor';
import {
  useDraftQuiz,
  useCreateQuestion,
  useUpdateQuestion,
  useDeleteQuestion,
  useReorderQuestions,
} from '@/features/teacher/hooks/useQuizReview';
import {
  draftToApiPayload,
  sortQuestions,
  toReviewQuestion,
  type QuestionDraft,
  type ReviewQuestion,
} from '@/features/teacher/lib/quizReview';

export function AiQuizReviewPage() {
  const { quizId } = useParams<{ quizId: string }>();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const tk = (k: string, o?: Record<string, unknown>) => t(`teacher:quizGenerator.review.${k}`, o);

  const { data, isLoading, isError, refetch, isFetching } = useDraftQuiz(quizId);
  const createQ = useCreateQuestion(quizId ?? '');
  const updateQ = useUpdateQuestion(quizId ?? '');
  const deleteQ = useDeleteQuestion(quizId ?? '');
  const reorderQ = useReorderQuestions(quizId ?? '');

  // Server is the source of truth; an optional local id-order override makes drag
  // reorder feel immediate without syncing state in an effect. Cleared whenever
  // the server data changes (add/delete/reorder success → refetch).
  const serverQuestions = useMemo<ReviewQuestion[]>(
    () => (data?.questions ? sortQuestions(data.questions.map(toReviewQuestion)) : []),
    [data],
  );
  const [orderOverride, setOrderOverride] = useState<string[] | null>(null);
  const questions = useMemo<ReviewQuestion[]>(() => {
    if (!orderOverride) return serverQuestions;
    const byId = new Map(serverQuestions.map((q) => [q.id, q]));
    const ordered = orderOverride.map((id) => byId.get(id)).filter((q): q is ReviewQuestion => Boolean(q));
    // Append any questions not present in the override (e.g. newly added).
    const seen = new Set(orderOverride);
    return [...ordered, ...serverQuestions.filter((q) => !seen.has(q.id))];
  }, [serverQuestions, orderOverride]);

  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<ReviewQuestion | undefined>(undefined);
  const [editorError, setEditorError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ReviewQuestion | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const openAdd = () => {
    setEditing(undefined);
    setEditorError(null);
    setEditorOpen(true);
  };
  const openEdit = (q: ReviewQuestion) => {
    setEditing(q);
    setEditorError(null);
    setEditorOpen(true);
  };

  const handleSave = (draft: QuestionDraft) => {
    setEditorError(null);
    const payload = draftToApiPayload(draft);
    const onError = () => setEditorError(tk('errors.saveFailed'));
    if (editing) {
      updateQ.mutate(
        { questionId: editing.id, body: payload },
        { onSuccess: () => setEditorOpen(false), onError },
      );
    } else {
      createQ.mutate(
        { ...payload, sortOrder: questions.length + 1 },
        { onSuccess: () => { setOrderOverride(null); setEditorOpen(false); }, onError },
      );
    }
  };

  const confirmDelete = () => {
    if (!deleteTarget) return;
    setActionError(null);
    deleteQ.mutate(deleteTarget.id, {
      onSuccess: () => { setOrderOverride(null); setDeleteTarget(null); },
      onError: () => {
        setDeleteTarget(null);
        setActionError(tk('errors.deleteFailed'));
      },
    });
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = questions.findIndex((q) => q.id === active.id);
    const newIndex = questions.findIndex((q) => q.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    const next = arrayMove(questions, oldIndex, newIndex).map((q) => q.id);
    setOrderOverride(next);
    setActionError(null);
    reorderQ.mutate(next, {
      onSuccess: () => setOrderOverride(null),
      onError: () => { setActionError(tk('errors.reorderFailed')); setOrderOverride(null); void refetch(); },
    });
  };

  // ── States ──────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="mx-auto flex w-full max-w-2xl flex-col items-center gap-4 py-16">
        <Spinner />
        <p className="font-cairo text-sm text-text-secondary">{tk('loading')}</p>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
        <Card padding="lg" className="flex flex-col items-center gap-3 py-12 text-center">
          <AlertCircle size={40} className="text-danger" />
          <p className="font-cairo text-sm text-text-secondary">{tk('errors.loadFailed')}</p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => navigate('/teacher/quizzes/generator')}>
              <ArrowLeft size={18} />
              {tk('backToStep1')}
            </Button>
            <Button onClick={() => refetch()} disabled={isFetching}>
              <RefreshCw size={16} className={isFetching ? 'animate-spin' : ''} />
              {tk('retry')}
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  const count = questions.length;
  const savingEditor = createQ.isPending || updateQ.isPending;

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="font-cairo text-2xl font-bold text-text-primary">{t('teacher:quizGenerator.title')}</h1>
        <p className="font-cairo text-sm text-text-secondary">{t('teacher:quizGenerator.subtitle')}</p>
      </div>

      <QuizStepper activeStep={1} />

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="font-cairo text-lg font-bold text-text-primary">{tk('questionsTitle')}</h2>
          <Badge variant="info">{tk('countBadge', { count })}</Badge>
        </div>
        <Button variant="outline" size="sm" onClick={openAdd}>
          <Plus size={16} />
          {tk('addQuestion')}
        </Button>
      </div>

      {actionError && (
        <p className="font-cairo text-sm text-danger" role="alert">{actionError}</p>
      )}

      {count === 0 ? (
        <EmptyState
          title={tk('empty.title')}
          description={tk('empty.description')}
          action={{ label: tk('addQuestion'), onClick: openAdd }}
        />
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={questions.map((q) => q.id)} strategy={verticalListSortingStrategy}>
            <div className="flex flex-col gap-3">
              {questions.map((q, i) => (
                <QuestionCard
                  key={q.id}
                  question={q}
                  index={i + 1}
                  onEdit={() => openEdit(q)}
                  onDelete={() => setDeleteTarget(q)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      <div className="flex items-center justify-between border-t border-border pt-4">
        <Button variant="outline" onClick={() => navigate('/teacher/quizzes/generator')}>
          <ArrowLeft size={18} />
          {tk('backToStep1')}
        </Button>
        <Button
          onClick={() => navigate(`/teacher/quizzes/generator/publish/${quizId}`)}
          disabled={count === 0}
        >
          {tk('continueToStep3')}
          <ArrowRight size={18} />
        </Button>
      </div>

      <QuestionEditor
        isOpen={editorOpen}
        question={editing}
        saving={savingEditor}
        errorMessage={editorError}
        onClose={() => setEditorOpen(false)}
        onSave={handleSave}
      />

      <ConfirmDialog
        isOpen={Boolean(deleteTarget)}
        title={tk('deleteConfirm.title')}
        message={tk('deleteConfirm.message')}
        confirmLabel={tk('deleteConfirm.confirm')}
        cancelLabel={tk('deleteConfirm.cancel')}
        variant="danger"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
