// Phone controller. The presenter's phone shows their secret verdict and scorecard; a shark's phone is its one peek, talking points and the offer control.
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import type { CategoryId, DealPlayer, DealSnapshot, OfferChoice, Peek, PlayerLook, RoundState, ScoreRow } from '../../types';
import { OFFER_CHOICES } from '../../types';
import { usePlayerRoom, useClockSeconds } from '../net';
import { Avatar } from '../Avatar';
import { Emoji } from '../Emoji';
import { AvatarPicker, recallLook, rememberLook } from './AvatarPicker';
import { BuildLocked, Builder } from './Builder';
import { PHASE_LABEL, formatClock, offerLabel, playerById, signed, standings } from '../labels';
import { PITCH_CUES } from '../../content/cues';
import { CATEGORIES, CATEGORY_QUESTIONS, categoryInfo, type CategoryInfo } from '../../content/scorecard';
import { shuffle, tonePool } from '../../content/dealer';
import { AudioControls } from '../HostApp';
import { GAME_ID } from '../../types';
import { navigateInApp, pickerUrl } from '../../../../platform/session/resetInstance';

type Send = (event: string, payload?: Record<string, unknown>) => Promise<boolean>;

function seededRandom(start: number): () => number {
  let value = Math.max(1, Math.floor(start) % 2147483647);
  return () => { value = (value * 16807) % 2147483647; return value / 2147483647; };
}

function Clock({ room }: { room: DealSnapshot }) {
  const seconds = useClockSeconds(room);
  if (!room.clock) return null;
  return <span className={`dod-phone-clock ${seconds <= 10 ? 'is-low' : ''}`}>{room.paused ? '⏸ ' : ''}{formatClock(seconds)}</span>;
}

function Header({ room, me, send }: { room: DealSnapshot; me: DealPlayer; send: Send }) {
  const role = room.round ? (room.round.presenterId === me.id ? 'Presenter' : 'Shark') : null;
  return <header className="dod-phone-header">
    <Avatar look={me.look} size={40}/>
    <div><b>{me.name}</b><small>{role ? `${role} · ` : ''}{me.score} pts</small>
      {me.seatCode && <small className="dod-seat-code">Room {room.code} · Seat {me.seatCode}</small>}</div>
    {room.vipId === me.id && <VipControls room={room} send={send}/>}
    <div className="dod-phone-phase"><small>{PHASE_LABEL[room.phase]}</small><Clock room={room}/></div>
  </header>;
}

// ---------- join ----------
function JoinScreen({ initialCode, join, rejoin, busyError }: {
  initialCode: string;
  join: (code: string, name: string, look: PlayerLook) => Promise<void>;
  rejoin: (code: string, seatCode: string) => Promise<void>;
  busyError: string;
}) {
  const [remembered] = useState(recallLook);
  const [code, setCode] = useState(initialCode);
  const [name, setName] = useState(remembered.name);
  const [look, setLook] = useState<PlayerLook | null>(remembered.look);
  const [seatCode, setSeatCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState<'name' | 'avatar' | 'seat'>('name');
  // A join refused because the game started (or is full) points to the seat-code form, unless the player backs out of it.
  const [dismissed, setDismissed] = useState('');
  const view = step === 'name' && /seat code/i.test(busyError) && busyError !== dismissed ? 'seat' : step;
  const submit = async () => {
    if (!look) return;
    setBusy(true);
    try { await join(code.trim(), name.trim(), look); } finally { setBusy(false); }
  };
  const submitSeat = async () => {
    setBusy(true);
    try { await rejoin(code.trim(), seatCode); } finally { setBusy(false); }
  };
  const codeField = <label>Room key<input value={code} onChange={(event) => setCode(event.target.value.toUpperCase())} maxLength={8} autoCapitalize="characters" autoComplete="off" inputMode="text" placeholder="ABCD"/></label>;
  return <main className="dod-app dod-phone dod-join-screen">
    <div className="dod-logo">Deal <span>or</span> Dud</div>
    {view === 'name' && <form onSubmit={(event) => { event.preventDefault(); if (code.trim().length >= 4 && name.trim()) setStep('avatar'); }}>
      {!initialCode && codeField}
      <label>Your name<input value={name} onChange={(event) => setName(event.target.value)} maxLength={16} autoComplete="nickname" placeholder="Name"/></label>
      <button className="dod-primary big" disabled={code.trim().length < 4 || !name.trim()}>Next: pick your look</button>
      <button type="button" className="dod-link" onClick={() => setStep('seat')}>Already playing? Get your seat back</button>
    </form>}
    {view === 'avatar' && <>
      <h2>Pick your look</h2>
      <AvatarPicker tone="clean" value={look} onChange={setLook}/>
      <div className="dod-row dod-join-actions">
        <button className="dod-ghost" onClick={() => setStep('name')}>Back</button>
        <button className="dod-primary big" disabled={!look || busy} onClick={() => void submit()}>{busy ? 'Joining…' : 'Enter the studio'}</button>
      </div>
    </>}
    {view === 'seat' && <form onSubmit={(event) => { event.preventDefault(); if (code.trim().length >= 4 && seatCode.length === 4) void submitSeat(); }}>
      <h2>Get your seat back</h2>
      <p className="dod-hint">Your seat code is the 4-digit number under your name on your old screen.</p>
      {codeField}
      <label>Seat code<input value={seatCode} onChange={(event) => setSeatCode(event.target.value.replace(/\D/g, '').slice(0, 4))} inputMode="numeric" pattern="[0-9]*" autoComplete="off" placeholder="1234"/></label>
      <button className="dod-primary big" disabled={busy || code.trim().length < 4 || seatCode.length !== 4}>{busy ? 'Joining…' : 'Take my seat'}</button>
      <button type="button" className="dod-link" onClick={() => { setDismissed(busyError); setStep('name'); }}>I'm a new player</button>
    </form>}
    {busyError && <p className="dod-error" role="alert">{busyError}</p>}
  </main>;
}

// ---------- shared bits ----------
// Every in-game screen is one column that fits the phone: content on top, the main button pinned to the bottom of the column.
function Screen({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return <section className="dod-screen"><div className="dod-screen-main">{children}</div>{action && <div className="dod-screen-action">{action}</div>}</section>;
}

// ---------- scorecard ----------
/** One check as a phone row: icon and question, then ✅/❌ and the line once it's known, plus who peeked. */
function CheckRow({ room, category, row, peeks }: { room: DealSnapshot; category: CategoryInfo; row?: ScoreRow; peeks: Peek[] }) {
  const peekers = peeks.filter((item) => item.category === category.id).map((item) => playerById(room, item.sharkId)?.name).filter(Boolean);
  return <div className={`dod-check-row ${row ? (row.ok ? 'is-ok' : 'is-bad') : ''}`}>
    <span className="dod-check-icon" aria-hidden="true"><Emoji char={category.icon}/></span>
    <div>
      <small>{category.label}{peekers.length > 0 && <em> · 👀 {peekers.join(', ')}</em>}</small>
      {row && <b>{row.ok ? '✅' : '❌'} {row.text}</b>}
    </div>
  </div>;
}

// ---------- presenter ----------
function PresenterScorecard({ room, round }: { room: DealSnapshot; round: RoundState }) {
  const [cue, setCue] = useState(0);
  const cues = round.pitchCueIds.map((id) => PITCH_CUES.find((item) => item.id === id)).filter(Boolean) as { id: string; text: string }[];
  return <>
    <div className={`dod-verdict verdict-${round.verdict}`}><b>{round.verdict === 'good' ? 'GOOD business' : 'BAD business'} <small>secret</small></b><span>{round.explanation}</span></div>
    <div className="dod-checks">{CATEGORIES.map((category) => <CheckRow key={category.id} room={room} category={category} row={round.scorecard.find((row) => row.category === category.id)} peeks={round.peeks}/>)}</div>
    <p className="dod-rule">Only you see this. Pitch it, and talk your way around the ❌s. Sharks can peek at one check each.</p>
    {cues.length > 0 && <button className="dod-idea" onClick={() => setCue((value) => value + 1)}>💡 {cues[cue % cues.length].text} <small>tap for another</small></button>}
  </>;
}

function PresenterView({ room, round, send }: { room: DealSnapshot; round: RoundState; send: Send }) {
  switch (room.phase) {
    case 'partner': return <Screen><h2>It's a tie! Pick your partner</h2>
      <p>Both bid {offerLabel(round.offers[round.tiedSharkIds[0]])}.</p>
      {round.tiedSharkIds.map((id) => { const shark = playerById(room, id)!; return <button key={id} className="dod-primary big" onClick={() => void send('player:partner', { sharkId: id })}><Avatar look={shark.look} size={40}/> {shark.name}</button>; })}
    </Screen>;
    default: return <Screen action={room.phase === 'stage' ? <p className="dod-hint">Sharks ready to bid: {round.readyToBid.length}/3</p>
      : room.phase === 'offers' ? <p className="dod-hint">Sharks are bidding. Keep selling!</p> : undefined}>
      <PresenterScorecard room={room} round={round}/>
    </Screen>;
  }
}

// ---------- shark ----------
/** The shark's one line from the scorecard, once it has peeked. */
function MyPeek({ round, me }: { round: RoundState; me: DealPlayer }) {
  const peek = round.peeks.find((item) => item.sharkId === me.id);
  const row = peek && round.scorecard.find((item) => item.category === peek.category);
  if (!peek || !row) return null;
  const category = categoryInfo(peek.category);
  return <div className={`dod-my-peek ${row.ok ? 'is-ok' : 'is-bad'}`} aria-live="polite">
    <small>🤫 Only you see this · {category.icon} {category.label}</small>
    <b>{row.ok ? '✅' : '❌'} {row.text}</b>
  </div>;
}

function OfferPanel({ round, me, send }: { round: RoundState; me: DealPlayer; send: Send }) {
  const locked = round.lockedOffers.includes(me.id);
  const [choice, setChoice] = useState<OfferChoice | null>(null);
  if (locked) return <Screen><div className="dod-wait"><h2>Locked 🔒</h2><p className="dod-big">{offerLabel(round.offers[me.id])}</p><p>Waiting for the other sharks…</p></div></Screen>;
  return <Screen action={<button className="dod-primary big" disabled={choice === null} onClick={() => void send('player:offer-lock', { choice })}>{choice === null ? 'Pick a bid' : `Lock in ${offerLabel(choice)} (final)`}</button>}>
    <h2>Your bid</h2>
    <MyPeek round={round} me={me}/>
    <p className="dod-hint">Top bid wins. GOOD: +1 per $100K, +2 bonus. BAD: −1 per $100K. $0 on a BAD one: +1. No bid by the buzzer = $0.</p>
    <div className="dod-offer-grid">{OFFER_CHOICES.map((option) => <button key={option} className={`${choice === option ? 'is-on' : ''} ${option === 0 ? 'out' : ''}`} aria-pressed={choice === option} onClick={() => setChoice(option)}>{offerLabel(option)}</button>)}</div>
  </Screen>;
}

/** On stage: one peek at one check (tap, then tap again to confirm), the answer, and optional things to ask. */
function SharkStage({ room, round, me, send }: { room: DealSnapshot; round: RoundState; me: DealPlayer; send: Send }) {
  const [pending, setPending] = useState<CategoryId | null>(null);
  const [seed, setSeed] = useState(1);
  const mine = round.peeks.find((item) => item.sharkId === me.id);
  const ideas = useMemo(() => shuffle(tonePool(CATEGORY_QUESTIONS, room.settings.tone), seededRandom(seed * 9301 + round.index * 49297)).slice(0, 2), [seed, round.index, room.settings.tone]);
  const ready = round.readyToBid.includes(me.id);
  const tap = (category: CategoryId) => {
    if (mine) return;
    if (pending !== category) { setPending(category); return; }
    setPending(null);
    void send('player:peek', { category });
  };
  return <Screen action={<button className={`big ${ready ? 'dod-ghost' : 'dod-primary'}`} onClick={() => void send('player:ready-to-bid')}>{ready ? `Ready ✓ (${round.readyToBid.length}/3) · tap to undo` : `I'm ready to bid (${round.readyToBid.length}/3)`}</button>}>
    {round.premise && <div className="dod-premise"><small>{round.premise.businessName}</small><b>{round.premise.headline}</b></div>}
    <h3>{mine ? 'Your peek' : 'Your one peek: pick a check'}</h3>
    <div className="dod-peek-grid" role="group" aria-label="Peek at one check">
      {CATEGORIES.map((category) => {
        const peekers = round.peeks.filter((item) => item.category === category.id).map((item) => item.sharkId === me.id ? 'you' : playerById(room, item.sharkId)?.name);
        const own = mine?.category === category.id;
        return <button key={category.id} className={`dod-peek ${pending === category.id ? 'is-pending' : ''} ${own ? 'is-mine' : ''}`} disabled={Boolean(mine) && !own} aria-pressed={own} onClick={() => tap(category.id)}>
          <span aria-hidden="true"><Emoji char={category.icon}/></span><b>{category.label}</b>
          <small>{pending === category.id ? 'Tap again to peek 👀' : peekers.length ? `👀 ${peekers.join(', ')}` : mine ? '' : 'Tap to peek'}</small>
        </button>;
      })}
    </div>
    <MyPeek round={round} me={me}/>
    <div className="dod-ideas"><small>Things to ask</small>{ideas.map((idea) => <span key={idea.id}><Emoji char={categoryInfo(idea.category).icon}/> {idea.text}</span>)}<button className="dod-link" onClick={() => setSeed((value) => value + 1)}>🔀 Other ideas</button></div>
  </Screen>;
}

function SharkView({ room, round, me, send }: { room: DealSnapshot; round: RoundState; me: DealPlayer; send: Send }) {
  const presenter = playerById(room, round.presenterId);
  switch (room.phase) {
    case 'offers': return <OfferPanel round={round} me={me} send={send}/>;
    case 'offers-reveal': case 'partner': return <Screen><div className="dod-wait"><h2>Bids</h2><ul className="dod-offer-list">{round.sharkIds.map((id) => <li key={id}>{playerById(room, id)?.name}: <b>{offerLabel(round.offers[id])}</b></li>)}</ul>{room.phase === 'partner' && <p>{presenter?.name} is picking a partner…</p>}</div></Screen>;
    default: return <SharkStage room={room} round={round} me={me} send={send}/>;
  }
}

// ---------- results ----------
function RevealView({ room, round, me }: { room: DealSnapshot; round: RoundState; me: DealPlayer }) {
  const result = round.result;
  if (!result) return null;
  const mine = result.scores.find((score) => score.playerId === me.id);
  return <section className={`dod-phone-reveal verdict-${result.verdict}`}>
    <div className="dod-stamp">{result.verdict === 'good' ? 'GOOD' : 'BAD'}</div>
    <p>{result.explanation}</p>
    <div className="dod-checks">{CATEGORIES.map((category) => <CheckRow key={category.id} room={room} category={category} row={result.scorecard.find((row) => row.category === category.id)} peeks={round.peeks}/>)}</div>
    {mine && <p className="dod-big">{signed(mine.delta)} <small>{mine.reason}</small></p>}
  </section>;
}

function StandingsView({ room, me }: { room: DealSnapshot; me: DealPlayer }) {
  return <section className="dod-phone-standings"><h2>{room.phase === 'gameover' ? `${playerById(room, room.winnerIds[0])?.name ?? ''} wins!` : 'Scores'}</h2>
    <ol>{standings(room).map((player) => <li key={player.id} className={player.id === me.id ? 'is-me' : ''}><Avatar look={player.look} size={32}/>{player.name}<b>{player.score}</b></li>)}</ol></section>;
}

function ForecastView({ room, me, send }: { room: DealSnapshot; me: DealPlayer; send: Send }) {
  const forecast = room.forecast!;
  const [value, setValue] = useState('');
  const playing = forecast.playerIds.includes(me.id);
  const done = forecast.submitted.includes(me.id);
  return <section className="dod-forecast-phone">
    <h2>{forecast.card.title}</h2>
    <ul>{forecast.card.clues.map((clue) => <li key={clue}>{clue}</li>)}</ul>
    <p><b>{forecast.card.question}</b></p>
    {!playing ? <p>Tied players are guessing. Watch the TV!</p> : done ? <p className="dod-locked">Locked: {forecast.guesses[me.id]?.toLocaleString()}</p> : <>
      <input className="dod-number" inputMode="numeric" pattern="[0-9]*" value={value} onChange={(event) => setValue(event.target.value.replace(/\D/g, '').slice(0, 7))} placeholder="Your guess"/>
      <button className="dod-primary big" disabled={!value} onClick={() => void send('player:forecast', { value: Number(value) })}>Lock guess</button>
    </>}
  </section>;
}

// ---------- VIP host controls ----------
function VipControls({ room, send }: { room: DealSnapshot; send: Send }) {
  const [open, setOpen] = useState(false);
  const skippable = ['tutorial', 'build', 'stage', 'reveal', 'break', 'final', 'forecast-result'].includes(room.phase);
  return <div className="dod-vip">
    <button className="dod-vip-toggle" onClick={() => setOpen((value) => !value)} aria-expanded={open}>🎛</button>
    {open && <div className="dod-vip-panel">
      {!['lobby', 'gameover'].includes(room.phase) && (room.paused ? <button onClick={() => { setOpen(false); void send('player:vip', { action: 'resume' }); }}>▶ Resume</button> : <button onClick={() => { setOpen(false); void send('player:vip', { action: 'pause' }); }}>⏸ Pause</button>)}
      {skippable && <button onClick={() => { setOpen(false); void send('player:vip', { action: 'continue' }); }}>{room.phase === 'build' ? 'Lock everyone in ▶▶' : room.phase === 'stage' ? 'Skip to bids ▶▶' : 'Skip ▶▶'}</button>}
      <AudioControls audio={room.settings.audio} onAudio={(audio) => void send('player:vip', { action: 'audio', audio })}/>
    </div>}
  </div>;
}

// ---------- app ----------
export function PhoneApp({ urlRoomCode }: { urlRoomCode: string }) {
  const { room, credentials, join, send, error, setError, removed, leave, reconnectError, retryReconnect } = usePlayerRoom(urlRoomCode);
  const [joinError, setJoinError] = useState('');
  const [changingLook, setChangingLook] = useState(false);
  const [leaving, setLeaving] = useState(false);
  useEffect(() => { if (error) { const id = window.setTimeout(() => setError(''), 5000); return () => window.clearTimeout(id); } }, [error, setError]);

  // A seated phone catches the Back button: an extra history entry means Back asks first instead of leaving the game.
  const seated = Boolean(credentials);
  useEffect(() => {
    if (!seated) return;
    const onThisScreen = () => { const params = new URLSearchParams(location.search); return params.get('game') === GAME_ID && params.get('mode') === 'player'; };
    history.pushState({ dodSeatGuard: true }, '', location.href);
    const onPopState = () => {
      // In-app navigation to another screen is deliberate; only a Back press landing on this same screen is caught.
      if (!onThisScreen() || (history.state as { dodSeatGuard?: boolean } | null)?.dodSeatGuard) return;
      history.pushState({ dodSeatGuard: true }, '', location.href);
      setLeaving(true);
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [seated]);

  const doJoin = async (code: string, name: string, look: PlayerLook) => {
    setJoinError('');
    try {
      const identity = await join(code, name);
      rememberLook(look, name);
      await send('player:set-look', look.kind === 'photo' ? { photo: look.photo } : { presetId: look.presetId }, identity);
    } catch (caught) { setJoinError(caught instanceof Error ? caught.message : 'Could not join'); }
  };
  const doRejoin = async (code: string, seatCode: string) => {
    setJoinError('');
    try { await join(code, recallLook().name || 'Player', seatCode); }
    catch (caught) { setJoinError(caught instanceof Error ? caught.message : 'Could not get your seat back'); }
  };

  if (!credentials) return <JoinScreen initialCode={urlRoomCode} join={doJoin} rejoin={doRejoin} busyError={removed ? 'You were removed from the game.' : joinError}/>;
  if (!room) return <main className="dod-app dod-phone dod-loading">
    <p>{reconnectError ? `Can't reach your seat yet: ${reconnectError}` : 'Connecting to the studio…'}</p>
    {reconnectError && <button className="dod-primary" onClick={retryReconnect}>Try again</button>}
    <button className="dod-link" onClick={leave}>Join a different room</button>
  </main>;
  const me = room.players.find((player) => player.id === credentials.playerId);
  if (!me) return <main className="dod-app dod-phone dod-loading"><p>You're no longer in this game.</p><button className="dod-primary" onClick={leave}>Join again</button></main>;

  const round = room.round;
  const lookEditable = room.phase === 'lobby' || room.phase === 'tutorial';
  let body: ReactNode;
  if (!me.lookSet || (changingLook && lookEditable)) {
    body = <section><h2>Pick your look</h2><AvatarPicker tone={room.settings.tone} value={me.look} onChange={(look) => { rememberLook(look, me.name); setChangingLook(false); void send('player:set-look', look.kind === 'photo' ? { photo: look.photo } : { presetId: look.presetId }); }}/></section>;
  } else if (room.phase === 'lobby') {
    body = <section className="dod-wait"><Avatar look={me.look} size={140}/><h2>You're in, {me.name}!</h2><p>{room.players.length}/4 players. Look at the TV.</p><button className="dod-ghost" onClick={() => setChangingLook(true)}>Change my look</button></section>;
  } else if (room.phase === 'tutorial') {
    body = <section className="dod-wait"><h2>Watch the TV</h2><p>The tutorial is playing.</p><button className="dod-ghost" onClick={() => setChangingLook(true)}>Change my look</button></section>;
  } else if (room.phase === 'build') {
    const mine = room.upcoming.find((item) => item.presenterId === me.id);
    body = !mine ? <section className="dod-wait"><h2>Everyone is building</h2></section>
      : mine.premise ? <BuildLocked room={room} round={mine} send={send}/> : <Builder room={room} round={mine} send={send}/>;
  } else if (round && ['reveal'].includes(room.phase)) {
    body = <RevealView room={room} round={round} me={me}/>;
  } else if (round && round.presenterId === me.id && room.phase !== 'break') {
    body = <PresenterView room={room} round={round} send={send}/>;
  } else if (round && room.phase !== 'break') {
    body = <SharkView room={room} round={round} me={me} send={send}/>;
  } else if (room.phase === 'forecast' || room.phase === 'forecast-result') {
    body = <ForecastView room={room} me={me} send={send}/>;
  } else {
    const next = room.phase === 'break' ? room.players[room.roundIndex + 1] : null;
    body = <><StandingsView room={room} me={me}/>{next && <p className="dod-hint">{next.id === me.id ? 'You pitch next! Get ready.' : `Next presenter: ${next.name}`}</p>}</>;
  }

  return <main className={`dod-app dod-phone ${round?.presenterId === me.id ? 'is-presenter' : ''}`}>
    <Header room={room} me={me} send={send}/>
    {room.paused && <div className="dod-banner-phone">⏸ Paused{room.pauseReason === 'presenter-offline' ? ' — waiting for the presenter' : ''}</div>}
    <div className="dod-phone-body">{body}</div>
    {error && <div className="dod-toast" role="alert" onClick={() => setError('')}>{error}</div>}
    {leaving && <div className="dod-leave" role="dialog" aria-label="Leave the game?">
      <div>
        <h2>Leave the game?</h2>
        <p>Your seat stays saved. To come back, open the join link again, or enter room <b>{room.code}</b> with seat code <b>{me.seatCode}</b>.</p>
        <button className="dod-primary big" onClick={() => setLeaving(false)}>Stay in the game</button>
        <button className="dod-ghost" onClick={() => { setLeaving(false); navigateInApp(pickerUrl()); }}>Leave for now</button>
      </div>
    </div>}
  </main>;
}
