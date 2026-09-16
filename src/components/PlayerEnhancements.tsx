import { useEffect, useMemo, useState } from 'react';
import type { PlayerJoinCredentials, RoomSnapshot } from '../shared/types';
import { emitAck, socket } from '../lib/socket';
import { audio } from '../lib/audio';
import { readAccessibility, saveAccessibility, type AccessibilityPreferences } from '../lib/accessibility';

const PLAYER_KEY = 'blue-stage-player';

function readCredentials(): PlayerJoinCredentials | null {
  try {
    const raw = localStorage.getItem(PLAYER_KEY);
    return raw ? JSON.parse(raw) as PlayerJoinCredentials : null;
  } catch { return null; }
}

export function PlayerEnhancements() {
  const [room, setRoom] = useState<RoomSnapshot | null>(null);
  const [disconnected, setDisconnected] = useState(false);
  const [showReconnect, setShowReconnect] = useState(false);
  const [testToast, setTestToast] = useState(false);
  const [accessOpen, setAccessOpen] = useState(false);
  const [accessibility, setAccessibility] = useState<AccessibilityPreferences>(() => readAccessibility());
  const credentials = useMemo(() => readCredentials(), [room?.code]);
  const me = room?.players.find((player) => player.id === credentials?.playerId) ?? null;

  useEffect(() => {
    let delay = 0;
    const onState = (snapshot: RoomSnapshot) => {
      setRoom(snapshot);
      setDisconnected(false);
      setShowReconnect(false);
      window.clearTimeout(delay);
    };
    const onConnect = () => {
      setDisconnected(false);
      setShowReconnect(false);
      window.clearTimeout(delay);
    };
    const onDisconnect = () => {
      setDisconnected(true);
      window.clearTimeout(delay);
      delay = window.setTimeout(() => setShowReconnect(true), 500);
    };
    const onTest = async () => {
      setTestToast(true);
      try { navigator.vibrate?.([45, 35, 90]); } catch { /* optional */ }
      try { await audio.unlock(); audio.cue('locked'); } catch { /* optional */ }
      const saved = readCredentials();
      if (saved) {
        try { await emitAck('player:reconnect', saved); } catch { /* reconnect loop handles failures */ }
      }
      window.setTimeout(() => setTestToast(false), 2200);
    };
    socket.on('room:state', onState);
    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('preflight:test', onTest);
    return () => {
      window.clearTimeout(delay);
      socket.off('room:state', onState);
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('preflight:test', onTest);
    };
  }, []);

  const updateAccessibility = (updates: Partial<AccessibilityPreferences>) => {
    const next = { ...accessibility, ...updates };
    setAccessibility(next);
    saveAccessibility(next);
  };

  if (!credentials && !room) return null;

  return <>
    {me && <div className="phone-seat-chip" aria-label={`Player ${me.seat}`}>P{me.seat}</div>}
    <button className="phone-accessibility-trigger" onClick={() => setAccessOpen((open) => !open)} aria-expanded={accessOpen}>Aa</button>
    {accessOpen && <section className="phone-accessibility-panel" aria-label="Accessibility settings">
      <strong>Accessibility</strong>
      <label><input type="checkbox" checked={accessibility.largeText} onChange={(event) => updateAccessibility({ largeText: event.target.checked })}/>Large text</label>
      <label><input type="checkbox" checked={accessibility.highContrast} onChange={(event) => updateAccessibility({ highContrast: event.target.checked })}/>High contrast</label>
      <label><input type="checkbox" checked={accessibility.reduceMotion} onChange={(event) => updateAccessibility({ reduceMotion: event.target.checked })}/>Reduce motion</label>
      <button onClick={() => setAccessOpen(false)}>Done</button>
    </section>}

    {showReconnect && disconnected && <div className="phone-reconnect-overlay" role="status" aria-live="assertive"><div className="reconnect-spinner"/><strong>Connection interrupted</strong><span>Reconnecting to your reserved seat…</span></div>}
    {testToast && <div className="controller-test-toast" role="status"><b>✓</b><div><strong>Controller check passed</strong><span>{me ? `Player ${me.seat} · ${me.name}` : 'Phone connected'}</span></div></div>}
  </>;
}
