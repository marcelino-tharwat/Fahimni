import { RouterProvider } from 'react-router-dom';
import { AppProviders } from './providers/AppProviders';
import { router } from './router';
import { Toast, FloatingWhatsAppButton } from '@/shared/components/ui';

export default function App() {
  return (
    <AppProviders>
      <RouterProvider router={router} />
      <Toast />
      <FloatingWhatsAppButton />
    </AppProviders>
  );
}
