// Socket.io service — manages the WebSocket connection to backend
// Listens for real-time fact-check result updates.

import { io, Socket } from 'socket.io-client';
import * as SecureStore from 'expo-secure-store';
import { BACKEND_URL } from '@/constants';

let socket: Socket | null = null;

export const socketService = {
  /**
   * Connects to the backend WebSocket.
   *
   * Security: The server validates the Bearer token on the connection handshake.
   * Connections without a valid token are immediately disconnected server-side.
   * We read the session token from SecureStore (same key used by api.service.ts).
   */
  async connect(): Promise<void> {
    if (socket?.connected) return;
    // Disconnect any stale socket first
    if (socket) {
      socket.disconnect();
      socket = null;
    }

    // Read the Better-Auth session token from secure storage
    const token = await SecureStore.getItemAsync('session_token');
    if (!token) {
      console.warn('[Socket] No session token found — cannot connect to WebSocket.');
      return;
    }

    socket = io(BACKEND_URL, {
      // Pass the Bearer token in the handshake auth field (validated server-side)
      auth: { token },
      // Start with polling for reliability, then upgrade to websocket
      transports: ['polling', 'websocket'],
      reconnection: true,
      reconnectionAttempts: 15,
      reconnectionDelay: 2000,
      reconnectionDelayMax: 10000,
      timeout: 20000,
      forceNew: true,
    });

    socket.on('connect', () => {
      console.log('[Socket] Connected:', socket?.id);
    });

    socket.on('disconnect', (reason) => {
      console.log('[Socket] Disconnected:', reason);
    });

    socket.on('connect_error', (err) => {
      console.warn('[Socket] Connection error:', err.message);
    });
  },

  disconnect(): void {
    socket?.disconnect();
    socket = null;
  },

  onFactCheckUpdate(
    callback: (data: {
      factCheckId: string;
      status: string;
      result?: any;
      errorMessage?: string;
    }) => void
  ): () => void {
    if (!socket) return () => {};
    socket.on('factcheck:update', callback);
    // Return cleanup function
    return () => socket?.off('factcheck:update', callback);
  },

  onRevisionUpdate(
    callback: (data: {
      id: string;
      status: string;
      adminComment?: string | null;
      factCheckId: string;
    }) => void
  ): () => void {
    if (!socket) return () => {};
    socket.on('revision:update', callback);
    return () => socket?.off('revision:update', callback);
  },

  isConnected(): boolean {
    return socket?.connected ?? false;
  },
};
