import { describe, expect, it } from 'vitest';
import { authorizeRemoteEvent, type RemoteIdentity } from '../src/lib/remoteAuthorization';

const player: RemoteIdentity = { roomCode: 'ABCDE', role: 'player', playerId: 'player-1' };
const presentation: RemoteIdentity = { roomCode: 'ABCDE', role: 'presentation' };

describe('remote action authorization', () => {
  it('blocks every remote host action and room creation', () => {
    expect(() => authorizeRemoteEvent(undefined, 'host:adjust-score', { roomCode: 'ABCDE' })).toThrow(/host actions/i);
    expect(() => authorizeRemoteEvent(player, 'host:suspend-player', { roomCode: 'ABCDE' })).toThrow(/host actions/i);
    expect(() => authorizeRemoteEvent(undefined, 'room:create', {})).toThrow(/host actions/i);
  });

  it('allows only join/reconnect/presentation binding before authentication', () => {
    expect(() => authorizeRemoteEvent(undefined, 'player:join', { roomCode: 'ABCDE' })).not.toThrow();
    expect(() => authorizeRemoteEvent(undefined, 'player:reconnect', { roomCode: 'ABCDE', playerId: 'player-1' })).not.toThrow();
    expect(() => authorizeRemoteEvent(undefined, 'presentation:join', { roomCode: 'ABCDE' })).not.toThrow();
    expect(() => authorizeRemoteEvent(undefined, 'player:buzz', { roomCode: 'ABCDE', playerId: 'player-1' })).toThrow(/not authenticated/i);
  });

  it('binds player actions to the authenticated room and player id', () => {
    expect(() => authorizeRemoteEvent(player, 'player:buzz', { roomCode: 'ABCDE', playerId: 'player-1' })).not.toThrow();
    expect(() => authorizeRemoteEvent(player, 'player:reconnect', { roomCode: 'ABCDE', playerId: 'player-1' })).not.toThrow();
    expect(() => authorizeRemoteEvent(player, 'player:buzz', { roomCode: 'ABCDE', playerId: 'player-2' })).toThrow(/credentials/i);
    expect(() => authorizeRemoteEvent(player, 'player:buzz', { roomCode: 'ZZZZZ', playerId: 'player-1' })).toThrow(/room/i);
    expect(() => authorizeRemoteEvent(player, 'player:join', { roomCode: 'ABCDE' })).toThrow(/change session identity/i);
    expect(() => authorizeRemoteEvent(player, 'presentation:join', { roomCode: 'ABCDE' })).toThrow(/change session identity/i);
  });

  it('keeps presentation connections read-only', () => {
    expect(() => authorizeRemoteEvent(presentation, 'presentation:join', { roomCode: 'ABCDE' })).not.toThrow();
    expect(() => authorizeRemoteEvent(presentation, 'player:join', { roomCode: 'ABCDE' })).toThrow(/read-only/i);
    expect(() => authorizeRemoteEvent(presentation, 'player:buzz', { roomCode: 'ABCDE', playerId: 'player-1' })).toThrow(/read-only/i);
  });
});
