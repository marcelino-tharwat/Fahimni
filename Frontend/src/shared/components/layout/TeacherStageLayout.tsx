import { Outlet } from 'react-router-dom';
import { AppHeader } from './AppHeader';

export function TeacherStageLayout() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <AppHeader variant="minimal" />
      <main className="flex-1 px-3 py-4 md:px-6 md:py-6">
        <Outlet />
      </main>
    </div>
  );
}
