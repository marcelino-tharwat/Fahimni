import { Outlet } from 'react-router-dom';
import { GraduationCap } from 'lucide-react';

export function TeacherStageLayout() {
  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      <header className="flex h-16 items-center border-b border-gray-200 bg-white px-6">
        <div className="flex items-center gap-2">
          <GraduationCap size={24} className="text-cyan-500" />
          <span className="font-cairo text-lg font-bold text-navy-900">Fahimni</span>
        </div>
      </header>
      <main className="flex-1 px-6 py-6">
        <Outlet />
      </main>
    </div>
  );
}
