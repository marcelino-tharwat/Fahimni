import { useEffect, useRef } from 'react';
import { useAppSelector } from '@/shared/store/hooks';
import { createSocket, disconnectSocket } from '@/shared/lib/socket/socketClient';
import { setupNotificationSocketListeners } from '@/features/notifications/api/notificationsApi';

export function SocketProvider({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated } = useAppSelector((state) => state.auth);
  const connectedRef = useRef(false);
  const listenersSetupRef = useRef(false);

  useEffect(() => {
    if (isAuthenticated && user && !connectedRef.current) {
      connectedRef.current = true;
      listenersSetupRef.current = false;
      const socket = createSocket(user.id);

      socket.on('connect', () => {
        if (!listenersSetupRef.current) {
          listenersSetupRef.current = true;
          setupNotificationSocketListeners(socket);
        }
      });

      if (socket.connected) {
        listenersSetupRef.current = true;
        setupNotificationSocketListeners(socket);
      }
    }

    if (!isAuthenticated && connectedRef.current) {
      connectedRef.current = false;
      listenersSetupRef.current = false;
      disconnectSocket();
    }

    return () => {
      if (connectedRef.current) {
        connectedRef.current = false;
        listenersSetupRef.current = false;
        disconnectSocket();
      }
    };
  }, [isAuthenticated, user]);

  return <>{children}</>;
}
