import { io, type Socket } from 'socket.io-client';

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000/api';
const SOCKET_URL = BASE_URL.replace('/api', '');

let socket: Socket | null = null;

export function createSocket(userId: string): Socket {
  if (socket?.connected) {
    return socket;
  }

  socket = io(SOCKET_URL, {
    withCredentials: true,
    transports: ['websocket', 'polling'],
    auth: { userId },
  });

  socket.on('connect_error', () => {
    // Silently handle — polling fallback will cover
  });

  return socket;
}

export function getSocket(): Socket | null {
  return socket;
}

export function disconnectSocket(): void {
  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
  }
}
