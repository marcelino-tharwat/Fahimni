import { BookOpen } from 'lucide-react';
import { Avatar, Card } from '@/shared/components/ui';
import { useAppSelector } from '@/shared/store/hooks';
import { mockChapters } from '@/shared/mocks/content';
import { mockEnrollments } from '@/shared/mocks/enrollment';

export function StudentProfilePage() {
  const user = useAppSelector((state) => state.auth.user);

  const enrolledChapters = mockEnrollments
    .filter((enrollment) => enrollment.studentId === (user?.id ?? 'user-1'))
    .map((enrollment) => mockChapters.find((chapter) => chapter.id === enrollment.chapterId))
    .filter((chapter): chapter is (typeof mockChapters)[number] => Boolean(chapter));

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      {/* Profile header */}
      <Card padding="lg" className="flex items-center gap-4">
        <Avatar name={user?.name ?? 'طالب'} src={user?.avatarUrl} size="lg" />
        <div className="flex flex-col">
          <span className="font-cairo text-lg font-bold text-text-primary">
            {user?.name ?? 'طالب'}
          </span>
          <span className="font-cairo text-sm text-text-secondary">{user?.email ?? ''}</span>
        </div>
      </Card>

      {/* Enrolled courses */}
      <Card padding="lg" className="flex flex-col gap-4">
        <h2 className="font-cairo text-base font-semibold text-text-primary">الدورات المشتركة</h2>
        <div className="flex flex-col gap-2">
          {enrolledChapters.map((chapter) => (
            <div
              key={chapter.id}
              className="flex items-center gap-3 rounded-input border border-border p-3"
            >
              <BookOpen size={18} className="text-accent" />
              <span className="font-cairo text-sm text-text-primary">{chapter.name}</span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
