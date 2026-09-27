import { useCallback, useState } from 'react';
import type { AudioSettings, DealPlayer, DealSettings, DealSnapshot } from '../types';
import { DEFAULT_TIMERS, OTHER_TIMERS, PLAYER_COUNT, STAGE_PRESETS, TIMER_LIMITS, estimateMinutes, type TimerSettings } from '../types';
import { useHostRoom } from './net';
import { TvStage } from './TvStage';
import { JoinCard } from './JoinCard';
import { formatClock } from './labels';
import { useSoundtrack } from '../audio/useSoundtrack';
import { useAutoSound } from '../audio/useAutoSound';
import { narrator } from '../audio/narrator';
import { LIVE_LINES, speakable } from '../audio/narrationLines';
import { toggleFullscreen } from '../../../platform/ui/fullscreen';
import { navigateInApp, pickerUrl } from '../../../platform/session/resetInstance';

type Send = (event: string, payload?: Record<string, unknown>) => Promise<void>;

/** "45s" for short clocks, "3:00" once it's a minute or more. */
function timerText(seconds: number): string {
  return seconds >= 60 ? formatClock(seconds) : `${seconds}s`;
}

export function AudioControls({ audio, captions, onAudio, onCaptions }: { audio: AudioSettings; captions?: boolean; onAudio: (audio: Partial<AudioSettings>) => void; onCaptions?: (value: boolean) => void }) {
  return <div className="dod-audio-controls">
    {(['music', 'effects', 'narration'] as const).map((key) => <label key={key}>
      <span>{key[0].toUpperCase() + key.slice(1)}</span>
      <input type="range" min={0} max={100} step={5} value={audio[key]} onChange={(event) => onAudio({ [key]: Number(event.target.value) })}/>
      <output>{audio[key]}</output>
    </label>)}
    <label className="dod-check"><input type="checkbox" checked={audio.muted} onChange={(event) => onAudio({ muted: event.target.checked })}/> Mute all</label>
    {onCaptions && <label className="dod-check"><input type="checkbox" checked={Boolean(captions)} onChange={(event) => onCaptions(event.target.checked)}/> Captions</label>}
  </div>;
}

function TimerStepper({ settings, timer, stepTimer }: { settings: DealSettings; timer: keyof TimerSettings; stepTimer: (key: keyof TimerSettings, step: number) => void }) {
  const limit = TIMER_LIMITS[timer];
  return <div className="dod-stepper">
    <span>{limit.label}</span>
    <button aria-label={`Less ${limit.label}`} onClick={() => stepTimer(timer, -limit.step)} disabled={settings.timers[timer] <= limit.min}>−</button>
    <b>{timerText(settings.timers[timer])}</b>
    <button aria-label={`More ${limit.label}`} onClick={() => stepTimer(timer, limit.step)} disabled={settings.timers[timer] >= limit.max}>+</button>
    <small>Default {timerText(DEFAULT_TIMERS[timer])}</small>
  </div>;
}

/** The timers that are not the stage clock: one flat default each, changed here if a group wants. */
function TimersPage({ settings, send, stepTimer, onClose }: { settings: DealSettings; send: Send; stepTimer: (key: keyof TimerSettings, step: number) => void; onClose: () => void }) {
  const reset = () => void send('host:update-settings', { updates: { timers: Object.fromEntries(OTHER_TIMERS.map((key) => [key, DEFAULT_TIMERS[key]])) } });
  return <div className="dod-modal" role="dialog" aria-label="More timers">
    <div className="dod-settings">
      <header><h2>More timers</h2><p>Everything except the stage clock. The defaults suit most groups.</p></header>
      <section><div className="dod-timers">{OTHER_TIMERS.map((key) => <TimerStepper key={key} settings={settings} timer={key} stepTimer={stepTimer}/>)}</div></section>
      <footer>
        <button className="dod-ghost" onClick={reset}>Reset these to defaults</button>
        <button className="dod-primary" onClick={onClose}>Done</button>
      </footer>
    </div>
  </div>;
}

function SettingsPage({ room, send, onClose, onStart }: { room: DealSnapshot; send: Send; onClose: () => void; onStart: () => void }) {
  const settings = room.settings;
  const update = (updates: Partial<DealSettings>) => void send('host:update-settings', { updates });
  // A step, not a value, so fast taps and a preset tap still in flight all apply in order on the server.
  const stepTimer = (key: keyof TimerSettings, step: number) => void send('host:update-settings', { updates: { timerSteps: { [key]: step } } });
  const { low, high } = estimateMinutes(settings.timers, settings.tutorial);
  const ready = room.players.filter((player) => player.lookSet && player.connected).length;
  const [moreTimers, setMoreTimers] = useState(false);
  if (moreTimers) return <TimersPage settings={settings} send={send} stepTimer={stepTimer} onClose={() => setMoreTimers(false)}/>;
  return <div className="dod-modal" role="dialog" aria-label="Game settings">
    <div className="dod-settings">
      <header><h2>Game settings</h2><p>These apply to all four rounds. Rules and points stay the same in every setting.</p></header>
      <section>
        <h3>On stage clock <small>Pitch and questions · about {low}–{high} minutes for four rounds</small></h3>
        <div className="dod-segment">
          {(Object.keys(STAGE_PRESETS) as (keyof typeof STAGE_PRESETS)[]).map((preset) => <button key={preset} className={settings.timerPreset === preset ? 'is-on' : ''} onClick={() => update({ timerPreset: preset })}>{preset[0].toUpperCase() + preset.slice(1)} {timerText(STAGE_PRESETS[preset])}</button>)}
          <TimerStepper settings={settings} timer="stage" stepTimer={stepTimer}/>
          <button className="dod-ghost" onClick={() => setMoreTimers(true)}>More timers…</button>
        </div>
      </section>
      <section className="dod-two">
        <div>
          <h3>Tutorial & captions</h3>
          <label className="dod-check"><input type="checkbox" checked={settings.tutorial} onChange={(event) => update({ tutorial: event.target.checked })}/> Play the narrated tutorial before round 1</label>
          <label className="dod-check"><input type="checkbox" checked={settings.captions} onChange={(event) => update({ captions: event.target.checked })}/> Captions</label>
        </div>
        <div>
          <h3>Audio</h3>
          <AudioControls audio={settings.audio} onAudio={(audio) => update({ audio: { ...settings.audio, ...audio } })}/>
        </div>
      </section>
      <footer>
        <button className="dod-ghost" onClick={() => void send('host:reset-settings')}>Reset to defaults</button>
        <button className="dod-ghost" onClick={onClose}>Close</button>
        <button className="dod-primary" disabled={ready !== PLAYER_COUNT} onClick={onStart}>
          {ready === PLAYER_COUNT ? (settings.tutorial ? 'Confirm & play tutorial' : 'Confirm & start game') : `Waiting for players (${ready}/4)`}
        </button>
      </footer>
    </div>
  </div>;
}

/** Lets the host teach the narrator a name ("Shiv-awn"), with a button to hear it. */
function SayAs({ player, send, enableSound }: { player: DealPlayer; send: Send; enableSound: () => Promise<boolean> }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(player.sayAs ?? '');
  const save = () => { setOpen(false); if (draft.trim() !== (player.sayAs ?? '')) void send('host:set-say-as', { playerId: player.id, sayAs: draft }); };
  const hear = () => void enableSound().then((ok) => {
    const name = speakable(draft) || speakable(player.name);
    if (ok && name) narrator.say({ items: [{ live: LIVE_LINES.hotSeat(name) }], interrupt: true });
  });
  if (!open) return <button className="dod-remove" title="How the narrator says this name" onClick={() => { setDraft(player.sayAs ?? ''); setOpen(true); }}>🗣{player.sayAs ? ` "${player.sayAs}"` : ''}</button>;
  return <span className="dod-say-as">
    <input value={draft} maxLength={32} placeholder={`Say "${player.name}" like…`} aria-label={`How to say ${player.name}`} autoFocus
      onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') save(); if (event.key === 'Escape') setOpen(false); }}/>
    <button className="dod-remove" onClick={hear} title="Hear it">▶</button>
    <button className="dod-remove" onClick={save}>Save</button>
  </span>;
}

function JoinPanel({ room, joinUrl, send, enableSound }: { room: DealSnapshot; joinUrl: string; send: Send; enableSound: () => Promise<boolean> }) {
  const [confirmId, setConfirmId] = useState<string | null>(null);
  return <JoinCard room={room} joinUrl={joinUrl}>
    <ul>{room.players.map((player) => <li key={player.id} className={player.lookSet ? 'ready' : ''}>
      {player.name}{player.lookSet ? ' ✓' : ' (choosing avatar…)'}{player.connected ? '' : ' · offline'}
      <SayAs player={player} send={send} enableSound={enableSound}/>
      {/* An abandoned seat would block a four-player game, so the host can free it. Their phone can still rejoin as a new player. */}
      {!player.connected && (confirmId === player.id
        ? <><button className="dod-remove is-confirm" onClick={() => { setConfirmId(null); void send('host:remove-player', { playerId: player.id }); }}>Remove {player.name}</button><button className="dod-remove" onClick={() => setConfirmId(null)}>Keep</button></>
        : <button className="dod-remove" onClick={() => setConfirmId(player.id)}>Remove</button>)}
    </li>)}</ul>
  </JoinCard>;
}

function HostBar({ room, send, soundOn, enableSound, openSettings, onStart }: { room: DealSnapshot; send: Send; soundOn: boolean; enableSound: () => void; openSettings: () => void; onStart: () => void }) {
  const [audioOpen, setAudioOpen] = useState(false);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const skippable = ['tutorial', 'build', 'stage', 'reveal', 'break', 'final', 'forecast-result'].includes(room.phase);
  const pausable = !['lobby', 'gameover'].includes(room.phase);
  const allReady = room.players.length === PLAYER_COUNT && room.players.every((player) => player.lookSet && player.connected);
  return <nav className="dod-hostbar" aria-label="Host controls">
    {!soundOn && <button className="dod-primary" onClick={enableSound}>🔊 Turn on sound</button>}
    {room.phase === 'lobby' && allReady && <button className="dod-primary" onClick={onStart}>▶ {room.settings.tutorial ? 'Start with the tutorial' : 'Start the game'}</button>}
    {room.phase === 'lobby' && <button className={allReady ? '' : 'dod-primary'} onClick={openSettings}>Settings & start</button>}
    {pausable && (room.paused ? <button onClick={() => void send('host:resume')}>▶ Resume</button> : <button onClick={() => void send('host:pause')}>⏸ Pause</button>)}
    {skippable && <button onClick={() => void send('host:continue')}>{room.phase === 'tutorial' ? 'Skip tutorial' : room.phase === 'build' ? 'Lock everyone in ▶▶' : room.phase === 'stage' ? 'Skip to bids ▶▶' : 'Skip ▶▶'}</button>}
    {room.phase === 'break' && <button onClick={() => { enableSound(); void send('host:replay-tutorial'); }}>Replay tutorial</button>}
    {room.phase === 'gameover' && <button className="dod-primary" onClick={() => void send('host:new-game')}>Play again</button>}
    <button onClick={() => setAudioOpen((open) => !open)} aria-expanded={audioOpen}>🎚 Sound</button>
    <button onClick={() => void toggleFullscreen()}>⛶</button>
    {room.phase !== 'lobby' && room.phase !== 'gameover' && (confirmEnd
      ? <><button className="dod-danger" onClick={() => { setConfirmEnd(false); void send('host:new-game'); }}>End game now</button><button onClick={() => setConfirmEnd(false)}>Keep playing</button></>
      : <button onClick={() => setConfirmEnd(true)}>End game</button>)}
    {room.phase === 'lobby' && <button onClick={() => navigateInApp(pickerUrl())}>Games</button>}
    {audioOpen && <div className="dod-popover"><AudioControls audio={room.settings.audio} captions={room.settings.captions}
      onAudio={(audio) => void send('host:update-settings', { updates: { audio: { ...room.settings.audio, ...audio } } })}
      onCaptions={(captions) => void send('host:update-settings', { updates: { captions } })}/></div>}
  </nav>;
}

export function HostApp() {
  const { room, credentials, send, error, setError } = useHostRoom();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const { soundOn, unlockSound } = useAutoSound();
  const [soundHere, setSoundHere] = useState(() => { try { return localStorage.getItem('blue-stage-deal-or-dud-sound-here') !== 'off'; } catch { return true; } });

  const enableSound = useCallback(() => { void unlockSound(); }, [unlockSound]);
  const tutorialDone = useCallback(() => { void send('host:skip-tutorial'); }, [send]);
  useSoundtrack(room, soundOn && soundHere, tutorialDone);

  if (!room || !credentials) {
    return <main className="dod-app dod-loading">{error ? <p>{error}</p> : <p>Opening the studio…</p>}</main>;
  }
  const start = () => { enableSound(); setSettingsOpen(false); void send('host:start-game'); };

  return <main className="dod-app dod-tv">
    <TvStage room={room}
      extra={<>
        {room.phase === 'lobby' && <JoinPanel room={room} joinUrl={credentials.joinUrl} send={send} enableSound={unlockSound}/>}
        {settingsOpen && room.phase === 'lobby' && <SettingsPage room={room} send={send} onClose={() => setSettingsOpen(false)} onStart={start}/>}
        {error && <div className="dod-toast" role="alert" onClick={() => setError('')}>{error}</div>}
        {room.phase === 'lobby' && <div className="dod-display-link">
          <label className="dod-check"><input type="checkbox" checked={soundHere} onChange={(event) => { setSoundHere(event.target.checked); try { localStorage.setItem('blue-stage-deal-or-dud-sound-here', event.target.checked ? 'on' : 'off'); } catch { /* optional */ } }}/> Play sound on this screen</label>
          <span>Separate TV? Open the display link: <code>{credentials.presentationUrl.replace(/^https?:\/\//, '').replace(/display=.*/, 'display=…')}</code></span>
          <button onClick={() => void navigator.clipboard?.writeText(credentials.presentationUrl)}>Copy display link</button>
        </div>}
      </>}
      hostBar={<HostBar room={room} send={send} soundOn={soundOn} enableSound={enableSound} openSettings={() => { enableSound(); setSettingsOpen(true); }} onStart={start}/>}/>
  </main>;
}
