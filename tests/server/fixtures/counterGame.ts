// The smallest complete game the room server can host. Tests use it to prove games stay
// isolated, and docs/adding-a-game.md points to it as a reference implementation.
import type { HostRoomCredentials, PlayerJoinCredentials, RoomEngine, RoomRole, ServerGame } from '../../../src/platform/rooms/types';
import type { PlayerJoinInput } from '../../../src/platform/players/playerJoin';
import { randomToken, secureEqual } from '../../../src/platform/rooms/tokens';

export interface CounterPlayer { id: string; name: string; connected: boolean; taps: number }
export interface CounterSnapshot { code: string; players: CounterPlayer[]; secret: string; total: number }

interface CounterRoom { state: CounterSnapshot; hostToken: string; playerTokens: Map<string, string>; presentationToken: string }

export class CounterEngine implements RoomEngine<CounterSnapshot> {
  private rooms = new Map<string, CounterRoom>();
  /** Codes tried in order before random ones; lets tests force a collision with another game. */
  nextCodes: string[] = [];
  persistenceOk = true;
  onPersistenceChange: ((ok: boolean) => void) | null = null;

  constructor(private readonly isRoomCodeTaken: (code: string) => boolean = () => false) {}

  private room(code: string): CounterRoom {
    const room = this.rooms.get(code.toUpperCase());
    if (!room) throw new Error('Room not found or expired');
    return room;
  }
  private hostRoom(code: string, hostToken: string): CounterRoom {
    const room = this.room(code);
    if (!secureEqual(room.hostToken, hostToken)) throw new Error('Host authorization failed');
    return room;
  }
  private allocateCode(): string {
    for (let attempt = 0; attempt < 100; attempt += 1) {
      const code = this.nextCodes.shift() ?? randomToken(4).replace(/[^A-Z0-9]/gi, 'X').slice(0, 5).toUpperCase();
      if (!this.rooms.has(code) && !this.isRoomCodeTaken(code)) return code;
    }
    throw new Error('Could not allocate room code');
  }
  private credentials(room: CounterRoom, baseUrl: string): HostRoomCredentials {
    const code = room.state.code;
    return {
      roomCode: code,
      hostToken: room.hostToken,
      joinUrl: `${baseUrl}/?game=counter&mode=player&room=${code}`,
      presentationUrl: `${baseUrl}/?game=counter&mode=presentation&room=${code}&display=${room.presentationToken}`
    };
  }

  hasRoom(code: string): boolean { return this.rooms.has(code.toUpperCase()); }
  snapshot(code: string): CounterSnapshot { return structuredClone(this.room(code).state); }
  tick(): string[] { return []; }

  createRoom(baseUrl: string): HostRoomCredentials {
    const code = this.allocateCode();
    const room: CounterRoom = { state: { code, players: [], secret: 'host-only', total: 0 }, hostToken: randomToken(), playerTokens: new Map(), presentationToken: randomToken() };
    this.rooms.set(code, room);
    return this.credentials(room, baseUrl);
  }
  hostCredentials(code: string, hostToken: string, baseUrl: string): HostRoomCredentials { return this.credentials(this.hostRoom(code, hostToken), baseUrl); }
  reconnectHost(code: string, hostToken: string): CounterSnapshot { this.hostRoom(code, hostToken); return this.snapshot(code); }
  setHostConnected(): void {}

  joinPlayer(code: string, input: PlayerJoinInput): PlayerJoinCredentials {
    const room = this.room(code);
    const player: CounterPlayer = { id: `player_${room.state.players.length + 1}`, name: input.name, connected: true, taps: 0 };
    const reconnectToken = randomToken();
    room.state.players.push(player);
    room.playerTokens.set(player.id, reconnectToken);
    return { playerId: player.id, reconnectToken, roomCode: code };
  }
  reconnectPlayer(code: string, playerId: string, reconnectToken: string): PlayerJoinCredentials {
    const room = this.room(code);
    if (!secureEqual(room.playerTokens.get(playerId) ?? '', reconnectToken)) throw new Error('Player authorization failed');
    this.setPlayerConnected(code, playerId, true);
    return { playerId, reconnectToken, roomCode: code };
  }
  setPlayerConnected(code: string, playerId: string, connected: boolean): void {
    const player = this.room(code).state.players.find((candidate) => candidate.id === playerId);
    if (player) player.connected = connected;
  }
  suspendPlayer(code: string, hostToken: string, playerId: string): void { this.hostRoom(code, hostToken); this.setPlayerConnected(code, playerId, false); }
  removePlayer(code: string, hostToken: string, playerId: string): void {
    const room = this.hostRoom(code, hostToken);
    room.state.players = room.state.players.filter((player) => player.id !== playerId);
    room.playerTokens.delete(playerId);
  }
  presentationSnapshot(code: string, presentationToken: string): CounterSnapshot {
    if (!secureEqual(this.room(code).presentationToken, presentationToken)) throw new Error('Invalid presentation capability');
    return this.snapshot(code);
  }
  rotatePresentationCapability(code: string, hostToken: string): string {
    const room = this.hostRoom(code, hostToken);
    room.presentationToken = randomToken();
    return room.presentationToken;
  }

  tap(code: string, playerId: string): CounterSnapshot {
    const room = this.room(code);
    const player = room.state.players.find((candidate) => candidate.id === playerId);
    if (!player) throw new Error('Player not found');
    player.taps += 1;
    room.state.total += 1;
    return this.snapshot(code);
  }
  resetTotal(code: string, hostToken: string): CounterSnapshot {
    const room = this.hostRoom(code, hostToken);
    room.state.total = 0;
    room.state.players.forEach((player) => { player.taps = 0; });
    return this.snapshot(code);
  }
}

export function createCounterGame(): ServerGame<CounterEngine, CounterSnapshot> & { lastEngine: () => CounterEngine } {
  let engine: CounterEngine | null = null;
  return {
    id: 'counter',
    storageFile: 'counter-rooms.json',
    createEngine: (_storage, { isRoomCodeTaken }) => (engine = new CounterEngine(isRoomCodeTaken)),
    lastEngine: () => engine!,
    sanitize: (snapshot: CounterSnapshot, role: RoomRole) => role === 'host' ? snapshot : { ...snapshot, secret: '' },
    hostActions: {
      'host:reset-total': ({ engine: game, roomCode, hostToken }) => game.resetTotal(roomCode, hostToken)
    },
    playerActions: {
      'player:tap': ({ engine: game, roomCode, playerId }) => game.tap(roomCode, playerId)
    },
    httpRoutes: { '/api/counter/info': () => ({ name: 'Counter' }) }
  };
}
