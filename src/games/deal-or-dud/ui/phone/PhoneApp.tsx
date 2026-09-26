// Phone controller. The presenter's phone is their private backstage dossier; a shark's phone is question cues and the offer control.
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import type { DealPlayer, DealSnapshot, FactCard, OfferChoice, PlayerLook, RoundState, SubjectId } from '../../types';
import { OFFER_CHOICES } from '../../types';
import { usePlayerRoom, useClockSeconds } from '../net';
import { Avatar } from '../Avatar';
import { AvatarPicker, recallLook, rememberLook } from './AvatarPicker';
import { BuildLocked, Builder } from './Builder';
import { PHASE_LABEL, formatClock, offerLabel, playerById, signed, standings } from '../labels';
import { subjectLabel } from '../../content/subjects';
import { PITCH_CUES, SHARK_QUESTIONS } from '../../content/cues';
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

function Tabs<T extends string>({ value, options, onChange }: { value: T; options: { id: T; label: string }[]; onChange: (id: T) => void }) {
  return <div className="dod-tabs" role="tablist">{options.map((option) => <button key={option.id} role="tab" aria-selected={value === option.id} className={value === option.id ? 'is-on' : ''} onClick={() => onChange(option.id)}>{option.label}</button>)}</div>;
}

function FactList({ facts }: { facts: { id: string; subject: SubjectId; text: string }[] }) {
  return <div className="dod-phone-facts">{facts.map((fact) => <div key={fact.id} className="dod-mini-card"><small>{subjectLabel(fact.subject)}</small>{fact.text}</div>)}</div>;
}

function CueList({ items, onMore }: { items: { id: string; text: string }[]; onMore?: () => void }) {
  return <div className="dod-cues"><ul>{items.map((item) => <li key={item.id}>{item.text}</li>)}</ul>{onMore && <button className="dod-link" onClick={onMore}>🔀 Other ideas</button>}</div>;
}

// ---------- presenter ----------
function DossierCard({ card, round, canReveal, send }: { card: FactCard; round: RoundState; canReveal: boolean; send: Send }) {
  const [confirm, setConfirm] = useState(false);
  const publicFact = round.publicFacts.find((fact) => fact.id === card.id);
  return <div className={`dod-dossier-card ${card.polarity} ${publicFact ? 'is-public' : ''}`}>
    <div className="dod-card-top"><small>{subjectLabel(card.subject)}</small>
      {publicFact ? <span className="dod-on-tv">On TV ✓</span> : canReveal && (confirm
        ? <span className="dod-row"><button className="dod-mini" onClick={() => setConfirm(false)}>Cancel</button><button className="dod-mini is-strong" onClick={() => { setConfirm(false); void send('player:reveal-card', { cardId: card.id }); }}>Show it</button></span>
        : <button className="dod-mini" onClick={() => setConfirm(true)}>Show on TV</button>)}</div>
    <p>{card.text}</p>
  </div>;
}

function PresenterDossier({ room, round, send }: { room: DealSnapshot; round: RoundState; send: Send }) {
  const [view, setView] = useState<'unfavorable' | 'favorable' | 'ideas'>('unfavorable');
  const canReveal = ['pitch', 'discussion', 'offers'].includes(room.phase);
  const cues = round.pitchCueIds.map((id) => PITCH_CUES.find((item) => item.id === id)).filter(Boolean) as { id: string; text: string }[];
  return <>
    <div className={`dod-verdict verdict-${round.verdict}`}><b>{round.verdict === 'good' ? 'GOOD business' : 'BAD business'} <small>secret</small></b><span>{round.explanation}</span></div>
    <Tabs value={view} onChange={setView} options={[
      { id: 'unfavorable', label: '👎 Bad (hidden)' },
      { id: 'favorable', label: '👍 Good (on TV)' },
      ...(cues.length ? [{ id: 'ideas' as const, label: '💡 Ideas' }] : [])
    ]}/>
    {view === 'ideas'
      ? <CueList items={cues}/>
      : <div className="dod-dossier">{round.dossier.filter((card) => card.polarity === view).map((card) => <DossierCard key={card.id} card={card} round={round} canReveal={canReveal} send={send}/>)}</div>}
    {view === 'unfavorable' && <p className="dod-rule">If a shark asks about one of these, you must say it.</p>}
  </>;
}

function PresenterView({ room, round, send }: { room: DealSnapshot; round: RoundState; send: Send }) {
  switch (room.phase) {
    case 'partner': return <Screen><h2>It's a tie! Pick your partner</h2>
      <p>Both bid {offerLabel(round.offers[round.tiedSharkIds[0]])}.</p>
      {round.tiedSharkIds.map((id) => { const shark = playerById(room, id)!; return <button key={id} className="dod-primary big" onClick={() => void send('player:partner', { sharkId: id })}><Avatar look={shark.look} size={40}/> {shark.name}</button>; })}
    </Screen>;
    default: return <Screen action={room.phase === 'pitch' ? <button className="dod-primary big" onClick={() => void send('player:end-pitch')}>Done pitching → questions</button>
      : room.phase === 'discussion' ? <p className="dod-hint">Sharks ready to bid: {round.readyToBid.length}/3</p>
        : room.phase === 'offers' ? <p className="dod-hint">Sharks are bidding. Keep selling!</p> : undefined}>
      <PresenterDossier room={room} round={round} send={send}/>
    </Screen>;
  }
}

// ---------- shark ----------
function OfferPanel({ round, me, send }: { round: RoundState; me: DealPlayer; send: Send }) {
  const locked = round.lockedOffers.includes(me.id);
  const [choice, setChoice] = useState<OfferChoice | null>(null);
  if (locked) return <Screen><div className="dod-wait"><h2>Locked 🔒</h2><p className="dod-big">{offerLabel(round.offers[me.id])}</p><p>Waiting for the other sharks…</p></div></Screen>;
  return <Screen action={<button className="dod-primary big" disabled={choice === null} onClick={() => void send('player:offer-lock', { choice })}>{choice === null ? 'Pick a bid' : `Lock in ${offerLabel(choice)} (final)`}</button>}>
    <h2>Your bid</h2>
    <p className="dod-hint">Top bid wins. GOOD: +1 per $100K, +2 bonus. BAD: −1 per $100K. $0 on a BAD one: +1. No bid by the buzzer = $0.</p>
    <div className="dod-offer-grid">{OFFER_CHOICES.map((option) => <button key={option} className={`${choice === option ? 'is-on' : ''} ${option === 0 ? 'out' : ''}`} aria-pressed={choice === option} onClick={() => setChoice(option)}>{offerLabel(option)}</button>)}</div>
  </Screen>;
}

function SharkTalk({ room, round, me, send }: { room: DealSnapshot; round: RoundState; me: DealPlayer; send: Send }) {
  const [view, setView] = useState<'facts' | 'ideas'>('facts');
  const [seed, setSeed] = useState(1);
  const ideas = useMemo(() => shuffle(tonePool(SHARK_QUESTIONS, room.settings.tone), seededRandom(seed * 9301 + round.index * 49297)).slice(0, 4), [seed, round.index, room.settings.tone]);
  const ready = round.readyToBid.includes(me.id);
  return <Screen action={room.phase === 'discussion'
    ? <button className={`big ${ready ? 'dod-ghost' : 'dod-primary'}`} onClick={() => void send('player:ready-to-bid')}>{ready ? `Ready ✓ (${round.readyToBid.length}/3) · tap to undo` : `I'm ready to bid (${round.readyToBid.length}/3)`}</button>
    : <p className="dod-hint">Listen to the pitch. Questions come next.</p>}>
    {round.premise && <div className="dod-premise"><small>{round.premise.businessName}</small><b>{round.premise.headline}</b></div>}
    <Tabs value={view} onChange={setView} options={[{ id: 'facts', label: `Facts on TV (${round.publicFacts.length}/6)` }, { id: 'ideas', label: 'Question ideas' }]}/>
    {view === 'facts' ? <FactList facts={round.publicFacts}/> : <CueList items={ideas} onMore={() => setSeed((value) => value + 1)}/>}
    <p className="dod-rule">Ask about anything. If it touches a hidden bad fact, the presenter must tell you.</p>
  </Screen>;
}

function SharkView({ room, round, me, send }: { room: DealSnapshot; round: RoundState; me: DealPlayer; send: Send }) {
  const presenter = playerById(room, round.presenterId);
  switch (room.phase) {
    case 'offers': return <OfferPanel round={round} me={me} send={send}/>;
    case 'offers-reveal': case 'partner': return <Screen><div className="dod-wait"><h2>Bids</h2><ul className="dod-offer-list">{round.sharkIds.map((id) => <li key={id}>{playerById(room, id)?.name}: <b>{offerLabel(round.offers[id])}</b></li>)}</ul>{room.phase === 'partner' && <p>{presenter?.name} is picking a partner…</p>}</div></Screen>;
    default: return <SharkTalk room={room} round={round} me={me} send={send}/>;
  }
}

// ---------- results ----------
function RevealView({ round, me }: { round: RoundState; me: DealPlayer }) {
  const result = round.result;
  if (!result) return null;
  const mine = result.scores.find((score) => score.playerId === me.id);
  return <section className={`dod-phone-reveal verdict-${result.verdict}`}>
    <div className="dod-stamp">{result.verdict === 'good' ? 'GOOD' : 'BAD'}</div>
    <p>{result.explanation}</p>
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
  const skippable = ['tutorial', 'build', 'pitch', 'discussion', 'reveal', 'break', 'final', 'forecast-result'].includes(room.phase);
  return <div className="dod-vip">
    <button className="dod-vip-toggle" onClick={() => setOpen((value) => !value)} aria-expanded={open}>🎛</button>
    {open && <div className="dod-vip-panel">
      {!['lobby', 'gameover'].includes(room.phase) && (room.paused ? <button onClick={() => { setOpen(false); void send('player:vip', { action: 'resume' }); }}>▶ Resume</button> : <button onClick={() => { setOpen(false); void send('player:vip', { action: 'pause' }); }}>⏸ Pause</button>)}
      {skippable && <button onClick={() => { setOpen(false); void send('player:vip', { action: 'continue' }); }}>{room.phase === 'build' ? 'Lock everyone in ▶▶' : room.phase === 'pitch' ? 'Skip the pitch ▶▶' : room.phase === 'discussion' ? 'Skip to bids ▶▶' : 'Skip ▶▶'}</button>}
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
    body = <RevealView round={round} me={me}/>;
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
