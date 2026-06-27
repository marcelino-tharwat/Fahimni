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
import {
  ArrowLeft,
  ArrowRight,
  Plus,
  AlertCircle,
  RefreshCw,
  Eye,
  EyeOff,
} from 'lucide-react';
import { Button, Card, Badge, Spinner, EmptyState } from '@/shared/components/ui';
import { ConfirmDialog } from '@/shared/components/ui';
import { cn } from '@/shared/lib/utils/cn';
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
  type ReviewQuestionType,
} from '@/features/teacher/lib/quizReview';

type TypeFilter = 'all' | ReviewQuestionType;
const FILTERS: { value: TypeFilter; key: string }[] = [
  { value: 'all', key: 'filters.all' },
  { value: 'MCQ', key: 'filters.mcq' },
  { value: 'TRUE_FALSE', key: 'filters.trueFalse' },
  { value: 'ESSAY', key: 'filters.essay' },
];

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
    const ordered = orderOverride
      .map((id) => byId.get(id))
      .filter((q): q is ReviewQuestion => Boolean(q));
    // Append any questions not present in the override (e.g. newly added).
    const seen = new Set(orderOverride);
    return [...ordered, ...serverQuestions.filter((q) => !seen.has(q.id))];
  }, [serverQuestions, orderOverride]);

  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<ReviewQuestion | undefined>(undefined);
  const [editorError, setEditorError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ReviewQuestion | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [filter, setFilter] = useState<TypeFilter>('all');
  const [collapsed, setCollapsed] = useState(false);

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
        {
          onSuccess: () => {
            setOrderOverride(null);
            setEditorOpen(false);
          },
          onError,
        },
      );
    }
  };

  const confirmDelete = () => {
    if (!deleteTarget) return;
    setActionError(null);
    deleteQ.mutate(deleteTarget.id, {
      onSuccess: () => {
        setOrderOverride(null);
        setDeleteTarget(null);
      },
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
      onError: () => {
        setActionError(tk('errors.reorderFailed'));
        setOrderOverride(null);
        void refetch();
      },
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
  const totalPoints = questions.reduce((sum, q) => sum + q.points, 0);
  const savingEditor = createQ.isPending || updateQ.isPending;
  const visible = filter === 'all' ? questions : questions.filter((q) => q.type === filter);
  // Original 1-based position kept stable even when filtered.
  const positionOf = (id: string) => questions.findIndex((q) => q.id === id) + 1;

  return (
    <div className="mx-auto flex w-full max-w-[960px] flex-col gap-6">
      <QuizStepper activeStep={1} />

      {/* Header */}
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            <h1 className="font-cairo text-2xl font-extrabold text-text-primary">
              {tk('pageTitle')}
            </h1>
            <p className="font-cairo text-sm text-text-secondary">{tk('pageSubtitle')}</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Badge variant="info">{tk('countBadge', { count })}</Badge>
            <Badge className="bg-violet-100 text-violet-700">
              {tk('pointsBadge', { count: totalPoints })}
            </Badge>
          </div>
        </div>
        {data.title && (
          <p className="font-cairo text-xs text-text-muted">{data.title}</p>
        )}
      </div>

      {/* Toolbar */}
      <Card padding="sm" className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={openAdd}>
            <Plus size={16} />
            {tk('addQuestion')}
          </Button>
          <div className="flex flex-wrap items-center gap-1.5">
            {FILTERS.map((f) => (
              <button
                key={f.value}
                type="button"
                onClick={() => setFilter(f.value)}
                className={cn(
                  'rounded-full border px-3 py-1 font-cairo text-xs transition-colors',
                  filter === f.value
                    ? 'border-accent/30 bg-accent/10 text-accent'
                    : 'border-border bg-surface text-text-secondary hover:bg-gray-50',
                )}
              >
                {tk(f.key)}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" onClick={() => navigate('/teacher/dashboard')}>
            {tk('saveDraft')}
          </Button>
          <button
            type="button"
            onClick={() => setCollapsed((c) => !c)}
            className="flex items-center gap-1 rounded-button px-2 py-1.5 font-cairo text-xs text-text-secondary hover:bg-gray-50"
          >
            {collapsed ? <Eye size={14} /> : <EyeOff size={14} />}
            {collapsed ? tk('expandAll') : tk('collapseAll')}
          </button>
        </div>
      </Card>

      {actionError && (
        <p className="font-cairo text-sm text-danger" role="alert">
          {actionError}
        </p>
      )}

      {/* Question list */}
      {count === 0 ? (
        <EmptyState
          title={tk('empty.title')}
          description={tk('empty.description')}
          action={{ label: tk('addQuestion'), onClick: openAdd }}
        />
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={visible.map((q) => q.id)} strategy={verticalListSortingStrategy}>
            <div className="flex flex-col gap-4">
              {visible.map((q) => (
                <QuestionCard
                  key={q.id}
                  question={q}
                  index={positionOf(q.id)}
                  reorderable={filter === 'all'}
                  collapsed={collapsed}
                  onEdit={() => openEdit(q)}
                  onDelete={() => setDeleteTarget(q)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      {/* Bottom nav (sticky within the content column) */}
      <div className="sticky bottom-0 z-20 -mx-1 flex items-center justify-between gap-3 border-t border-border bg-surface/95 px-1 py-3 backdrop-blur">
        <Button variant="ghost" onClick={() => navigate('/teacher/quizzes/generator')}>
          <ArrowRight size={18} />
          {tk('backToStep1')}
        </Button>
        <Button
          onClick={() => navigate(`/teacher/quizzes/generator/publish/${quizId}`)}
          disabled={count === 0}
        >
          {tk('continueToStep3')} ({tk('countBadge', { count })})
          <ArrowLeft size={18} />
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
