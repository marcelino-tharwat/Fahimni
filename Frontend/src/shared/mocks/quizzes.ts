import type { Quiz, QuizAttempt } from '@/shared/types';

export const mockQuiz: Quiz = {
  id: 'quiz-1',
  tenantId: 'tenant-1',
  chapterId: 'chapter-1',
  title: 'اختبار الأحماض والقواعد',
  status: 'published',
  createdAt: '2025-10-02T09:00:00.000Z',
  questions: [
    {
      id: 'q1',
      type: 'mcq',
      question: 'حسب نظرية أرهينيوس، الحمض هو المادة التي تعطي عند ذوبانها في الماء:',
      options: ['أيونات الهيدروكسيد OH⁻', 'أيونات الهيدروجين H⁺', 'أيونات الصوديوم Na⁺', 'جزيئات الماء'],
      correctAnswer: 1,
      explanation: 'حسب نظرية أرهينيوس، الحمض مادة تتأين في الماء معطيةً أيونات الهيدروجين H⁺ (أو الهيدرونيوم H₃O⁺).',
    },
    {
      id: 'q2',
      type: 'mcq',
      question: 'أي من المواد التالية يُعد قاعدة قوية؟',
      options: ['حمض الخليك CH₃COOH', 'هيدروكسيد الصوديوم NaOH', 'حمض الكربونيك H₂CO₃', 'كلوريد الصوديوم NaCl'],
      correctAnswer: 1,
      explanation: 'هيدروكسيد الصوديوم NaOH قاعدة قوية لأنه يتأين تأينًا تامًا في الماء معطيًا أيونات OH⁻.',
    },
    {
      id: 'q3',
      type: 'mcq',
      question: 'ما قيمة الرقم الهيدروجيني pH لمحلول متعادل عند درجة حرارة 25°م؟',
      options: ['0', '7', '14', '1'],
      correctAnswer: 1,
      explanation: 'المحلول المتعادل تكون فيه قيمة pH = 7 عند 25°م، حيث يتساوى تركيز أيونات H⁺ و OH⁻.',
    },
    {
      id: 'q4',
      type: 'true_false',
      question: 'الأحماض تُحوّل لون ورقة عباد الشمس الزرقاء إلى اللون الأحمر.',
      correctAnswer: true,
      explanation: 'صحيح، فالأحماض تُحوّل ورقة عباد الشمس الزرقاء إلى الأحمر، بينما القواعد تفعل العكس.',
    },
    {
      id: 'q5',
      type: 'true_false',
      question: 'المحلول الذي قيمة pH له أكبر من 7 يكون وسطًا حمضيًا.',
      correctAnswer: false,
      explanation: 'خطأ، فالقيمة الأكبر من 7 تدل على وسط قاعدي، أما الوسط الحمضي فقيمته أقل من 7.',
    },
  ],
};

export const mockQuizAttempt: QuizAttempt = {
  id: 'attempt-1',
  quizId: 'quiz-1',
  studentId: 'user-1',
  // يوسف أجاب على 4 إجابات صحيحة وأخطأ في السؤال الأخير (q5).
  answers: {
    q1: 1,
    q2: 1,
    q3: 1,
    q4: true,
    q5: true,
  },
  score: 4,
  submittedAt: '2025-10-04T16:20:00.000Z',
};
