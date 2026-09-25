import { useEffect, useMemo, useRef, useState } from 'react';
import { GAME_PRESETS } from '../config';
import type { RoomSnapshot } from '../types';
import type { HostRoomCredentials } from '../../../platform/rooms/types';
import { emitAck, getPlayerConnectionHealth, socket, type PlayerConnectionHealth } from '../../../platform/net/socket';
import { audio } from '../../../platform/audio/audio';
import { readAccessibility, saveAccessibility, type AccessibilityPreferences } from '../../../platform/ui/accessibility';
import { HOST_CREDENTIALS_EVENT, readActiveHostCredentials } from '../../../platform/session/hostCredentials';
import { ComebackBoostNotice } from './ComebackBoostNotice';
import { useOutsideDismiss } from '../../../platform/ui/useOutsideDismiss';
type TransitionCard = { key: string; eyebrow: string; title: string; detail?: string; categories?: string[] };

function readCredentials(): HostRoomCredentials | null {
  try { return readActiveHostCredentials(); }
  catch { return null; }
}

function healthLabel(item?: PlayerConnectionHealth): string {
  if (!item || item.quality === 'offline') return 'OFFLINE';
  if (item.quality === 'good') return 'READY';
  if (item.quality === 'fair') return 'CHECKING IN';
  return 'STALE';
}

function phaseLabel(room: RoomSnapshot): string {
  return room.phase.replace(/-/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function HostEnhancements() {
  const [credentials, setCredentials] = useState<HostRoomCredentials | null>(() => readCredentials());
  const [room, setRoom] = useState<RoomSnapshot | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [preflightOpen, setPreflightOpen] = useState(false);
  const [health, setHealth] = useState<PlayerConnectionHealth[]>([]);
  const [testedIds, setTestedIds] = useState<Set<string>>(new Set());
  const [transition, setTransition] = useState<TransitionCard | null>(null);
  const [accessibility, setAccessibility] = useState<AccessibilityPreferences>(() => readAccessibility());
  const [actionMessage, setActionMessage] = useState('');
  const [persistenceOk, setPersistenceOk] = useState(true);
  const lastPhaseRef = useRef<RoomSnapshot['phase'] | null>(null);
  const lastGameStartedRef = useRef<number | null>(null);
  const transitionHydratedRef = useRef(false);
  const transitionTimerRef = useRef<number | null>(null);
  const commandTriggerRef = useRef<HTMLButtonElement | null>(null);
  const commandDrawerRef = useRef<HTMLElement | null>(null);
  const preflightRef = useRef<HTMLElement | null>(null);

  useOutsideDismiss(drawerOpen && !preflightOpen, () => setDrawerOpen(false), commandDrawerRef, commandTriggerRef);
  useOutsideDismiss(preflightOpen, () => setPreflightOpen(false), preflightRef);

  useEffect(() => {
    const syncCredentials = () => {
      const latest = readCredentials();
      setCredentials((current) => {
        if (!latest) return current;
        if (current?.roomCode === latest.roomCode && current.hostToken === latest.hostToken) return current;
        return latest;
      });
    };
    syncCredentials();
    window.addEventListener(HOST_CREDENTIALS_EVENT, syncCredentials);
    window.addEventListener('storage', syncCredentials);
    return () => {
      window.removeEventListener(HOST_CREDENTIALS_EVENT, syncCredentials);
      window.removeEventListener('storage', syncCredentials);
    };
  }, []);

  useEffect(() => {
    const onPersistence = (status: { ok?: boolean }) => setPersistenceOk(status?.ok !== false);
    socket.on('server:persistence', onPersistence);
    return () => socket.off('server:persistence', onPersistence);
  }, []);

  useEffect(() => {
    const onState = (snapshot: RoomSnapshot) => {
      setRoom(snapshot);
      const latest = readCredentials();
      if (latest?.roomCode === snapshot.code) setCredentials(latest);
    };
    socket.on('room:state', onState);
    return () => socket.off('room:state', onState);
  }, []);

  // Connection health is only shown in the drawer and the pre-game check, so only poll while one is open.
  const healthRoomCode = room && credentials?.roomCode === room.code && (drawerOpen || preflightOpen) ? room.code : null;
  useEffect(() => {
    if (!healthRoomCode) return;
    const update = () => setHealth(getPlayerConnectionHealth(healthRoomCode));
    update();
    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, [healthRoomCode]);

  useEffect(() => {
    if (!room) return;
    if (!transitionHydratedRef.current) {
      transitionHydratedRef.current = true;
      lastPhaseRef.current = room.phase;
      lastGameStartedRef.current = room.gameStartedAt;
      return;
    }
    const previous = lastPhaseRef.current;
    const gameChanged = room.gameStartedAt !== lastGameStartedRef.current;
    lastPhaseRef.current = room.phase;
    lastGameStartedRef.current = room.gameStartedAt;

    let next: TransitionCard | null = null;
    let duration = 0;
    if (room.phase === 'board' && room.board && (previous === 'lobby' || gameChanged)) {
      next = { key: `categories-${room.gameStartedAt}`, eyebrow: 'ROUND START', title: 'Tonight’s Categories', categories: room.board.categories };
      duration = 5500;
      audio.cue('category');
    } else if (room.phase === 'daily-double-wager' && previous !== 'daily-double-wager') {
      next = { key: `dd-${room.currentQuestion?.questionId}`, eyebrow: 'SPECIAL QUESTION', title: 'DAILY DOUBLE', detail: 'One player. One locked wager.' };
      duration = 1500;
      audio.cue('daily-double');
    } else if (room.phase === 'final-category' && previous !== 'final-category') {
      next = { key: `final-${room.gameStartedAt}`, eyebrow: 'THE BOARD IS COMPLETE', title: 'FINAL ROUND', detail: room.finalRound?.category };
      duration = 1900;
      audio.cue('round');
    } else if (room.phase === 'recap' && previous !== 'recap') {
      next = { key: `finish-${room.gameEndedAt}`, eyebrow: 'GAME COMPLETE', title: 'FINAL RESULTS', detail: 'The podium is ready.' };
      duration = 1200;
      audio.cue('winner');
    }

    if (!next || accessibility.reduceMotion) return;
    if (transitionTimerRef.current !== null) window.clearTimeout(transitionTimerRef.current);
    setTransition(next);
    transitionTimerRef.current = window.setTimeout(() => {
      setTransition(null);
      transitionTimerRef.current = null;
    }, duration);
  }, [room, accessibility.reduceMotion]);

  useEffect(() => {
    if (!accessibility.reduceMotion) return;
    if (transitionTimerRef.current !== null) {
      window.clearTimeout(transitionTimerRef.current);
      transitionTimerRef.current = null;
    }
    setTransition(null);
  }, [accessibility.reduceMotion]);

  useEffect(() => () => {
    if (transitionTimerRef.current !== null) window.clearTimeout(transitionTimerRef.current);
  }, []);

  const healthMap = useMemo(() => new Map(health.map((item) => [item.playerId, item])), [health]);
  const connectedCount = room?.players.filter((player) => player.connected).length ?? 0;
  const allReady = Boolean(room?.players.length) && connectedCount === room!.players.length && room!.players.every((player) => ['good', 'fair'].includes(healthMap.get(player.id)?.quality ?? ''));

  if (!credentials || !room || credentials.roomCode !== room.code) return null;

  const hostAction = async (event: string, payload: Record<string, unknown> = {}) => {
    setActionMessage('');
    try {
      await emitAck(event, { roomCode: credentials.roomCode, hostToken: credentials.hostToken, ...payload });
      return true;
    } catch (error) {
      setActionMessage(error instanceof Error ? error.message : 'Action failed');
      return false;
    }
  };

  const undoLastScore = async () => {
    setActionMessage('');
    try {
      const restored = await emitAck<RoomSnapshot>('host:undo-last-score', { roomCode: credentials.roomCode, hostToken: credentials.hostToken });
      window.dispatchEvent(new CustomEvent<RoomSnapshot>('blue-stage:score-undo', { detail: restored }));
    } catch (error) {
      setActionMessage(error instanceof Error ? error.message : 'Undo failed');
    }
  };

  const runControllerTest = async () => {
    try {
      const reached = await emitAck<string[]>('host:test-controllers', { roomCode: credentials.roomCode, hostToken: credentials.hostToken });
      setTestedIds(new Set(reached));
      setActionMessage(reached.length ? `Sent controller test to ${reached.length} phone${reached.length === 1 ? '' : 's'}.` : 'No connected phones were reachable.');
      window.setTimeout(() => setHealth(getPlayerConnectionHealth(room.code)), 500);
    } catch (error) {
      setActionMessage(error instanceof Error ? error.message : 'Controller test failed');
    }
  };

  const rename = (playerId: string, currentName: string) => {
    const name = prompt('Rename player', currentName);
    if (name === null || !name.trim()) return;
    void hostAction('host:rename-player', { playerId, name });
  };

  const remove = (playerId: string, name: string) => {
    if (!confirm(`Permanently remove ${name}? Their score, stats, and saved reconnect seat will be erased.`)) return;
    void hostAction('host:remove-player', { playerId });
  };

  const updateAccessibility = (updates: Partial<AccessibilityPreferences>) => {
    const next = { ...accessibility, ...updates };
    setAccessibility(next);
    saveAccessibility(next);
  };

  return <>
    <ComebackBoostNotice room={room} surface="host" />
    <button ref={commandTriggerRef} className="host-command-trigger" onClick={() => setDrawerOpen((open) => !open)} aria-expanded={drawerOpen} aria-label="Open host controls">
      <span>HOST</span><b>{connectedCount}</b>
    </button>

    {drawerOpen && <aside ref={commandDrawerRef} className="host-command-drawer" aria-label="Host control panel">
      <header><div><small>CONTROL PANEL</small><strong>Room {room.code}</strong></div><button onClick={() => setDrawerOpen(false)} aria-label="Close">×</button></header>

      <section className="host-command-section recovery-status">
        <div><small>{persistenceOk ? 'AUTO RECOVERY' : 'RECOVERY WARNING'}</small><strong>{persistenceOk ? 'Saved continuously' : 'Storage failed · in-memory only'}</strong></div>
        <span>{phaseLabel(room)}{room.timer.running ? ' · timer active' : ''}</span>
      </section>

      {room.phase === 'lobby' && <section className="host-command-section">
        <div className="drawer-section-title"><strong>Game presets</strong><small>One click, then fine-tune normally.</small></div>
        <div className="preset-grid">{GAME_PRESETS.map((preset) => <button key={preset.id} onClick={() => void hostAction('host:update-settings', { updates: preset.settings })}><strong>{preset.name}</strong><span>{preset.description}</span></button>)}</div>
      </section>}

      <section className="host-command-section comeback-rules-card">
        <div className="drawer-section-title"><strong>Comeback boosts</strong><small>Last-place help, only on that player’s turn.</small></div>
        <p><b>2× boost:</b> if the sole last-place player trails the leader by at least 2× the board’s highest base clue value, every ordinary clue on that player’s turn scores 2× for them. Each player gets two successful uses per game.</p>
        <p><b>3× boost:</b> if that deficit reaches 4× the same board reference, every ordinary clue on that player’s turn scores 3× while the one triple use remains.</p>
        <p><b>A use is spent only when that player answers correctly.</b> A miss or no answer loses only the normal effective value. If someone else buzzes, they score normally and the boost stays available.</p>
        <p><b>Other score modifiers stack.</b> A late-game 2× clue plus a 2× comeback boost pays 4× the original base clue. Daily Doubles and Final do not use comeback boosts.</p>
      </section>

      <section className="host-command-section">
        <div className="drawer-section-title"><strong>Players</strong><button className="drawer-link" onClick={() => setPreflightOpen(true)}>Connection check</button></div>
        <div className="drawer-player-list">{room.players.length ? room.players.map((player) => {
          const item = healthMap.get(player.id);
          return <article key={player.id} className={`drawer-player-row ${player.connected ? '' : 'offline'}`}>
            <span className="seat-number">P{player.seat}</span><span className="drawer-player-avatar">{player.avatar}</span><div><strong>{player.name}</strong><small>{healthLabel(item)} · {player.score.toLocaleString()} pts</small></div><div className="drawer-player-actions"><button onClick={() => rename(player.id, player.name)}>Rename</button>{player.connected && <button onClick={() => void hostAction('host:suspend-player', { playerId: player.id })}>Pause</button>}<button className="danger" onClick={() => remove(player.id, player.name)}>Remove</button></div>
          </article>;
        }) : <p className="drawer-empty">No players joined yet.</p>}</div>
      </section>

      <section className="host-command-section">
        <div className="drawer-section-title"><strong>Recovery tools</strong><small>Undo restores score, stats, streaks, and the previous scoring state.</small></div>
        <button className="drawer-wide-button" onClick={() => void undoLastScore()}>↶ Undo Last Score / Ruling</button>
      </section>

      <section className="host-command-section">
        <div className="drawer-section-title"><strong>Accessibility</strong><small>Stored on this display.</small></div>
        <label className="drawer-toggle"><input type="checkbox" checked={accessibility.largeText} onChange={(event) => updateAccessibility({ largeText: event.target.checked })}/><span>Large text</span></label>
        <label className="drawer-toggle"><input type="checkbox" checked={accessibility.highContrast} onChange={(event) => updateAccessibility({ highContrast: event.target.checked })}/><span>High contrast</span></label>
        <label className="drawer-toggle"><input type="checkbox" checked={accessibility.reduceMotion} onChange={(event) => updateAccessibility({ reduceMotion: event.target.checked })}/><span>Reduce motion</span></label>
        <label className="drawer-toggle"><input type="checkbox" checked={accessibility.soundCaptions} onChange={(event) => updateAccessibility({ soundCaptions: event.target.checked })}/><span>Sound captions</span></label>
      </section>

      {actionMessage && <p className="drawer-message">{actionMessage}</p>}
    </aside>}

    {preflightOpen && <div className="enhancement-modal-backdrop">
      <section ref={preflightRef} tabIndex={-1} className="preflight-modal" role="dialog" aria-modal="true" aria-label="Controller connection check">
        <button className="enhancement-modal-close" data-modal-initial-focus onClick={() => setPreflightOpen(false)} aria-label="Close">×</button>
        <div className="section-kicker gold">PRE-GAME CHECK</div><h2>Controllers ready?</h2><p>Phones should be connected and checking in recently. Test sends a sound/haptic confirmation to every reachable controller.</p>
        <div className="preflight-list">{room.players.length ? room.players.map((player) => {
          const item = healthMap.get(player.id);
          return <div key={player.id} className={`preflight-row quality-${item?.quality ?? 'offline'}`}><span>P{player.seat}</span><b>{player.avatar} {player.name}</b><strong>{healthLabel(item)}</strong><small>{item?.ageMs == null ? 'No heartbeat' : `${Math.round(item.ageMs / 100) / 10}s since check-in`}{testedIds.has(player.id) ? ' · test sent' : ''}</small></div>;
        }) : <p>No phones are connected yet.</p>}</div>
        <div className="preflight-summary"><strong>{allReady ? '✓ All reserved controllers are ready' : 'Check any stale/offline controller before starting'}</strong><span>{connectedCount}/{room.players.length || 0} connected</span></div>
        <div className="preflight-actions"><button className="secondary-button" onClick={runControllerTest}>Test All Phones</button><button className="primary-button" onClick={() => setPreflightOpen(false)}>Done</button></div>
        {actionMessage && <p className="drawer-message">{actionMessage}</p>}
      </section>
    </div>}

    {transition && <div className={`game-transition-overlay ${transition.categories ? 'category-transition' : ''}`} key={transition.key} aria-live="polite"><section><small>{transition.eyebrow}</small><h1>{transition.title}</h1>{transition.detail && <p>{transition.detail}</p>}{transition.categories && <div className="category-intro-grid">{transition.categories.map((category, index) => <span key={category} style={{ '--intro-index': index } as React.CSSProperties}>{category}</span>)}</div>}</section></div>}
  </>;
}
