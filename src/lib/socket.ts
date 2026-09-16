import { io, type Socket } from 'socket.io-client';

export const socket: Socket = io({ autoConnect: true, reconnection: true, reconnectionAttempts: Infinity });

export function emitAck<T = unknown>(event: string, payload: unknown): Promise<T> {
  return new Promise((resolve, reject) => {
    socket.timeout(8000).emit(event, payload, (error: Error | null, response: { ok: boolean; data?: T; error?: string }) => {
      if (error) return reject(new Error('Server did not respond'));
      if (!response?.ok) return reject(new Error(response?.error ?? 'Request failed'));
      resolve(response.data as T);
    });
  });
}
