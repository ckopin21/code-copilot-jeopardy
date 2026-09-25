import { createServer, type Server as HttpServer } from 'node:http';
import { afterEach, describe, expect, it } from 'vitest';
import { io, type Socket } from 'socket.io-client';
import { createRoomServer, type GameReply, type RoomServer } from '../../server/roomServer';
import { SERVER_GAMES } from '../../server/games';
import { triviaServerGame } from '../../src/games/trivia/server';
import type { HostRoomCredentials, PlayerJoinCredentials } from '../../src/platform/rooms/types';
import { GAMES } from '../../src/games/registry';
import { createCounterGame, type CounterSnapshot } from './fixtures/counterGame';

class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>();
  get length(): number { return this.values.size; }
  clear(): void { this.values.clear(); }
  getItem(key: string): string | null { return this.values.get(key) ?? null; }
  key(index: number): string | null { return [...this.values.keys()][index] ?? null; }
  removeItem(key: string): void { this.values.delete(key); }
  setItem(key: string, value: string): void { this.values.set(key, value); }
}

let server: HttpServer | null = null;
let rooms: RoomServer | null = null;
const sockets: Socket[] = [];
let sequence = 0;

async function start(games = [triviaServerGame, createCounterGame()]): Promise<string> {
  server = createServer();
  rooms = createRoomServer({ httpServer: server, storage: new MemoryStorage(), games });
  await new Promise<void>((resolve) => server!.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('No TCP address');
  return `http://127.0.0.1:${address.port}`;
}

async function connect(url: string): Promise<Socket> {
  const socket = io(url, { transports: ['websocket'], reconnection: false, forceNew: true });
  sockets.push(socket);
  await new Promise<void>((resolve, reject) => { socket.once('connect', () => resolve()); socket.once('connect_error', reject); });
  return socket;
}

function send(socket: Socket, event: string, payload: Record<string, unknown>): Promise<GameReply> {
  return new Promise((resolve) => socket.emit('game:request', { requestId: `multi-${++sequence}`, event, payload }, resolve));
}
async function ok<T>(socket: Socket, event: string, payload: Record<string, unknown>): Promise<T> {
  const reply = await send(socket, event, payload);
  if (!reply.ok) throw new Error(`${event}: ${reply.error}`);
  return reply.data as T;
}

afterEach(async () => {
  for (const socket of sockets.splice(0)) socket.disconnect();
  await rooms?.close();
  if (server?.listening) await new Promise<void>((resolve) => server!.close(() => resolve()));
  rooms = null;
  server = null;
});

describe('multi-game room server', () => {
  it('keeps client and server game registries in sync', () => {
    expect(SERVER_GAMES.map((game) => game.id).sort()).toEqual(GAMES.map((game) => game.id).sort());
    expect(new Set(SERVER_GAMES.map((game) => game.storageFile)).size).toBe(SERVER_GAMES.length);
  });

  it('hosts two games at once with unique room codes and isolated actions', async () => {
    const counter = createCounterGame();
    const url = await start([triviaServerGame, counter]);

    const triviaHostSocket = await connect(url);
    const triviaHost = await ok<HostRoomCredentials>(triviaHostSocket, 'room:create', {});
    expect(rooms!.engine('trivia').hasRoom(triviaHost.roomCode)).toBe(true);

    // Force the counter game to try trivia's code first; the server must hand out another one.
    counter.lastEngine().nextCodes = [triviaHost.roomCode, 'CNTR1'];
    const counterHostSocket = await connect(url);
    const counterHost = await ok<HostRoomCredentials>(counterHostSocket, 'room:create', { game: 'counter' });
    expect(counterHost.roomCode).toBe('CNTR1');
    expect(counterHost.joinUrl).toContain('game=counter');

    // A phone joining by room code alone lands in the right game.
    const phone = await connect(url);
    const states: CounterSnapshot[] = [];
    phone.on('room:state', (state: CounterSnapshot) => states.push(state));
    const player = await ok<PlayerJoinCredentials>(phone, 'player:join', { roomCode: 'cntr1', name: 'Tapper', avatar: '🦊', accent: '#93c5fd' });
    await ok(phone, 'player:tap', { roomCode: player.roomCode, playerId: player.playerId, reconnectToken: player.reconnectToken });
    expect(rooms!.engine<ReturnType<typeof counter.lastEngine>>('counter').snapshot('CNTR1').total).toBe(1);

    // Each game's sanitizer runs for its own sockets, and actions don't leak between games.
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(states.at(-1)?.total).toBe(1);
    expect(states.at(-1)?.secret).toBe('');
    const crossGame = await send(counterHostSocket, 'host:start-game', { roomCode: counterHost.roomCode, hostToken: counterHost.hostToken });
    expect(crossGame.ok).toBe(false);
    expect(crossGame.error).toMatch(/Unsupported game event/);
    await ok(counterHostSocket, 'host:reset-total', { roomCode: counterHost.roomCode, hostToken: counterHost.hostToken });

    // Platform actions (pause/remove seat) work for any game.
    await ok(counterHostSocket, 'host:remove-player', { roomCode: counterHost.roomCode, hostToken: counterHost.hostToken, playerId: player.playerId });
    expect(counter.lastEngine().snapshot('CNTR1').players).toHaveLength(0);
    expect(rooms!.engine('trivia').snapshot(triviaHost.roomCode).players).toHaveLength(0);
  });

  it('rejects unknown games and merges game HTTP routes', async () => {
    const url = await start();
    const socket = await connect(url);
    const reply = await send(socket, 'room:create', { game: 'does-not-exist' });
    expect(reply.ok).toBe(false);
    expect(reply.error).toMatch(/Unknown game/);
    expect([...rooms!.httpRoutes.keys()].sort()).toEqual(['/api/counter/info', '/api/packs']);
  });

  it('refuses duplicate game ids and duplicate routes', () => {
    const httpServer = createServer();
    expect(() => createRoomServer({ httpServer, storage: new MemoryStorage(), games: [triviaServerGame, triviaServerGame] })).toThrow(/Duplicate game id/);
    const clash = { ...createCounterGame(), httpRoutes: { '/api/packs': () => [] } };
    expect(() => createRoomServer({ httpServer: createServer(), storage: new MemoryStorage(), games: [triviaServerGame, clash] })).toThrow(/route \/api\/packs/);
  });
});
