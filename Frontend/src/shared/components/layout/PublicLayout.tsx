import { Outlet, useLocation } from 'react-router-dom';
import { Topbar } from './Topbar';

/**
 * The landing page ('/' and tenant landing '/t/:slug') ships its own full-width
 * navbar and edge-to-edge gradient sections, so it opts out of the shared Topbar
 * and the centered max-width container that wrap the rest of the public routes.
 *
 * Auth pages (/auth, /forgot-password, /t/:slug/auth) also ship their own
 * full-screen layouts with self-contained navbars, so they opt out too.
 */
function isLandingRoute(pathname: string): boolean {
  return pathname === '/' || /^\/t\/[^/]+\/?$/.test(pathname);
}

function isAuthRoute(pathname: string): boolean {
  return pathname === '/auth' || pathname === '/forgot-password' || /^\/t\/[^/]+\/auth\/?$/.test(pathname);
}

export function PublicLayout() {
  const { pathname } = useLocation();

  if (isLandingRoute(pathname) || isAuthRoute(pathname)) {
    return (
      <div className="min-h-screen bg-background">
        <Outlet />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Topbar showMenu={false} />
      <main className="mx-auto max-w-7xl px-3 py-6 md:px-4 md:py-8 lg:px-6">
        <Outlet />
      </main>
    </div>
  );
}
