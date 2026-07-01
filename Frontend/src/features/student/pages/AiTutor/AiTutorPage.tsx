import { useCallback, useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { BrainCircuit, History, RotateCcw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { tutorApi } from '@/features/student/api/aiTutor';
import type { AiTutorChatMessage, TutorMessage, TutorUsage } from '@/shared/types/aiTutor';
import { ConfirmDialog } from '@/shared/components/ui';
import { ChatInput } from './components/ChatInput';
import { ChatMessage } from './components/ChatMessage';
import { ConversationList } from './components/ConversationList';
import { TypingIndicator } from './components/TypingIndicator';
import { WelcomeMessage } from './components/WelcomeMessage';
import styles from './AiTutor.module.css';

export const TUTOR_USAGE_KEY = ['tutor', 'usage'] as const;
export const TUTOR_CONVERSATIONS_KEY = ['tutor', 'conversations'] as const;
export const tutorMessagesKey = (id: string) => ['tutor', 'messages', id] as const;

const ERROR_BUBBLE_ID = '__error__';

function toUiMessage(m: TutorMessage): AiTutorChatMessage {
  return {
    id: m.id,
    role: m.role === 'STUDENT' ? 'student' : 'assistant',
    content: m.content,
    status: m.status,
    citations: m.citations,
    createdAt: m.createdAt,
  };
}

function withErrorBubbles(messages: AiTutorChatMessage[]): AiTutorChatMessage[] {
  const out: AiTutorChatMessage[] = [];
  for (let i = 0; i < messages.length; i += 1) {
    const m = messages[i]!;
    out.push(m);
    if (m.role === 'student' && m.status === 'FAILED') {
      const next = messages[i + 1];
      if (!next || next.role !== 'assistant') {
        out.push({
          id: `${ERROR_BUBBLE_ID}-${m.id}`,
          role: 'assistant',
          content: '',
          failed: true,
        });
      }
    }
  }
  return out;
}

function newClientMessageId(): string {
  return crypto.randomUUID();
}

export function AiTutorPage() {
  const { t } = useTranslation('student');
  const navigate = useNavigate();
  const { conversationId } = useParams<{ conversationId?: string }>();
  const queryClient = useQueryClient();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [input, setInput] = useState('');
  const [localMessages, setLocalMessages] = useState<AiTutorChatMessage[]>([]);
  const [sending, setSending] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [usage, setUsage] = useState<TutorUsage | null>(null);

  const { data: usageData } = useQuery({
    queryKey: TUTOR_USAGE_KEY,
    queryFn: () => tutorApi.getUsageToday(),
  });

  useEffect(() => {
    if (usageData) setUsage(usageData);
  }, [usageData]);

  const {
    data: conversationsPage,
    isLoading: conversationsLoading,
    isError: conversationsError,
    refetch: refetchConversations,
  } = useQuery({
    queryKey: [...TUTOR_CONVERSATIONS_KEY, showArchived],
    queryFn: () => tutorApi.listConversations({ archived: showArchived }),
  });

  const {
    data: messagesPage,
    isLoading: messagesLoading,
    isError: messagesError,
  } = useQuery({
    queryKey: conversationId ? tutorMessagesKey(conversationId) : ['tutor', 'messages', 'none'],
    queryFn: () => tutorApi.listMessages(conversationId!),
    enabled: Boolean(conversationId),
  });

  useEffect(() => {
    if (messagesPage?.data) {
      setLocalMessages(messagesPage.data.map(toUiMessage));
    } else if (!conversationId) {
      setLocalMessages([]);
    }
  }, [messagesPage, conversationId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [localMessages, sending]);

  const quotaExhausted = usage !== null && usage.remaining <= 0;

  const createConversation = useMutation({
    mutationFn: () => tutorApi.createConversation(),
    onSuccess: (c) => {
      void queryClient.invalidateQueries({ queryKey: TUTOR_CONVERSATIONS_KEY });
      navigate(`/student/ai-tutor/${c.id}`);
      setDrawerOpen(false);
    },
  });

  const deleteConversation = useMutation({
    mutationFn: () => tutorApi.deleteConversation(conversationId!),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: TUTOR_CONVERSATIONS_KEY });
      setDeleteOpen(false);
      navigate('/student/ai-tutor');
    },
  });

  const archiveConversation = useMutation({
    mutationFn: (isArchived: boolean) =>
      tutorApi.updateConversation(conversationId!, { isArchived }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: TUTOR_CONVERSATIONS_KEY });
    },
  });

  const renameConversation = useMutation({
    mutationFn: (title: string) => tutorApi.updateConversation(conversationId!, { title }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: TUTOR_CONVERSATIONS_KEY });
    },
  });

  const conversations = conversationsPage?.data ?? [];

  const handleNewChat = useCallback(() => {
    createConversation.mutate();
  }, [createConversation]);

  const handleRename = useCallback(() => {
    if (!conversationId) return;
    const current = conversations.find((c) => c.id === conversationId)?.title ?? '';
    const title = window.prompt(t('aiTutor.rename'), current);
    if (title?.trim()) renameConversation.mutate(title.trim());
  }, [conversationId, conversations, renameConversation, t]);

  const handleSend = useCallback(async () => {
    const content = input.trim();
    if (!content || content.length < 10 || sending || quotaExhausted) return;

    const clientMessageId = newClientMessageId();
    let activeId = conversationId;

    setSending(true);
    setInput('');

    try {
      if (!activeId) {
        const created = await tutorApi.createConversation();
        activeId = created.id;
        navigate(`/student/ai-tutor/${activeId}`, { replace: true });
      }

      const optimistic: AiTutorChatMessage = {
        id: `opt-${clientMessageId}`,
        role: 'student',
        content,
        status: 'PENDING',
        clientMessageId,
      };
      setLocalMessages((prev) => [...prev, optimistic]);

      const result = await tutorApi.sendMessage(activeId, { content, clientMessageId });
      setUsage(result.usage);
      void queryClient.setQueryData(TUTOR_USAGE_KEY, result.usage);
      setLocalMessages((prev) => {
        const withoutOpt = prev.filter((m) => m.id !== optimistic.id);
        const persisted = [
          toUiMessage(result.studentMessage),
          ...(result.assistantMessage ? [toUiMessage(result.assistantMessage)] : []),
        ];
        return [...withoutOpt, ...persisted];
      });
      void queryClient.invalidateQueries({ queryKey: TUTOR_CONVERSATIONS_KEY });
      void queryClient.invalidateQueries({ queryKey: tutorMessagesKey(activeId) });
    } catch {
      if (activeId) {
        await queryClient.invalidateQueries({ queryKey: tutorMessagesKey(activeId) });
      }
      setInput(content);
    } finally {
      setSending(false);
    }
  }, [conversationId, input, navigate, queryClient, quotaExhausted, sending]);

  const handleRetry = useCallback(
    async (errorBubbleId: string) => {
      if (!conversationId || sending) return;
      const studentId = errorBubbleId.replace(`${ERROR_BUBBLE_ID}-`, '').replace('failed-', '');
      const studentMsg = localMessages.find((m) => m.id === studentId || m.id === `failed-${studentId}`);
      const messageId = studentMsg?.id?.startsWith('failed-')
        ? studentMsg.id.replace('failed-', '')
        : studentId;

      if (!messageId || messageId.startsWith('opt-')) return;

      setSending(true);
      try {
        const result = await tutorApi.retryMessage(conversationId, messageId);
        setUsage(result.usage);
        void queryClient.invalidateQueries({ queryKey: tutorMessagesKey(conversationId) });
        setLocalMessages((prev) => {
          const base = prev.filter(
            (m) => m.id !== messageId && m.id !== `${ERROR_BUBBLE_ID}-${messageId}`,
          );
          return [
            ...base,
            toUiMessage(result.studentMessage),
            ...(result.assistantMessage ? [toUiMessage(result.assistantMessage)] : []),
          ];
        });
      } finally {
        setSending(false);
      }
    },
    [conversationId, localMessages, queryClient, sending],
  );

  const displayMessages = withErrorBubbles(localMessages);
  const showWelcome = !conversationId && localMessages.length === 0 && !sending;
  const showConversationWelcome =
    Boolean(conversationId) && localMessages.length === 0 && !messagesLoading && !sending;

  return (
    <div className={styles.page}>
      <aside className={styles.sidebar} aria-label={t('aiTutor.history')}>
        <ConversationList
          conversations={conversations}
          activeId={conversationId}
          loading={conversationsLoading}
          error={conversationsError}
          hasMore={conversationsPage?.meta.hasMore}
          showArchived={showArchived}
          onSelect={(id) => {
            navigate(`/student/ai-tutor/${id}`);
            setDrawerOpen(false);
          }}
          onToggleArchiveFilter={() => setShowArchived((v) => !v)}
          onRetry={() => void refetchConversations()}
        />
      </aside>

      {drawerOpen && (
        <>
          <button
            type="button"
            className={styles.drawerOverlay}
            aria-label={t('aiTutor.cancel')}
            onClick={() => setDrawerOpen(false)}
          />
          <div className={styles.drawer}>
            <ConversationList
              conversations={conversations}
              activeId={conversationId}
              loading={conversationsLoading}
              error={conversationsError}
              hasMore={conversationsPage?.meta.hasMore}
              showArchived={showArchived}
              onSelect={(id) => {
                navigate(`/student/ai-tutor/${id}`);
                setDrawerOpen(false);
              }}
              onToggleArchiveFilter={() => setShowArchived((v) => !v)}
              onRetry={() => void refetchConversations()}
            />
          </div>
        </>
      )}

      <div className={styles.chatColumn}>
        <div className={styles.header}>
          <div className={styles.headerTitle}>
            <button
              type="button"
              className="me-2 lg:hidden"
              onClick={() => setDrawerOpen(true)}
              aria-label={t('aiTutor.history')}
            >
              <History size={18} />
            </button>
            <BrainCircuit size={18} className="text-accent" aria-hidden />
            <span>{t('aiTutor.title')}</span>
          </div>
          <div className="flex items-center gap-2">
            {usage && (
              <span className="hidden text-xs text-text-muted sm:inline">
                {quotaExhausted
                  ? t('aiTutor.quotaExhausted')
                  : t('aiTutor.remainingQuestions', { count: usage.remaining })}
              </span>
            )}
            {conversationId && (
              <>
                <button
                  type="button"
                  className="text-xs text-text-secondary hover:underline"
                  onClick={handleRename}
                >
                  {t('aiTutor.rename')}
                </button>
                <button
                  type="button"
                  className="text-xs text-text-secondary hover:underline"
                  onClick={() =>
                    archiveConversation.mutate(
                      !conversations.find((c) => c.id === conversationId)?.isArchived,
                    )
                  }
                >
                  {conversations.find((c) => c.id === conversationId)?.isArchived
                    ? t('aiTutor.unarchive')
                    : t('aiTutor.archive')}
                </button>
                <button
                  type="button"
                  className="text-xs text-danger hover:underline"
                  onClick={() => setDeleteOpen(true)}
                >
                  {t('aiTutor.delete')}
                </button>
              </>
            )}
            <button
              type="button"
              className="flex items-center gap-1 rounded-xl px-3 py-1.5 text-xs font-medium text-text-secondary hover:bg-gray-100"
              onClick={handleNewChat}
              disabled={createConversation.isPending}
            >
              <RotateCcw size={13} aria-hidden />
              {t('aiTutor.newChat')}
            </button>
          </div>
        </div>

        <div className={styles.messages}>
          <div className={styles.messagesInner}>
            {messagesError && <p className="text-center text-sm text-danger">{t('aiTutor.historyError')}</p>}
            {showWelcome || showConversationWelcome ? (
              <WelcomeMessage onSuggest={setInput} />
            ) : (
              <>
                {displayMessages.map((m) => (
                  <ChatMessage
                    key={m.id}
                    message={m}
                    onRetry={
                      m.id.startsWith(ERROR_BUBBLE_ID) ? () => void handleRetry(m.id) : undefined
                    }
                  />
                ))}
                {sending && <TypingIndicator />}
                <div ref={messagesEndRef} />
              </>
            )}
          </div>
        </div>

        <ChatInput
          value={input}
          onChange={setInput}
          onSend={() => void handleSend()}
          loading={sending}
          disabled={quotaExhausted}
        />
      </div>

      <ConfirmDialog
        isOpen={deleteOpen}
        title={t('aiTutor.deleteConfirmTitle')}
        message={t('aiTutor.deleteConfirmBody')}
        confirmLabel={t('aiTutor.delete')}
        cancelLabel={t('aiTutor.cancel')}
        variant="danger"
        onConfirm={() => deleteConversation.mutate()}
        onCancel={() => setDeleteOpen(false)}
      />
    </div>
  );
}
