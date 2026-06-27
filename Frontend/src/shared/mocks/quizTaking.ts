import type { QuizMeta, QuizQuestion } from '@/shared/types';

export const mockQuizQuestions: QuizQuestion[] = [
  {
    id: 'q_mcq_1',
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
    id: 'q_mcq_2',
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
    id: 'q_mcq_3',
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
    id: 'q_tf_4',
    type: 'tf',
    text: 'الأحماض تُحوّل لون ورقة عباد الشمس الزرقاء إلى اللون الأحمر.',
    points: 1,
  },
  {
    id: 'q_tf_5',
    type: 'tf',
    text: 'المحلول الذي قيمة pH له أكبر من 7 يكون وسطًا حمضيًا.',
    points: 1,
  },
  {
    id: 'q_fill_6',
    type: 'fill',
    text: 'الماء الذي يحتوي على نسبة عالية من أيونات الكالسيوم والمغنيسيوم يسمى ماء ...',
    points: 2,
    placeholder: 'اكتب المصطلح العلمي...',
  },
  {
    id: 'q_essay_7',
    type: 'essay',
    text: 'اشرح بالتفصيل نظرية برونستد-لوري للأحماض والقواعد، مع ذكر مثال لكل منهما.',
    points: 5,
    maxLength: 2000,
  },
];

export const mockQuizMeta: QuizMeta = {
  title: 'اختبار الأحماض والقواعد',
  chapterLabel: 'الفصل الأول: الأحماض والقواعد',
  totalQuestions: mockQuizQuestions.length,
  totalPoints: mockQuizQuestions.reduce((sum, q) => sum + q.points, 0),
  durationMinutes: 10,
  attemptLabel: 'محاولة 1 من 2',
};
