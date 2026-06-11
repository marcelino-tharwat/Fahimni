import type { Stage, Chapter, Lesson } from '@/shared/types';

const YOUTUBE_URL = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';

export const mockStages: Stage[] = [
  {
    id: 'stage-1',
    tenantId: 'tenant-1',
    name: 'الصف الثاني الثانوي',
    description: 'منهج الكيمياء للصف الثاني الثانوي',
    order: 1,
  },
];

export const mockChapters: Chapter[] = [
  {
    id: 'chapter-1',
    tenantId: 'tenant-1',
    stageId: 'stage-1',
    name: 'الباب الثالث: الأحماض والقواعد',
    description: 'دراسة خواص الأحماض والقواعد وتفاعلاتها ومقياس الرقم الهيدروجيني.',
    price: 150,
    order: 1,
    isUnlocked: true,
  },
  {
    id: 'chapter-2',
    tenantId: 'tenant-1',
    stageId: 'stage-1',
    name: 'الباب الرابع: الكيمياء الكهربية',
    description: 'الخلايا الجلفانية والتحليل الكهربي وتطبيقاتهما.',
    price: 150,
    order: 2,
    isUnlocked: true,
  },
  {
    id: 'chapter-3',
    tenantId: 'tenant-1',
    stageId: 'stage-1',
    name: 'الباب الخامس: الكيمياء العضوية',
    description: 'المركبات العضوية ومجموعاتها الوظيفية وتفاعلاتها.',
    price: 200,
    order: 3,
    isUnlocked: false,
  },
];

export const mockLessons: Lesson[] = [
  {
    id: 'lesson-1',
    tenantId: 'tenant-1',
    chapterId: 'chapter-1',
    title: 'مقدمة في الأحماض والقواعد',
    description: 'تعريف الأحماض والقواعد وفقًا لنظريات أرهينيوس وبرونستد-لوري ولويس.',
    duration: 25,
    youtubeUrl: YOUTUBE_URL,
    order: 1,
    attachments: [
      { id: 'att-1', fileName: 'ملخص الدرس.pdf', fileSize: 2_400_000, url: '/files/lesson-1-summary.pdf' },
      { id: 'att-2', fileName: 'تمارين الباب.pdf', fileSize: 1_800_000, url: '/files/chapter-1-exercises.pdf' },
    ],
    progress: {
      lessonId: 'lesson-1',
      studentId: 'user-1',
      percentWatched: 75,
      completed: false,
      lastWatchedAt: '2025-10-01T18:30:00.000Z',
    },
  },
  {
    id: 'lesson-2',
    tenantId: 'tenant-1',
    chapterId: 'chapter-1',
    title: 'مقياس الرقم الهيدروجيني pH',
    description: 'حساب الرقم الهيدروجيني pH للمحاليل الحمضية والقاعدية وأهميته.',
    duration: 35,
    youtubeUrl: YOUTUBE_URL,
    order: 2,
    attachments: [
      { id: 'att-3', fileName: 'مسائل محلولة على pH.pdf', fileSize: 1_200_000, url: '/files/lesson-2-ph-problems.pdf' },
    ],
    progress: {
      lessonId: 'lesson-2',
      studentId: 'user-1',
      percentWatched: 30,
      completed: false,
      lastWatchedAt: '2025-10-03T20:10:00.000Z',
    },
  },
  {
    id: 'lesson-3',
    tenantId: 'tenant-1',
    chapterId: 'chapter-1',
    title: 'تفاعلات التعادل',
    description: 'تفاعلات الأحماض مع القواعد لتكوين الأملاح والماء وحسابات المعايرة.',
    duration: 30,
    youtubeUrl: YOUTUBE_URL,
    order: 3,
    attachments: [
      { id: 'att-4', fileName: 'ورقة عمل التعادل.pdf', fileSize: 950_000, url: '/files/lesson-3-neutralization.pdf' },
    ],
    progress: {
      lessonId: 'lesson-3',
      studentId: 'user-1',
      percentWatched: 0,
      completed: false,
      lastWatchedAt: '2025-10-05T17:00:00.000Z',
    },
  },
];
