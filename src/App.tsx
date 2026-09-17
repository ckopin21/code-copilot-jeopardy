import { useCallback, useEffect, useMemo, useState } from 'react';
import { HostAppV3 } from './components/HostAppV3';
import { HostEnhancements } from './components/HostEnhancements';
import { PlayerApp } from './components/PlayerApp';
import { PlayerEnhancements } from './components/PlayerEnhancements';
import { PresentationApp } from './components/PresentationApp';
import { audio } from './lib/audio';
import { applySavedAccessibility } from './lib/accessibility';
import { hostPhaseLabel, readHostPreview } from './lib/hostPreview';
import { resetInstance } from './lib/resetInstance';
import './lib/clientLifecycle';
import './styles.css';
import './showcase.css';
import './stage-polish.css';
import './interaction-polish.css';
import './bugfix-polish.css';
import './menu-polish.css';
import './enhancement-polish.css';

const HOST_KEY = 'blue-stage-host-room';
const AUDIO_75_MIGRATION_KEY = 'blue-stage-audio-default-75-v1';
type AppMode = 'host' | 'player' | 'presentation';
type MenuModal = 'how' | 'advanced' | null;
type SavedHost = { roomCode: string };
type WebkitDocument = Document & { webkitFullscreenElement?: Element | null; webkitExitFullscreen?: () => Promise<void> | void };
type WebkitElement = HTMLElement & { webkitRequestFullscreen?: () => Promise<void> | void };

function applyAudioDefaults(): void {
  try {
    if (localStorage.getItem(AUDIO_75_MIGRATION_KEY)) return;
    audio.setSettings({ master: 0.75, music: 0.75, effects: 0.75 });
    localStorage.setItem(AUDIO_75_MIGRATION_KEY, '1');
  } catch {
    audio.settings = { ...audio.settings, master: 0.75, music: 0.75, effects: 0.75 };
  }
}

applyAudioDefaults();
applySavedAccessibility();

function modeUrl(mode: AppMode, fresh = false): URL {
  const url = new URL('./', location.href);
  url.searchParams.set('mode', mode);
  if (fresh) url.searchParams.set('fresh', '1');
  return url;
}

function readSavedHost(): SavedHost | null {
  try {
    const raw = localStorage.getItem(HOST_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<SavedHost>;
    return typeof parsed.roomCode === 'string' && parsed.roomCode ? { roomCode: parsed.roomCode } : null;
  } catch {
    return null;
  }
}

function relativeTime(timestamp: number, now: number): string {
  const seconds = Math.max(0, Math.floor((now - timestamp) / 1000));
  if (seconds < 20) return 'just now';
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function fullscreenActive(): boolean {
  const webkitDocument = document as WebkitDocument;
  return Boolean(document.fullscreenElement ?? webkitDocument.webkitFullscreenElement);
}

export default function App() {
  const [routeHref, setRouteHref] = useState(() => location.href);

  useEffect(() => {
    const onPopState = () => setRouteHref(location.href);
    const onPointerDown = (event: PointerEvent) => {
      if (event.target instanceof Element && event.target.classList.contains('modal-backdrop') && event.target.querySelector('.expanded-qr-modal')) {
        event.target.querySelector<HTMLButtonElement>('.modal-close')?.click();
        return;
      }

      const target = event.target instanceof Element ? event.target.closest('button,a') : null;
      if (!target || target.matches('button:disabled,[aria-disabled="true"]')) return;
      void audio.unlock().then(() => audio.cue('click')).catch(() => {});

      const button = event.target instanceof Element ? event.target.closest('button') : null;
      const phoneMode = new URLSearchParams(location.search).get('mode') === 'player';
      if (phoneMode && button && !button.matches(':disabled')) {
        try { navigator.vibrate?.(12); } catch { /* vibration is optional and unsupported on some mobile browsers */ }
      }
    };
    window.addEventListener('popstate', onPopState);
    document.addEventListener('pointerdown', onPointerDown, { capture: true });
    return () => {
      window.removeEventListener('popstate', onPopState);
      document.removeEventListener('pointerdown', onPointerDown, { capture: true });
    };
  }, []);

  const navigate = useCallback(async (mode: AppMode, fresh = false) => {
    if (mode === 'host') {
      try {
        await audio.unlock();
        await audio.setMusic('lobby');
      } catch { /* the host screen can retry audio on the next interaction */ }
    } else {
      audio.stop();
    }
    const url = modeUrl(mode, fresh);
    history.pushState(null, '', url);
    setRouteHref(url.href);
  }, []);

  const params = useMemo(() => new URL(routeHref).searchParams, [routeHref]);
  const mode = params.get('mode');
  if (mode === 'host') return <><HostAppV3/><HostEnhancements/></>;
  if (mode === 'player') return <><PlayerApp/><PlayerEnhancements/></>;
  if (mode === 'presentation') return <PresentationApp/>;
  return <Menu onNavigate={navigate}/>;
}

function Menu({ onNavigate }: { onNavigate: (mode: AppMode, fresh?: boolean) => Promise<void> }) {
  const [resetting, setResetting] = useState(false);
  const [modal, setModal] = useState<MenuModal>(null);
  const [fullscreen, setFullscreen] = useState(() => fullscreenActive());
  const [now, setNow] = useState(() => Date.now());
  const savedHost = useMemo(() => readSavedHost(), []);
  const preview = useMemo(() => savedHost ? readHostPreview(savedHost.roomCode) : null, [savedHost]);
  const hasSavedHost = Boolean(savedHost && preview);
  const fullscreenSupported = Boolean(document.fullscreenEnabled || (document.documentElement as WebkitElement).webkitRequestFullscreen);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    const syncFullscreen = () => setFullscreen(fullscreenActive());
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') setModal(null); };
    document.addEventListener('fullscreenchange', syncFullscreen);
    document.addEventListener('webkitfullscreenchange', syncFullscreen as EventListener);
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('fullscreenchange', syncFullscreen);
      document.removeEventListener('webkitfullscreenchange', syncFullscreen as EventListener);
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, []);

  const activateMenuAudio = () => {
    void audio.unlock().then(() => audio.setMusic('lobby')).catch(() => {});
  };

  const toggleFullscreen = async () => {
    const webkitDocument = document as WebkitDocument;
    const root = document.documentElement as WebkitElement;
    try {
      if (fullscreenActive()) {
        if (document.exitFullscreen) await document.exitFullscreen();
        else await webkitDocument.webkitExitFullscreen?.();
      } else if (root.requestFullscreen) {
        await root.requestFullscreen();
      } else {
        await root.webkitRequestFullscreen?.();
      }
      setFullscreen(fullscreenActive());
    } catch {
      // Fullscreen can be blocked by browser policy; keep the menu usable either way.
    }
  };

  const startNewGame = () => {
    if (hasSavedHost && savedHost && !confirm(`Start a new game? Saved room ${savedHost.roomCode} will be replaced by the new host room.`)) return;
    void onNavigate('host', true);
  };

  const hardReset = async () => {
    if (!confirm('Reset this entire Blue Stage instance? This clears saved rooms, seats, scores, and cached Blue Stage data, then reloads the newest build.')) return;
    setResetting(true);
    audio.stop();
    await resetInstance();
  };

  const savedPhase = preview ? hostPhaseLabel(preview.phase) : 'Saved session';
  const savedPlayers = preview ? `${preview.totalPlayers} player${preview.totalPlayers === 1 ? '' : 's'}` : 'Saved locally';
  const savedActivity = preview ? relativeTime(preview.updatedAt, now) : 'available';

  return <main className={`menu-shell showcase-menu menu-shell-v2${fullscreen ? ' menu-fullscreen' : ''}`} onPointerDown={activateMenuAudio}>
    <div className="menu-backdrop" aria-hidden="true"><i/><i/><i/></div>
    <section className="menu-card menu-card-v2">
      <div className="brand-mark hero-brand menu-logo-v2"><span>BLUE STAGE</span><strong>TRIVIA</strong></div>
      <p className="menu-subtitle menu-subtitle-v2">A shared-screen game show with phone buzzers, wagers, streaks, and a dramatic finish.</p>

      <div className="menu-mode-grid">
        <section className="menu-mode-section host-menu-section">
          <header><span>HOST GAME</span><small>Run the board on this screen</small></header>
          <div className="menu-actions host-menu-actions">
            <button className={`${hasSavedHost ? 'secondary-button menu-secondary' : 'primary-button menu-primary'} menu-new-game`} onClick={startNewGame}><span>Start New Game</span><small>Fresh room, fresh board, zero scores</small></button>
            {hasSavedHost && savedHost && <article
              className="saved-game-preview saved-game-inline"
              role="button"
              tabIndex={0}
              aria-label={`Continue saved game in room ${savedHost.roomCode}`}
              onClick={() => void onNavigate('host')}
              onKeyDown={(event) => {
                if (event.key !== 'Enter' && event.key !== ' ') return;
                event.preventDefault();
                void onNavigate('host');
              }}
            >
              <div className="saved-game-icon" aria-hidden="true">▶</div>
              <div className="saved-game-main"><small>CONTINUE SAVED GAME</small><strong>Room {savedHost.roomCode}</strong><span>{savedPhase}</span></div>
              <div className="saved-game-meta"><b>{savedPlayers}</b>{preview && preview.phase !== 'lobby' && preview.phase !== 'recap' && <span>{preview.remainingQuestions} questions left</span>}<small>Last played {savedActivity}</small></div>
            </article>}
          </div>
        </section>

        <section className="menu-mode-section player-menu-section">
          <header><span>JOIN GAME</span><small>Use this device as a controller</small></header>
          <button className="secondary-button menu-secondary join-game-button" onClick={() => void onNavigate('player')}><span>Join a Game</span><small>Scan a QR code or enter the room code</small></button>
        </section>
      </div>

      <div className="menu-tool-row" aria-label="Menu tools">
        <button className="menu-tool-button" disabled={!fullscreenSupported} onClick={() => void toggleFullscreen()}><span aria-hidden="true">⛶</span>{fullscreen ? 'Exit Fullscreen' : 'Fullscreen'}</button>
        <button className="menu-tool-button" onClick={() => setModal('how')}><span aria-hidden="true">?</span>How to Play</button>
        <button className="menu-tool-button" onClick={() => setModal('advanced')}><span aria-hidden="true">⚙</span>Advanced</button>
      </div>
    </section>

    <footer className="menu-footer"><span>PHONE BUZZERS</span><b>•</b><span>DAILY DOUBLES</span><b>•</b><span>FINAL ROUND</span></footer>

    {modal === 'how' && <div className="menu-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setModal(null); }}>
      <section className="menu-modal how-to-modal" role="dialog" aria-modal="true" aria-labelledby="how-to-title">
        <button className="menu-modal-close" aria-label="Close How to Play" onClick={() => setModal(null)}>×</button>
        <div className="section-kicker gold">HOW TO PLAY</div>
        <h2 id="how-to-title">Three steps. Then play.</h2>
        <div className="how-step-grid">
          <article><b>1</b><div><strong>Host the game</strong><p>Start or continue a room on the shared Mac, PC, TV, or monitor.</p></div></article>
          <article><b>2</b><div><strong>Players join</strong><p>Scan the host QR code with each phone and choose a name and avatar.</p></div></article>
          <article><b>3</b><div><strong>Play</strong><p>The host selects questions. Phones handle buzzers, wagers, and player responses.</p></div></article>
        </div>
        <button className="primary-button menu-modal-done" onClick={() => setModal(null)}>Got It</button>
      </section>
    </div>}

    {modal === 'advanced' && <div className="menu-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setModal(null); }}>
      <section className="menu-modal advanced-modal" role="dialog" aria-modal="true" aria-labelledby="advanced-title">
        <button className="menu-modal-close" aria-label="Close Advanced" onClick={() => setModal(null)}>×</button>
        <div className="section-kicker">ADVANCED</div>
        <h2 id="advanced-title">Maintenance</h2>
        <p>Normal games do not require these controls.</p>
        <div className="advanced-danger-zone">
          <div><strong>Reset Instance</strong><span>Clears every saved room, player seat, score, and Blue Stage cache on this browser.</span></div>
          <button className="advanced-reset-button" disabled={resetting} onClick={() => void hardReset()}>{resetting ? 'Resetting…' : 'Reset Instance'}</button>
        </div>
      </section>
    </div>}
  </main>;
}
