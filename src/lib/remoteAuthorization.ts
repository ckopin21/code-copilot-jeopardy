export type RemoteIdentity = {
  roomCode: string;
  role: 'player' | 'presentation';
  playerId?: string;
};

const INITIAL_EVENTS = new Set(['player:join', 'player:reconnect', 'presentation:join']);

export function authorizeRemoteEvent(
  identity: RemoteIdentity | undefined,
  event: string,
  payload: Record<string, unknown>
): void {
  if (event === 'room:create' || event.startsWith('host:')) {
    throw new Error('Host actions are not available from remote clients');
  }

  const roomCode = String(payload.roomCode ?? '').toUpperCase();

  if (!identity) {
    if (!INITIAL_EVENTS.has(event)) throw new Error('Remote session is not authenticated');
    return;
  }

  if (!roomCode || roomCode !== identity.roomCode.toUpperCase()) {
    throw new Error('Remote session does not match this room');
  }

  if (identity.role === 'presentation') {
    if (event !== 'presentation:join') throw new Error('Presentation connections are read-only');
    return;
  }

  if (event === 'player:join' || event === 'presentation:join' || !event.startsWith('player:')) {
    throw new Error('Player connection cannot change session identity');
  }

  if (String(payload.playerId ?? '') !== identity.playerId) {
    throw new Error('Player connection does not match these credentials');
  }
}
