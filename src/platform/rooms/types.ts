/**
 * The contract between the shared room server (server/roomServer.ts) and each game.
 *
 * The platform owns sockets, Host/player/Presentation identity, request de-duplication,
 * reconnects, heartbeats, and broadcasting. A game owns its rules and state by
 * implementing `RoomEngine` and registering a `ServerGame`. Nothing in this file may
 * import Node-only modules, so games can share these types with their browser code.
 */

import type { PlayerJoinInput } from '../players/playerJoin';

export type RoomRole = 'host' | 'player' | 'presentation';

export interface HostRoomCredentials {
  roomCode: string;
  hostToken: string;
  joinUrl: string;
  presentationUrl: string;
}

export interface PlayerJoinCredentials {
  playerId: string;
  reconnectToken: string;
  roomCode: string;
}

/** The minimum every game's room snapshot must expose to the platform. */
export interface BaseRoomSnapshot {
  code: string;
  players: ReadonlyArray<{ id: string; connected: boolean }>;
}

/** Authoritative state for one game type. The server creates one engine per game. */
export interface RoomEngine<Snapshot extends BaseRoomSnapshot = BaseRoomSnapshot> {
  hasRoom(roomCode: string): boolean;
  snapshot(roomCode: string): Snapshot;
  /** Advances timers and expiry. Returns codes of rooms whose state changed. */
  tick(now?: number): string[];

  createRoom(baseUrl: string, settings?: unknown): HostRoomCredentials;
  hostCredentials(roomCode: string, hostToken: string, baseUrl: string): HostRoomCredentials;
  reconnectHost(roomCode: string, hostToken: string): Snapshot;
  setHostConnected(roomCode: string, connected: boolean): void;

  /** `input` has already been validated by the platform's player join schema. */
  joinPlayer(roomCode: string, input: PlayerJoinInput): PlayerJoinCredentials;
  reconnectPlayer(roomCode: string, playerId: string, reconnectToken: string): PlayerJoinCredentials;
  setPlayerConnected(roomCode: string, playerId: string, connected: boolean): void;
  /** Host "Pause seat": disconnects a player but keeps their seat. */
  suspendPlayer(roomCode: string, hostToken: string, playerId: string): void;
  /** Host "Remove": deletes the player and their reconnect identity. */
  removePlayer(roomCode: string, hostToken: string, playerId: string): void;

  presentationSnapshot(roomCode: string, presentationToken: string): Snapshot;
  rotatePresentationCapability(roomCode: string, hostToken: string): string;

  /** False while saving rooms to disk is failing. */
  readonly persistenceOk: boolean;
  onPersistenceChange: ((ok: boolean) => void) | null;
}

export interface HostActionContext<Engine> {
  engine: Engine;
  roomCode: string;
  hostToken: string;
  payload: Record<string, unknown>;
}

export interface PlayerActionContext<Engine> {
  engine: Engine;
  roomCode: string;
  playerId: string;
  reconnectToken: string;
  payload: Record<string, unknown>;
}

/** Called after every state-changing request or timer tick, before the new state is broadcast. */
export interface StateChangeContext<Snapshot> {
  roomCode: string;
  before: Snapshot | null;
  after: Snapshot | null;
  /** Stable id for this change, e.g. for de-duplicating animations on clients. */
  changeId: string;
  /** Sends an event to every screen connected to the room. */
  emitToRoom(event: string, data: unknown): void;
}

export interface ServerGame<Engine extends RoomEngine<Snapshot>, Snapshot extends BaseRoomSnapshot = ReturnType<Engine['snapshot']>> {
  /** Matches the client registry id in src/games/registry.ts. */
  id: string;
  /** Local file for persisted rooms, relative to the server's working directory. */
  storageFile: string;
  createEngine(storage: Storage, options: { isRoomCodeTaken(code: string): boolean }): Engine;
  /** Removes anything a role must not see (hidden answers, other players' secrets). */
  sanitize(snapshot: Snapshot, role: RoomRole, playerId?: string): Snapshot;
  /** Game-specific `host:*` actions. Platform actions (reconnect, pause/remove seat, display link) are handled for you. */
  hostActions: Record<string, (context: HostActionContext<Engine>) => unknown>;
  /** Game-specific `player:*` actions. `player:join/reconnect/heartbeat` are handled for you. */
  playerActions: Record<string, (context: PlayerActionContext<Engine>) => unknown>;
  onStateChange?(context: StateChangeContext<Snapshot>): void;
  /** Extra read-only GET endpoints, e.g. `/api/packs`. */
  httpRoutes?: Record<string, () => unknown>;
}
