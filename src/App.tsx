import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MusicTrackSelect } from './components/BackgroundMusicPicker';
import { audio } from './lib/audio';
import { DEFAULT_MUSIC_GAIN } from './lib/musicVolumePolicy';
import { applySavedAccessibility } from './lib/accessibility';
import { hostPhaseLabel, readHostPreview } from './lib/hostPreview';
import { readSavedHostCredentials } from './lib/hostCredentials';
import { resetInstance } from './lib/resetInstance';
import { useOutsideDismiss } from './lib/useOutsideDismiss';
import './lib/clientLifecycle';
import './styles.css';
import './showcase.css';
import './stage-polish.css';
import './interaction-polish.css';
import './bugfix-polish.css';
import './menu-polish.css';
import './enhancement-polish.css';

const HostAppV3 = lazy(async () => import('./components/HostAppV3').then((module) => ({ default: module.HostAppV3 })));
const HostEnhancements = lazy(async () => import('./components/HostEnhancements').then((module) => ({ default: module.HostEnhancements })));
const PlayerApp = lazy(async () => import('./components/PlayerApp').then((module) => ({ default: module.PlayerApp })));
const PlayerEnhancements = lazy(async () => import('./components/PlayerEnhancements').then((module) => ({ default: module.PlayerEnhancements })));
const PresentationApp = lazy(async () => import('./components/PresentationApp').then((module) => ({ default: module.PresentationApp })));

const AUDIO_75_MIGRATION_KEY = 'blue-stage-audio-default-75-v1';
type AppMode = 'host' | 'player' | 'presentation';
type MenuModal = 'how' | 'advanced' | null;
type WebkitDocument = Document & { webkitFullscreenElement?: Element | null; webkitExitFullscreen?: () => Promise<void> | void };
type WebkitElement = HTMLElement & { webkitRequestFullscreen?: () => Promise<void> | void };

function applyAudioDefaults(): void {
  try {
    if (localStorage.getItem(AUDIO_75_MIGRATION_KEY)) return;
    audio.setSettings({ master: 0.75, music: DEFAULT_MUSIC_GAIN, effects: 0.75 });
    localStorage.setItem(AUDIO_75_MIGRATION_KEY, '1');
  } catch {
    audio.settings = { ...audio.settings, master: 0.75, music: DEFAULT_MUSIC_GAIN, effects: 0.75 };
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
    const url = modeUrl(mode, fresh);
    history.pushState(null, '', url);
    setRouteHref(url.href);

    if (mode === 'host') {
      void audio.unlock().then(() => audio.setMusic('lobby')).catch(() => {});
    } else {
      audio.stop();
    }
  }, []);

  const params = useMemo(() => new URL(routeHref).searchParams, [routeHref]);
  const mode = params.get('mode');
  if (mode === 'host') return <Suspense fallback={<RouteLoading label="Loading host game…"/>}><HostAppV3/><HostEnhancements/></Suspense>;
  if (mode === 'player') return <Suspense fallback={<RouteLoading label="Loading controller…"/>}><PlayerApp/><PlayerEnhancements/></Suspense>;
  if (mode === 'presentation') return <Suspense fallback={<RouteLoading label="Loading presentation…"/>}><PresentationApp/></Suspense>;
  return <Menu onNavigate={navigate}/>;
}

function RouteLoading({ label }: { label: string }) {
  return <main className="presentation-shell presentation-boot" role="status" aria-live="polite"><div className="brand-mark"><span>BLUE STAGE</span><strong>TRIVIA</strong></div><p>{label}</p></main>;
}

function Menu({ onNavigate }: { onNavigate: (mode: AppMode, fresh?: boolean) => Promise<void> }) {
  const [resetting, setResetting] = useState(false);
  const [modal, setModal] = useState<MenuModal>(null);
  const modalRef = useRef<HTMLElement | null>(null);
  const modalTriggerRef = useRef<HTMLButtonElement | null>(null);
  const [fullscreen, setFullscreen] = useState(() => fullscreenActive());
  const [now, setNow] = useState(() => Date.now());
  const savedHost = useMemo(() => {
    try { return readSavedHostCredentials(); } catch { return null; }
  }, []);
  const preview = useMemo(() => savedHost ? readHostPreview(savedHost.roomCode) : null, [savedHost]);
  const hasSavedHost = Boolean(savedHost);
  const staticPreview = location.hostname.endsWith('.github.io');
  const fullscreenSupported = Boolean(document.fullscreenEnabled || (document.documentElement as WebkitElement).webkitRequestFullscreen);

  useOutsideDismiss(Boolean(modal), () => setModal(null), modalRef, modalTriggerRef);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    const syncFullscreen = () => setFullscreen(fullscreenActive());
    document.addEventListener('fullscreenchange', syncFullscreen);
    document.addEventListener('webkitfullscreenchange', syncFullscreen as EventListener);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('fullscreenchange', syncFullscreen);
      document.removeEventListener('webkitfullscreenchange', syncFullscreen as EventListener);
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
    if (hasSavedHost && savedHost && preview?.phase !== 'lobby') {
      const playerCopy = preview?.totalPlayers
        ? ` Everyone stays in room ${savedHost.roomCode} with the same seats and profiles.`
        : '';
      if (!confirm(`Start a new game? The current board, scores, stats, and question history will reset.${playerCopy}`)) return;
    }
    void onNavigate('host', true);
  };

  const hardReset = async () => {
    if (!confirm('Reset Blue Stage data in this browser? This clears saved Host and player access on this device. The laptop server keeps its rooms and scores; you may lose access to your saved seat or Host role.')) return;
    setResetting(true);
    audio.stop();
    await resetInstance();
  };

  const savedPhase = preview ? hostPhaseLabel(preview.phase) : 'Reconnect to see current game';
  const savedPlayers = preview ? `${preview.totalPlayers} player${preview.totalPlayers === 1 ? '' : 's'}` : 'Saved Host access';
  const savedActivity = preview ? relativeTime(preview.updatedAt, now) : null;

  return <main className={`menu-shell showcase-menu menu-shell-v2${fullscreen ? ' menu-fullscreen' : ''}`} onPointerDown={activateMenuAudio}>
    <div className="menu-backdrop" aria-hidden="true"><i/><i/><i/></div>
    <section className="menu-card menu-card-v2">
      <div className="brand-mark hero-brand menu-logo-v2"><span>BLUE STAGE</span><strong>TRIVIA</strong></div>
      <p className="menu-subtitle menu-subtitle-v2" role={staticPreview ? 'note' : undefined}>{staticPreview ? 'Static preview only. For same-Wi-Fi multiplayer, start Blue Stage on the laptop and open its LAN Host URL.' : 'A shared-screen game show with phone buzzers, wagers, streaks, and a dramatic finish.'}</p>

      <div className="menu-mode-grid">
        <section className="menu-mode-section host-menu-section">
          <header><span>HOST GAME</span><small>Run the board on this screen</small></header>
          <div className="menu-actions host-menu-actions">
            <button className={`${hasSavedHost ? 'secondary-button menu-secondary' : 'primary-button menu-primary'} menu-new-game`} disabled={staticPreview} onClick={startNewGame}><span>Start New Game</span><small>{hasSavedHost ? 'Keep current players and profiles' : 'Fresh room, fresh board, zero scores'}</small></button>
            {!staticPreview && hasSavedHost && savedHost && <article
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
              <div className="saved-game-meta"><b>{savedPlayers}</b>{preview && preview.phase !== 'lobby' && preview.phase !== 'recap' && <span>{preview.remainingQuestions} questions left</span>}{savedActivity && <small>Last played {savedActivity}</small>}</div>
            </article>}
          </div>
        </section>

        <section className="menu-mode-section player-menu-section">
          <header><span>JOIN GAME</span><small>Use this device as a controller</small></header>
          <button className="secondary-button menu-secondary join-game-button" disabled={staticPreview} onClick={() => void onNavigate('player')}><span>Join a Game</span><small>Scan a QR code or enter the room code</small></button>
        </section>
      </div>

      <div className="menu-tool-row" aria-label="Menu tools">
        <button className="menu-tool-button" disabled={!fullscreenSupported} onClick={() => void toggleFullscreen()}><span aria-hidden="true">⛶</span>{fullscreen ? 'Exit Fullscreen' : 'Fullscreen'}</button>
        <button className="menu-tool-button" onClick={(event) => { modalTriggerRef.current = event.currentTarget; setModal('how'); }}><span aria-hidden="true">?</span>How to Play</button>
        <button className="menu-tool-button" onClick={(event) => { modalTriggerRef.current = event.currentTarget; setModal('advanced'); }}><span aria-hidden="true">⚙</span>Advanced</button>
        <MusicTrackSelect className="menu-music-select" />
      </div>
    </section>

    <footer className="menu-footer"><span>PHONE BUZZERS</span><b>•</b><span>DAILY DOUBLES</span><b>•</b><span>FINAL ROUND</span></footer>

    {modal === 'how' && <div className="menu-modal-backdrop">
      <section ref={modalRef} className="menu-modal how-to-modal" role="dialog" aria-modal="true" aria-labelledby="how-to-title" tabIndex={-1}>
        <button className="menu-modal-close" aria-label="Close How to Play" data-modal-initial-focus onClick={() => setModal(null)}>×</button>
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

    {modal === 'advanced' && <div className="menu-modal-backdrop">
      <section ref={modalRef} className="menu-modal advanced-modal" role="dialog" aria-modal="true" aria-labelledby="advanced-title" tabIndex={-1}>
        <button className="menu-modal-close" aria-label="Close Advanced" data-modal-initial-focus onClick={() => setModal(null)}>×</button>
        <div className="section-kicker">ADVANCED</div>
        <h2 id="advanced-title">Maintenance</h2>
        <p>Normal games do not require these controls.</p>
        <div className="advanced-danger-zone">
          <div><strong>Reset This Browser</strong><span>Clears saved access and Blue Stage data on this device. Rooms and scores stay on the laptop server.</span></div>
          <button className="advanced-reset-button" disabled={resetting} onClick={() => void hardReset()}>{resetting ? 'Resetting…' : 'Reset This Browser'}</button>
        </div>
      </section>
    </div>}
  </main>;
}
