import { useTranslation } from 'react-i18next';
import { Send } from 'lucide-react';
import { Badge, Button, Card, Input } from '@/shared/components/ui';
import { mockLessons } from '@/shared/mocks/content';
import { cn } from '@/shared/lib/utils/cn';

interface ChatMessage {
  id: string;
  role: 'student' | 'assistant';
  content: string;
  source?: string;
}

const lessonTitle = mockLessons[0]!.title;

const messages: ChatMessage[] = [
  {
    id: 'msg-1',
    role: 'student',
    content: 'إيه الفرق بين الحمض القوي والحمض الضعيف؟',
  },
  {
    id: 'msg-2',
    role: 'assistant',
    content:
      'الحمض القوي يتأين تأينًا تامًا في الماء (مثل HCl)، أي أن كل جزيئاته تتحول إلى أيونات. أما الحمض الضعيف فيتأين تأينًا جزئيًا فقط (مثل حمض الخليك CH₃COOH)، ويبقى جزء كبير منه في صورة جزيئات غير متأينة، ولذلك يكون توصيله للكهرباء أضعف.',
    source: lessonTitle,
  },
];

export function AiTutorPage() {
  const { t } = useTranslation();

  return (
    <div className="mx-auto flex h-[calc(100dvh-8rem)] w-full max-w-2xl flex-col gap-4 md:h-[calc(100vh-9rem)]">
      <div className="flex items-center justify-between gap-2">
        <h1 className="font-cairo text-xl font-bold text-text-primary">
          {t('student:aiTutor.title')}
        </h1>
        <Badge variant="info">{t('student:aiTutor.remainingQuestions', { count: 3 })}</Badge>
      </div>

      {/* Messages */}
      <div className="flex flex-1 flex-col gap-4 overflow-y-auto">
        {messages.map((message) => {
          const isStudent = message.role === 'student';
          return (
            <div
              key={message.id}
              className={cn('flex w-full', isStudent ? 'justify-end' : 'justify-start')}
            >
              <div className="flex max-w-[80%] flex-col gap-2">
                <Card
                  padding="md"
                  className={cn(
                    'font-cairo text-sm',
                    isStudent ? 'bg-accent text-white' : 'text-text-primary',
                  )}
                >
                  {message.content}
                </Card>
                {message.source && (
                  <Badge variant="info" className="self-start">
                    {t('student:aiTutor.source', { lesson: message.source })}
                  </Badge>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Input area */}
      <div className="flex items-center gap-2">
        <Input className="flex-1" placeholder={t('student:aiTutor.placeholder')} />
        <Button aria-label={t('student:aiTutor.send')}>
          <Send size={18} />
        </Button>
      </div>
    </div>
  );
}
