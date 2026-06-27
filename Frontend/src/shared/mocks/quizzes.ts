import type { Quiz, QuizAttempt, QuizQuestion } from '@/shared/types';

const questions: QuizQuestion[] = [
  {
    id: 'q1',
    type: 'mcq',
    text: 'حسب نظرية أرهينيوس، الحمض هو المادة التي تعطي عند ذوبانها في الماء:',
    points: 2,
    options: [
      { id: 'a', label: 'أ', text: 'أيونات الهيدروكسيد OH⁻' },
      { id: 'b', label: 'ب', text: 'أيونات الهيدروجين H⁺' },
      { id: 'c', label: 'ج', text: 'أيونات الصوديوم Na⁺' },
      { id: 'd', label: 'د', text: 'جزيئات الماء' },
    ],
  },
  {
    id: 'q2',
    type: 'mcq',
    text: 'أي من المواد التالية يُعد قاعدة قوية؟',
    points: 2,
    options: [
      { id: 'a', label: 'أ', text: 'حمض الخليك CH₃COOH' },
      { id: 'b', label: 'ب', text: 'هيدروكسيد الصوديوم NaOH' },
      { id: 'c', label: 'ج', text: 'حمض الكربونيك H₂CO₃' },
      { id: 'd', label: 'د', text: 'كلوريد الصوديوم NaCl' },
    ],
  },
  {
    id: 'q3',
    type: 'mcq',
    text: 'ما قيمة الرقم الهيدروجيني pH لمحلول متعادل عند درجة حرارة 25°م؟',
    points: 2,
    options: [
      { id: 'a', label: 'أ', text: '0' },
      { id: 'b', label: 'ب', text: '7' },
      { id: 'c', label: 'ج', text: '14' },
      { id: 'd', label: 'د', text: '1' },
    ],
  },
  {
    id: 'q4',
    type: 'tf',
    text: 'الأحماض تُحوّل لون ورقة عباد الشمس الزرقاء إلى اللون الأحمر.',
    points: 1,
  },
  {
    id: 'q5',
    type: 'tf',
    text: 'المحلول الذي قيمة pH له أكبر من 7 يكون وسطًا حمضيًا.',
    points: 1,
  },
];

export const mockQuiz: Quiz = {
  id: 'quiz-1',
  tenantId: 'tenant-1',
  chapterId: 'chapter-1',
  title: 'اختبار الأحماض والقواعد',
  status: 'published',
  questions,
  createdAt: '2025-10-02T09:00:00.000Z',
};

export const mockQuizAttempt: QuizAttempt = {
  id: 'attempt-1',
  quizId: 'quiz-1',
  studentId: 'user-1',
  answers: { q1: 'b', q2: 'b', q3: 'b', q4: 'true', q5: 'true' },
  score: 4,
  submittedAt: '2025-10-04T16:20:00.000Z',
};

type ResultInfo = Record<string, { correctAnswer: string; explanation: string }>;

export const mockQuizResults: ResultInfo = {
  q1: { correctAnswer: 'b', explanation: 'حسب نظرية أرهينيوس، الحمض مادة تتأين في الماء معطيةً أيونات الهيدروجين H⁺ (أو الهيدرونيوم H₃O⁺).' },
  q2: { correctAnswer: 'b', explanation: 'هيدروكسيد الصوديوم NaOH قاعدة قوية لأنه يتأين تأينًا تامًا في الماء معطيًا أيونات OH⁻.' },
  q3: { correctAnswer: 'b', explanation: 'المحلول المتعادل تكون فيه قيمة pH = 7 عند 25°م، حيث يتساوى تركيز أيونات H⁺ و OH⁻.' },
  q4: { correctAnswer: 'true', explanation: 'صحيح، فالأحماض تُحوّل ورقة عباد الشمس الزرقاء إلى الأحمر، بينما القواعد تفعل العكس.' },
  q5: { correctAnswer: 'false', explanation: 'خطأ، فالقيمة الأكبر من 7 تدل على وسط قاعدي، أما الوسط الحمضي فقيمته أقل من 7.' },
};
