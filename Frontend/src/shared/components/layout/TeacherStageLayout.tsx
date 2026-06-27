import { Outlet } from 'react-router-dom';
import { GraduationCap } from 'lucide-react';

export function TeacherStageLayout() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="flex h-16 items-center border-b border-border bg-surface px-4 md:px-6">
        <div className="flex items-center gap-2">
          <GraduationCap size={24} className="text-accent" />
          <span className="font-cairo text-lg font-bold text-text-primary">Fahimni</span>
        </div>
      </header>
      <main className="flex-1 px-3 py-4 md:px-6 md:py-6">
        <Outlet />
      </main>
    </div>
  );
}
