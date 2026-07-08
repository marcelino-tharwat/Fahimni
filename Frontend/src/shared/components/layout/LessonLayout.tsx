import { Outlet } from 'react-router-dom';
import { AppHeader } from './AppHeader';

export function LessonLayout() {
  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="shrink-0">
          <AppHeader showBrand />
        </header>
        <main className="flex-1 overflow-y-auto p-3 md:p-4 lg:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
