// Phone controller. The presenter's phone shows their product and the clock; a shark's phone has reactions, "I'm out",
// "Ready to bid" and then the secret bid.
import { useEffect, useState, type ReactNode } from 'react';
import type { DealPlayer, DealSnapshot, OfferChoice, PlayerLook, RoundState } from '../../types';
import { OFFER_CHOICES, PLAYER_COUNT, REACTIONS } from '../../types';
import { usePlayerRoom, useClockSeconds, useNow, useServerOffset } from '../net';
import { Avatar } from '../Avatar';
import { Emoji } from '../Emoji';
import { AvatarPicker, recallLook, rememberLook } from './AvatarPicker';
import { BuildLocked, Builder } from './Builder';
import { BID_LABELS, PHASE_LABEL, clockElapsed, formatClock, offerLabel, pitchSecondsLeft, playerById, revealSchedule, signed, skipLabel, standings } from '../labels';
import { ProductCard } from '../ProductCard';
import { gameAwards, moneyLabel } from '../../engine/scoring';
import { AudioControls } from '../HostApp';
import { GAME_ID } from '../../types';
import { navigateInApp, pickerUrl } from '../../../../platform/session/resetInstance';
import { useRoomLookup } from '../../../../platform/net/useRoomLookup';

type Send = (event: string, payload?: Record<string, unknown>) => Promise<boolean>;

function Clock({ room }: { room: DealSnapshot }) {
  const seconds = useClockSeconds(room);
  if (!room.clock) return null;
  return <span className={`dod-phone-clock ${seconds <= 10 ? 'is-low' : ''}`}>{room.paused ? '⏸ ' : ''}{formatClock(seconds)}</span>;
}

function Header({ room, me, send, onLeave }: { room: DealSnapshot; me: DealPlayer; send: Send; onLeave: () => void }) {
  const now = useNow(room.phase === 'reveal' ? 250 : 60_000);
  const offset = useServerOffset(room);
  // During the reveal the new points wait until the TV shows the total.
  const result = room.phase === 'reveal' ? room.round?.result : null;
  const early = Boolean(result && room.clock && clockElapsed(room, now, offset) < revealSchedule(room.clock.totalMs).total);
  const score = early ? me.score - (result!.scores.find((item) => item.playerId === me.id)?.delta ?? 0) : me.score;
  const role = room.round ? (room.round.presenterId === me.id ? 'Presenter' : 'Shark') : null;
  return <header className="dod-phone-header">
    <Avatar look={me.look} size={40}/>
    <div><b>{me.name}</b><small>{role ? `${role} · ` : ''}{score} pts</small>
      {me.seatCode && <small className="dod-seat-code">Room {room.code} · Seat {me.seatCode}</small>}</div>
    {room.vipId === me.id && <VipControls room={room} send={send}/>}
    <button className="dod-leave-open" onClick={onLeave} aria-label="Leave the game">Leave</button>
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
  // The buttons stay greyed out until the room key belongs to a running game. A bad key in the link shows the field.
  const lookup = useRoomLookup(code);
  const keyOk = lookup.status === 'found';
  const showCode = !initialCode || lookup.status === 'missing' || code !== initialCode;
  const keyHint = lookup.status === 'missing' ? <p className="dod-error" role="alert">No game with that room key is running. Check the key on the TV.</p> : null;
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
    {view === 'name' && <form onSubmit={(event) => { event.preventDefault(); if (keyOk && name.trim()) setStep('avatar'); }}>
      {showCode && codeField}
      {keyHint}
      <label>Your name<input value={name} onChange={(event) => setName(event.target.value)} maxLength={16} autoComplete="nickname" placeholder="Name"/></label>
      <button className="dod-primary big" disabled={!keyOk || !name.trim()}>Next: pick your look</button>
      <button type="button" className="dod-link" onClick={() => setStep('seat')}>Already playing? Get your seat back</button>
    </form>}
    {view === 'avatar' && <>
      <h2>Pick your look</h2>
      <AvatarPicker tone="clean" value={look} onChange={setLook}/>
      <div className="dod-row dod-join-actions">
        <button className="dod-ghost" onClick={() => setStep('name')}>Back</button>
        <button className="dod-primary big" disabled={!look || busy || !keyOk} onClick={() => void submit()}>{busy ? 'Joining…' : 'Join the tank'}</button>
      </div>
    </>}
    {view === 'seat' && <form onSubmit={(event) => { event.preventDefault(); if (keyOk && seatCode.length === 4) void submitSeat(); }}>
      <h2>Get your seat back</h2>
      <p className="dod-hint">Your seat code is the 4-digit number under your name on your old screen.</p>
      {codeField}
      {keyHint}
      <label>Seat code<input value={seatCode} onChange={(event) => setSeatCode(event.target.value.replace(/\D/g, '').slice(0, 4))} inputMode="numeric" pattern="[0-9]*" autoComplete="off" placeholder="1234"/></label>
      <button className="dod-primary big" disabled={busy || !keyOk || seatCode.length !== 4}>{busy ? 'Joining…' : 'Take my seat'}</button>
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

// ---------- presenter ----------
/** The presenter's phone: their product and a big clock (pitch time first, then the stage clock). */
function PresenterView({ room, round }: { room: DealSnapshot; round: RoundState }) {
  const seconds = useClockSeconds(room);
  const pitch = pitchSecondsLeft(room, seconds);
  const label = room.phase === 'offers' ? 'Sharks are bidding' : pitch !== null ? 'Pitch time' : 'Questions';
  const hint = room.phase === 'offers' ? 'Secret bids are coming in. Fingers crossed!'
    : pitch !== null ? 'You have the floor. Sell it!' : 'Questions open! Answer the sharks.';
  return <Screen>
    {round.premise && <ProductCard premise={round.premise}/>}
    <div className={`dod-big-clock ${pitch !== null ? 'is-pitch' : ''}`}><small>{label}</small><b>{formatClock(pitch ?? seconds)}</b></div>
    <p className="dod-hint dod-center">{hint}</p>
  </Screen>;
}

// ---------- shark ----------
function OfferPanel({ round, me, send }: { round: RoundState; me: DealPlayer; send: Send }) {
  const locked = round.lockedOffers.includes(me.id);
  const out = round.out.some((item) => item.sharkId === me.id);
  const [choice, setChoice] = useState<OfferChoice | null>(null);
  if (out) return <Screen><div className="dod-wait"><h2>You're out 🚪</h2><p className="dod-big">$0</p><p>Your bid is locked. Watch the others sweat.</p></div></Screen>;
  if (locked) {
    const offer = round.offers[me.id];
    return <Screen><div className="dod-wait"><h2>Locked 🔒</h2><p className="dod-big">{offerLabel(offer)}</p>{offer != null && <p><Emoji char={BID_LABELS[offer].emoji}/> {BID_LABELS[offer].text}</p>}<p>Waiting for the other sharks…</p></div></Screen>;
  }
  return <Screen action={<button className="dod-primary big" disabled={choice === null} onClick={() => void send('player:offer-lock', { choice })}>{choice === null ? 'Pick a bid' : `Lock in ${offerLabel(choice)}`}</button>}>
    <h2>Your secret bid</h2>
    <p className="dod-hint">How much would you put in? The presenter scores 1 point per $100K raised by all three sharks. No bid by the buzzer = $0.</p>
    <div className="dod-offer-grid">{OFFER_CHOICES.map((option) => <button key={option} className={`${choice === option ? 'is-on' : ''} ${option === 0 ? 'out' : ''}`} aria-pressed={choice === option} onClick={() => setChoice(option)}>
      <span>{offerLabel(option)}</span><small><Emoji char={BID_LABELS[option].emoji}/> {BID_LABELS[option].text}</small>
    </button>)}</div>
  </Screen>;
}

/**
 * On stage. During pitch time a shark just listens (no buttons: the presenter has the floor). Then: reactions for the
 * TV, "I'm out!" (tap twice), and "Ready to bid".
 */
function SharkStage({ room, round, me, send }: { room: DealSnapshot; round: RoundState; me: DealPlayer; send: Send }) {
  const seconds = useClockSeconds(room);
  const pitch = pitchSecondsLeft(room, seconds);
  const [confirmOut, setConfirmOut] = useState(false);
  const out = round.out.some((item) => item.sharkId === me.id);
  const stillIn = round.sharkIds.filter((id) => !round.out.some((item) => item.sharkId === id));
  const ready = round.readyToBid.includes(me.id);
  const readyCount = `${round.readyToBid.length}/${stillIn.length}`;
  useEffect(() => { if (!confirmOut) return; const id = window.setTimeout(() => setConfirmOut(false), 4000); return () => window.clearTimeout(id); }, [confirmOut]);
  if (pitch !== null) return <Screen>
    {round.premise && <ProductCard premise={round.premise} className="is-small"/>}
    <div className="dod-listen"><span aria-hidden="true"><Emoji char="🎤"/></span><h2>Pitch time. Just listen!</h2><p>Questions open in <b>{formatClock(pitch)}</b></p></div>
  </Screen>;
  return <Screen action={out ? undefined : <button className={`big ${ready ? 'dod-ghost' : 'dod-primary'}`} onClick={() => void send('player:ready-to-bid')}>{ready ? `Ready ✓ (${readyCount}) · tap to undo` : `Ready to bid (${readyCount})`}</button>}>
    {round.premise && <ProductCard premise={round.premise} className="is-small"/>}
    <h3>{out ? "You're out. React all you like!" : 'Questions open! Ask away.'}</h3>
    <div className="dod-reactions" role="group" aria-label="React on the TV">
      {REACTIONS.map((emoji) => <button key={emoji} aria-label={`React ${emoji}`} onClick={() => void send('player:react', { emoji })}><Emoji char={emoji}/></button>)}
    </div>
    {out ? <p className="dod-out-note">🚪 Your bid is locked at $0.</p>
      : <button className={`dod-out-button ${confirmOut ? 'is-confirm' : ''}`} onClick={() => { if (!confirmOut) { setConfirmOut(true); return; } setConfirmOut(false); void send('player:out'); }}>
        {confirmOut ? 'Tap again: I\'m out! ($0)' : 'I\'m out!'}
      </button>}
  </Screen>;
}

function SharkView({ room, round, me, send }: { room: DealSnapshot; round: RoundState; me: DealPlayer; send: Send }) {
  return room.phase === 'offers' ? <OfferPanel round={round} me={me} send={send}/> : <SharkStage room={room} round={round} me={me} send={send}/>;
}

// ---------- results ----------
/** The phone keeps the total secret until the TV flips the last bid, so nobody's screen spoils the reveal. */
function RevealView({ room, round, me }: { room: DealSnapshot; round: RoundState; me: DealPlayer }) {
  const now = useNow(200);
  const offset = useServerOffset(room);
  const result = round.result;
  if (!result || !room.clock) return null;
  const shown = clockElapsed(room, now, offset) >= revealSchedule(room.clock.totalMs).total;
  const mine = result.scores.find((score) => score.playerId === me.id);
  const myBid = result.offers[me.id];
  if (!shown) return <section className="dod-phone-reveal"><div className="dod-drum" aria-hidden="true"><Emoji char="🥁"/></div><h2>Watch the TV!</h2>{myBid !== undefined && <p>Your bid: <b>{offerLabel(myBid)}</b></p>}</section>;
  return <section className="dod-phone-reveal">
    <p className="dod-kicker">{result.total ? 'Raised' : 'No offers'}</p>
    <p className="dod-big">{moneyLabel(result.total)}</p>
    {myBid !== undefined && <p>Your bid: <b>{offerLabel(myBid)}</b></p>}
    {mine && round.presenterId === me.id && <p className="dod-big">{signed(mine.delta)} <small>{mine.reason}</small></p>}
  </section>;
}

function AwardsList({ room }: { room: DealSnapshot }) {
  const awards = gameAwards(room.history, room.players);
  if (!awards.length) return null;
  return <ul className="dod-awards-phone">{awards.map((award) => <li key={award.id}><Emoji char={award.emoji}/> <b>{award.title}</b> {award.playerIds.map((id) => playerById(room, id)?.name).join(' & ')}</li>)}</ul>;
}

function StandingsView({ room, me }: { room: DealSnapshot; me: DealPlayer }) {
  return <section className="dod-phone-standings"><h2>{room.phase === 'gameover' ? `${playerById(room, room.winnerIds[0])?.name ?? ''} wins!` : 'Scores'}</h2>
    <ol>{standings(room).map((player) => <li key={player.id} className={player.id === me.id ? 'is-me' : ''}><Avatar look={player.look} size={32}/>{player.name}<b>{player.score}</b></li>)}</ol>
    {room.phase === 'gameover' && <AwardsList room={room}/>}</section>;
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

/** "Change my name" in the lobby: a small inline form, before the game starts. */
function NameEditor({ name, onSave }: { name: string; onSave: (name: string) => void }) {
  const [draft, setDraft] = useState<string | null>(null);
  if (draft === null) return <button className="dod-ghost" onClick={() => setDraft(name)}>Change my name</button>;
  const save = () => { const next = draft.trim(); if (next && next !== name) onSave(next); setDraft(null); };
  return <form className="dod-name-edit" onSubmit={(event) => { event.preventDefault(); save(); }}>
    <input value={draft} maxLength={16} autoFocus aria-label="Your name" onChange={(event) => setDraft(event.target.value)}/>
    <button className="dod-primary" type="submit" disabled={!draft.trim()}>Save</button>
    <button className="dod-ghost" type="button" onClick={() => setDraft(null)}>Cancel</button>
  </form>;
}

// ---------- VIP host controls ----------
function VipControls({ room, send }: { room: DealSnapshot; send: Send }) {
  const [open, setOpen] = useState(false);
  const skippable = ['tutorial', 'build', 'stage', 'reveal', 'break', 'final', 'forecast-result'].includes(room.phase);
  const allReady = room.players.length === PLAYER_COUNT && room.players.every((player) => player.lookSet && player.connected);
  return <div className="dod-vip">
    <button className="dod-vip-toggle" onClick={() => setOpen((value) => !value)} aria-expanded={open}>🎛</button>
    {open && <div className="dod-vip-panel">
      {room.phase === 'lobby' && <button disabled={!allReady} onClick={() => { setOpen(false); void send('player:vip', { action: 'start' }); }}>{allReady ? '▶ Start the game' : `Start when 4 players are in (${room.players.length}/4)`}</button>}
      {room.phase === 'gameover' && <button onClick={() => { setOpen(false); void send('player:vip', { action: 'new-game' }); }}>↻ Play again</button>}
      {!['lobby', 'gameover'].includes(room.phase) && (room.paused ? <button onClick={() => { setOpen(false); void send('player:vip', { action: 'resume' }); }}>▶ Resume</button> : <button onClick={() => { setOpen(false); void send('player:vip', { action: 'pause' }); }}>⏸ Pause</button>)}
      {skippable && <button onClick={() => { setOpen(false); void send('player:vip', { action: 'continue' }); }}>{skipLabel(room)}</button>}
      <AudioControls audio={room.settings.audio} onAudio={(audio) => void send('player:vip', { action: 'audio', audio })}/>
    </div>}
  </div>;
}

// ---------- app ----------
export function PhoneApp({ urlRoomCode }: { urlRoomCode: string }) {
  const { room, credentials, join, send, error, setError, removed, left, leave, leaveForGood, reconnectError, retryReconnect } = usePlayerRoom(urlRoomCode);
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

  if (!credentials) return <JoinScreen initialCode={urlRoomCode} join={doJoin} rejoin={doRejoin} busyError={removed ? 'You were removed from the game.' : left ? 'You left the game. Join again any time.' : joinError}/>;
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
    body = <section><h2>Pick your look</h2><AvatarPicker tone={room.settings.tone} value={me.look} onChange={(look) => { rememberLook(look, me.name); setChangingLook(false); void send('player:set-look', look.kind === 'photo' ? { photo: look.photo } : { presetId: look.presetId }); }}/>
      {me.lookSet && <button className="dod-ghost" onClick={() => setChangingLook(false)}>Keep my current look</button>}</section>;
  } else if (room.phase === 'lobby') {
    body = <section className="dod-wait"><Avatar look={me.look} size={140}/><h2>You're in, {me.name}!</h2><p>{room.players.length}/4 players. Look at the TV.</p>
      <NameEditor name={me.name} onSave={(name) => { rememberLook(me.look, name); void send('player:set-name', { name }); }}/>
      <button className="dod-ghost" onClick={() => setChangingLook(true)}>Change my look</button></section>;
  } else if (room.phase === 'tutorial') {
    body = <section className="dod-wait"><h2>Watch the TV</h2><p>The tutorial is playing.</p><button className="dod-ghost" onClick={() => setChangingLook(true)}>Change my look</button></section>;
  } else if (room.phase === 'build') {
    const mine = room.upcoming.find((item) => item.presenterId === me.id);
    body = !mine ? <section className="dod-wait"><h2>Everyone is building</h2></section>
      : mine.premise ? <BuildLocked room={room} round={mine} send={send}/> : <Builder room={room} round={mine} send={send}/>;
  } else if (round && ['reveal'].includes(room.phase)) {
    body = <RevealView room={room} round={round} me={me}/>;
  } else if (round && round.presenterId === me.id && room.phase !== 'break') {
    body = <PresenterView room={room} round={round}/>;
  } else if (round && room.phase !== 'break') {
    body = <SharkView room={room} round={round} me={me} send={send}/>;
  } else if (room.phase === 'forecast' || room.phase === 'forecast-result') {
    body = <ForecastView room={room} me={me} send={send}/>;
  } else {
    const nextIndex = room.roundIndex + 1;
    const newBuild = room.phase === 'break' && nextIndex % 4 === 0;
    const next = room.phase === 'break' && !newBuild ? room.players[nextIndex % 4] : null;
    body = <><StandingsView room={room} me={me}/>{next && <p className="dod-hint">{next.id === me.id ? 'You pitch next! Get ready.' : `Next presenter: ${next.name}`}</p>}{newBuild && nextIndex < room.settings.pitches * 4 && <p className="dod-hint">Next: everyone builds a brand new product!</p>}</>;
  }

  return <main className={`dod-app dod-phone ${round?.presenterId === me.id ? 'is-presenter' : ''}`}>
    <Header room={room} me={me} send={send} onLeave={() => setLeaving(true)}/>
    {room.paused && <div className="dod-banner-phone">⏸ Paused{room.pauseReason === 'presenter-offline' ? ' — waiting for the presenter' : ''}</div>}
    <div className="dod-phone-body">{body}</div>
    {error && <div className="dod-toast" role="alert" onClick={() => setError('')}>{error}</div>}
    {leaving && <div className="dod-leave" role="dialog" aria-label="Leave the game?">
      <div>
        <h2>Leave the game?</h2>
        <p><b>Leave for now</b> keeps your seat: come back with the join link, or room <b>{room.code}</b> and seat code <b>{me.seatCode}</b>.</p>
        <p><b>Leave for good</b> gives your seat to someone else.{room.phase !== 'lobby' && ' The game needs four players, so everyone goes back to the lobby and this game ends.'}</p>
        <button className="dod-primary big" onClick={() => setLeaving(false)}>Stay in the game</button>
        <button className="dod-ghost" onClick={() => { setLeaving(false); navigateInApp(pickerUrl()); }}>Leave for now</button>
        <button className="dod-ghost is-danger" onClick={() => { setLeaving(false); void leaveForGood(); }}>Leave for good</button>
      </div>
    </div>}
  </main>;
}
