import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import cors from 'cors';
import QRCode from 'qrcode';
import { createServer } from 'node:http';
import { Server } from 'socket.io';
import { z } from 'zod';
import { GameEngine } from './gameEngine.js';
import { PackRegistry } from './packRegistry.js';
import { playerJoinSchema } from '../src/shared/validation.js';
import type { RoomSnapshot } from '../src/shared/types.js';

const PORT = Number(process.env.PORT ?? 3000);
const HOST = process.env.HOST ?? '0.0.0.0';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const clientDist = path.resolve(__dirname, '../../dist-client');

const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));
const httpServer = createServer(app);
const io = new Server(httpServer, { cors: { origin: true, credentials: true }, maxHttpBufferSize: 1_000_000 });
const packs = new PackRegistry();
const engine = new GameEngine(packs);

type Ack<T = unknown> = (response: { ok: true; data: T } | { ok: false; error: string }) => void;
const socketIdentity = new Map<string, { roomCode: string; role: 'host' | 'player' | 'presentation'; playerId?: string }>();

function lanAddress(): string | null {
  for (const addresses of Object.values(os.networkInterfaces())) {
    for (const entry of addresses ?? []) {
      if (entry.family === 'IPv4' && !entry.internal) return entry.address;
    }
  }
  return null;
}

function publicBaseUrl(requestHost?: string): string {
  if (process.env.PUBLIC_BASE_URL) return process.env.PUBLIC_BASE_URL.replace(/\/$/, '');
  const lan = lanAddress();
  if (lan) return `http://${lan}:${PORT}`;
  if (requestHost) return `http://${requestHost}`;
  return `http://localhost:${PORT}`;
}

function safeSnapshot(snapshot: RoomSnapshot, role: 'host' | 'player' | 'presentation', playerId?: string): RoomSnapshot {
  const copy = structuredClone(snapshot);
  const revealFinal = copy.phase === 'final-review' || copy.phase === 'recap';
  copy.players = copy.players.map((player) => {
    const own = role === 'player' && player.id === playerId;
    if (role === 'host' && revealFinal) return player;
    if (own) return player;
    return { ...player, finalWager: revealFinal ? player.finalWager : null, finalAnswer: revealFinal ? player.finalAnswer : null };
  });
  if (copy.currentQuestion && role !== 'host' && !copy.currentQuestion.answerRevealed) copy.currentQuestion.acceptedAnswers = undefined;
  if (copy.phase === 'daily-double-wager' && role !== 'host' && copy.currentQuestion) copy.currentQuestion.text = '';
  if (copy.finalRound && role !== 'host' && !revealFinal) copy.finalRound.acceptedAnswers = [];
  return copy;
}

function emitRoom(roomCode: string): void {
  let snapshot: RoomSnapshot;
  try { snapshot = engine.snapshot(roomCode); } catch { return; }
  const sockets = io.sockets.adapter.rooms.get(roomCode);
  if (!sockets) return;
  for (const socketId of sockets) {
    const socket = io.sockets.sockets.get(socketId);
    const identity = socketIdentity.get(socketId);
    if (!socket || !identity) continue;
    socket.emit('room:state', safeSnapshot(snapshot, identity.role, identity.playerId));
  }
}

function fail(error: unknown): { ok: false; error: string } {
  return { ok: false, error: error instanceof Error ? error.message : 'Unknown error' };
}

app.get('/api/health', (_req, res) => res.json({ ok: true }));
app.get('/api/packs', (_req, res) => res.json(packs.list()));
app.post('/api/packs/import', (req, res) => {
  try { res.status(201).json(packs.import(req.body)); }
  catch (error) { res.status(400).json({ error: error instanceof Error ? error.message : 'Invalid pack' }); }
});
app.get('/api/network', (req, res) => res.json({ baseUrl: publicBaseUrl(req.get('host') ?? undefined), lanAddress: lanAddress() }));
app.get('/api/qr', async (req, res) => {
  const value = z.string().url().safeParse(req.query.value);
  if (!value.success) return res.status(400).json({ error: 'A valid URL is required' });
  try {
    const dataUrl = await QRCode.toDataURL(value.data, { margin: 1, width: 320 });
    return res.json({ dataUrl });
  } catch {
    return res.status(500).json({ error: 'Could not generate QR code' });
  }
});

io.on('connection', (socket) => {
  socket.on('room:create', (payload: { settings?: unknown; baseUrl?: string }, ack: Ack) => {
    try {
      const credentials = engine.createRoom(payload?.baseUrl || publicBaseUrl(), (payload?.settings ?? {}) as never);
      socket.join(credentials.roomCode);
      socketIdentity.set(socket.id, { roomCode: credentials.roomCode, role: 'host' });
      ack({ ok: true, data: credentials });
      emitRoom(credentials.roomCode);
    } catch (error) { ack(fail(error)); }
  });

  socket.on('host:reconnect', (payload: { roomCode: string; hostToken: string }, ack: Ack) => {
    try {
      const snapshot = engine.reconnectHost(payload.roomCode.toUpperCase(), payload.hostToken);
      socket.join(snapshot.code);
      socketIdentity.set(socket.id, { roomCode: snapshot.code, role: 'host' });
      ack({ ok: true, data: safeSnapshot(snapshot, 'host') });
      emitRoom(snapshot.code);
    } catch (error) { ack(fail(error)); }
  });

  socket.on('presentation:join', (payload: { roomCode: string }, ack: Ack) => {
    try {
      const snapshot = engine.snapshot(payload.roomCode.toUpperCase());
      socket.join(snapshot.code);
      socketIdentity.set(socket.id, { roomCode: snapshot.code, role: 'presentation' });
      ack({ ok: true, data: safeSnapshot(snapshot, 'presentation') });
    } catch (error) { ack(fail(error)); }
  });

  socket.on('player:join', (payload: unknown, ack: Ack) => {
    try {
      const input = playerJoinSchema.parse(payload);
      const credentials = engine.joinPlayer(input.roomCode.toUpperCase(), input);
      socket.join(credentials.roomCode);
      socketIdentity.set(socket.id, { roomCode: credentials.roomCode, role: 'player', playerId: credentials.playerId });
      ack({ ok: true, data: credentials });
      emitRoom(credentials.roomCode);
    } catch (error) { ack(fail(error)); }
  });

  socket.on('player:reconnect', (payload: { roomCode: string; playerId: string; reconnectToken: string }, ack: Ack) => {
    try {
      const credentials = engine.reconnectPlayer(payload.roomCode.toUpperCase(), payload.playerId, payload.reconnectToken);
      socket.join(credentials.roomCode);
      socketIdentity.set(socket.id, { roomCode: credentials.roomCode, role: 'player', playerId: credentials.playerId });
      ack({ ok: true, data: credentials });
      emitRoom(credentials.roomCode);
    } catch (error) { ack(fail(error)); }
  });

  const hostAction = <T extends object>(event: string, handler: (payload: T & { roomCode: string; hostToken: string }) => RoomSnapshot | void) => {
    socket.on(event, (payload: T & { roomCode: string; hostToken: string }, ack: Ack) => {
      try {
        const data = handler({ ...payload, roomCode: payload.roomCode.toUpperCase() });
        ack({ ok: true, data: data ?? null });
        emitRoom(payload.roomCode.toUpperCase());
      } catch (error) { ack(fail(error)); }
    });
  };

  hostAction<{ updates: Partial<import('../src/shared/types.js').GameSettings> }>('host:update-settings', (payload) => engine.updateSettings(payload.roomCode, payload.hostToken, payload.updates));
  hostAction('host:start-game', (payload) => engine.startGame(payload.roomCode, payload.hostToken));
  hostAction<{ questionId: string; dailyDoublePlayerId?: string }>('host:select-question', (payload) => engine.selectQuestion(payload.roomCode, payload.hostToken, payload.questionId, payload.dailyDoublePlayerId));
  hostAction<{ wager: number }>('host:daily-double-wager', (payload) => engine.setDailyDoubleWager(payload.roomCode, payload.hostToken, payload.wager));
  hostAction('host:open-buzzers', (payload) => engine.openBuzzers(payload.roomCode, payload.hostToken));
  hostAction('host:close-buzzers', (payload) => engine.closeBuzzers(payload.roomCode, payload.hostToken));
  hostAction<{ playerId: string }>('host:local-buzz', (payload) => engine.localBuzz(payload.roomCode, payload.hostToken, payload.playerId));
  hostAction<{ playerId: string; correct: boolean }>('host:resolve-answer', (payload) => engine.resolveAnswer(payload.roomCode, payload.hostToken, payload.playerId, payload.correct));
  hostAction('host:reveal-answer', (payload) => engine.revealAnswer(payload.roomCode, payload.hostToken));
  hostAction('host:advance-board', (payload) => engine.advanceToBoard(payload.roomCode, payload.hostToken));
  hostAction<{ playerId: string; delta: number }>('host:adjust-score', (payload) => engine.adjustScore(payload.roomCode, payload.hostToken, payload.playerId, payload.delta));
  hostAction<{ playerId: string }>('host:remove-player', (payload) => engine.removePlayer(payload.roomCode, payload.hostToken, payload.playerId));
  hostAction('host:pause', (payload) => engine.pause(payload.roomCode, payload.hostToken));
  hostAction('host:resume', (payload) => engine.resume(payload.roomCode, payload.hostToken));
  hostAction('host:start-timer', (payload) => engine.startTimer(payload.roomCode, payload.hostToken));
  hostAction('host:stop-timer', (payload) => engine.stopTimer(payload.roomCode, payload.hostToken));
  hostAction('host:begin-final-wagers', (payload) => engine.beginFinalWagers(payload.roomCode, payload.hostToken));
  hostAction('host:open-final-question', (payload) => engine.openFinalQuestion(payload.roomCode, payload.hostToken));
  hostAction('host:begin-final-review', (payload) => engine.beginFinalReview(payload.roomCode, payload.hostToken));
  hostAction<{ playerId: string; correct?: boolean }>('host:resolve-final', (payload) => engine.resolveFinalAnswer(payload.roomCode, payload.hostToken, payload.playerId, payload.correct));
  hostAction('host:end-game', (payload) => engine.endGame(payload.roomCode, payload.hostToken));

  socket.on('player:buzz', (payload: { roomCode: string; playerId: string; reconnectToken: string }, ack: Ack) => {
    try {
      const result = engine.buzz(payload.roomCode.toUpperCase(), payload.playerId, payload.reconnectToken);
      ack({ ok: true, data: { accepted: result.accepted, reason: result.reason } });
      emitRoom(payload.roomCode.toUpperCase());
    } catch (error) { ack(fail(error)); }
  });

  socket.on('player:final-wager', (payload: { roomCode: string; playerId: string; reconnectToken: string; wager: number }, ack: Ack) => {
    try {
      engine.submitFinalWager(payload.roomCode.toUpperCase(), payload.playerId, payload.reconnectToken, payload.wager);
      ack({ ok: true, data: null });
      emitRoom(payload.roomCode.toUpperCase());
    } catch (error) { ack(fail(error)); }
  });

  socket.on('player:final-answer', (payload: { roomCode: string; playerId: string; reconnectToken: string; answer: string }, ack: Ack) => {
    try {
      engine.submitFinalAnswer(payload.roomCode.toUpperCase(), payload.playerId, payload.reconnectToken, payload.answer);
      ack({ ok: true, data: null });
      emitRoom(payload.roomCode.toUpperCase());
    } catch (error) { ack(fail(error)); }
  });

  socket.on('disconnect', () => {
    const identity = socketIdentity.get(socket.id);
    if (!identity) return;
    try {
      if (identity.role === 'host') engine.setHostConnected(identity.roomCode, false);
      if (identity.role === 'player' && identity.playerId) engine.setPlayerConnected(identity.roomCode, identity.playerId, false);
      emitRoom(identity.roomCode);
    } catch { /* room may already be gone */ }
    socketIdentity.delete(socket.id);
  });
});

setInterval(() => {
  for (const code of engine.tick()) emitRoom(code);
  for (const [socketId, identity] of socketIdentity) {
    const socket = io.sockets.sockets.get(socketId);
    if (!socket) continue;
    try {
      const snapshot = engine.snapshot(identity.roomCode);
      if (snapshot.timer.running) socket.emit('timer:tick', safeSnapshot(snapshot, identity.role, identity.playerId).timer);
    } catch { /* expired */ }
  }
}, 250).unref();

if (process.env.NODE_ENV === 'production') {
  app.use(express.static(clientDist));
  app.get('*', (_req, res) => res.sendFile(path.join(clientDist, 'index.html')));
}

httpServer.listen(PORT, HOST, () => {
  const lan = lanAddress();
  console.log(`Blue Stage Trivia server: http://localhost:${PORT}`);
  if (lan) console.log(`Phone/LAN URL: http://${lan}:${PORT}`);
});
