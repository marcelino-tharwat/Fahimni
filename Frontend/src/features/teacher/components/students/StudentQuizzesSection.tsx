import { useTranslation } from 'react-i18next';
import { BookOpen, PlayCircle } from 'lucide-react';
import { Badge, Skeleton } from '@/shared/components/ui';
import { localizeDigits, getQuizScoreColorClasses } from '@/features/teacher/lib/studentEngagementPresentation';
import type {
  TeacherStudentDetailQuiz,
  TeacherStudentQuizStatus,
} from '@/features/teacher/types/studentDetail';

interface StudentQuizzesSectionProps {
  quizzes: TeacherStudentDetailQuiz[];
  isLoading?: boolean;
}

type BadgeVariant = 'success' | 'danger' | 'warning' | 'info' | 'cyan' | 'default';

const STATUS_VARIANT: Record<TeacherStudentQuizStatus, BadgeVariant> = {
  not_started: 'default',
  in_progress: 'warning',
  completed: 'cyan',
  graded: 'success',
};

export function StudentQuizzesSection({ quizzes, isLoading }: StudentQuizzesSectionProps) {
  const { t, i18n } = useTranslation('teacher');
  const locale: 'ar' | 'en' = i18n.language.startsWith('ar') ? 'ar' : 'en';
  const percentSign = locale === 'ar' ? '٪' : '%';

  return (
    <div className="rounded-card border border-gray-300 bg-white shadow-card">
      <div className="border-b border-gray-300 p-4">
        <h3 className="text-h3 text-navy-800">{t('students.detail.quizzes.sectionTitle')}</h3>
      </div>

      {isLoading ? (
        <div className="space-y-2 p-4">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </div>
      ) : quizzes.length === 0 ? (
        <div className="p-8 text-center text-gray-500">{t('students.detail.quizzes.empty')}</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[600px] text-sm">
            <thead>
              <tr className="border-b border-gray-300 bg-gray-100">
                <th className="px-4 py-3 text-start text-caption font-semibold text-gray-700">
                  {t('students.detail.quizzes.columns.quizName')}
                </th>
                <th className="px-4 py-3 text-start text-caption font-semibold text-gray-700">
                  {t('students.detail.quizzes.columns.scope')}
                </th>
                <th className="px-4 py-3 text-start text-caption font-semibold text-gray-700">
                  {t('students.detail.quizzes.columns.score')}
                </th>
                <th className="px-4 py-3 text-start text-caption font-semibold text-gray-700">
                  {t('students.detail.quizzes.columns.status')}
                </th>
              </tr>
            </thead>
            <tbody>
              {quizzes.map((quiz) => {
                const ScopeIcon = quiz.scopeType === 'lesson' ? PlayCircle : BookOpen;
                return (
                  <tr
                    key={quiz.quizId}
                    className="border-b border-gray-300 transition-colors hover:bg-gray-50"
                  >
                    {/* Quiz name */}
                    <td className="px-4 py-3.5">
                      <span className="text-sm font-medium text-navy-800">{quiz.quizTitle}</span>
                    </td>

                    {/* Scope */}
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-2">
                        <ScopeIcon className="h-4 w-4 shrink-0 text-gray-500" />
                        <span className="text-sm text-gray-700">{quiz.scopeName}</span>
                      </div>
                    </td>

                    {/* Score */}
                    <td className="px-4 py-3.5">
                      {quiz.score === null ? (
                        <span className="text-gray-400">—</span>
                      ) : (
                        <span
                          className={`text-sm font-semibold ${
                            getQuizScoreColorClasses(quiz.score).textClass
                          }`}
                        >
                          {localizeDigits(Math.round(quiz.score), locale)}
                          {percentSign}
                        </span>
                      )}
                    </td>

                    {/* Status */}
                    <td className="px-4 py-3.5">
                      <Badge variant={STATUS_VARIANT[quiz.status]}>
                        {t(`students.detail.quizzes.status.${quiz.status}`)}
                      </Badge>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
