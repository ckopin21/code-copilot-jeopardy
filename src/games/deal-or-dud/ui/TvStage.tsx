// The shared TV view. Host and Presentation both render this; neither ever receives secrets.
import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import type { DealPlayer, DealSnapshot, PublicFact } from '../types';
import { estimateMinutes } from '../types';
import { subjectLabel } from '../content/subjects';
import { StudioSet, CHAIR_SPOTS, PRESENTER_SPOT } from './StudioSet';
import { Avatar } from './Avatar';
import { PHASE_LABEL, SOURCE_LABEL, TUTORIAL_TIMELINE, formatClock, offerLabel, playerById, rankOf, signed, standings } from './labels';
import { useClockSeconds, useNow, useServerOffset } from './net';
import type { TutorialFocus } from '../tutorialScript';
import { useNarrationCaption } from '../audio/useNarration';

/** Scales a fixed 1920x1080 stage to fit any screen without scrolling. */
export function Stage16x9({ children }: { children: ReactNode }) {
  const outer = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  useLayoutEffect(() => {
    const update = () => {
      const box = outer.current?.getBoundingClientRect();
      if (box) setScale(Math.min(box.width / 1920, box.height / 1080));
    };
    update();
    const observer = new ResizeObserver(update);
    if (outer.current) observer.observe(outer.current);
    return () => observer.disconnect();
  }, []);
  return <div className="dod-stage-outer" ref={outer}>
    <div className="dod-stage" style={{ transform: `translate(-50%, -50%) scale(${scale})` }}>{children}</div>
  </div>;
}

function SeatedShark({ player, spot, offerTag, highlight, dim, locked }: {
  player: DealPlayer; spot: { x: number; y: number; scale: number }; offerTag?: ReactNode; highlight?: boolean; dim?: boolean; locked?: boolean;
}) {
  const size = 150 * spot.scale;
  return <div className={`dod-seat ${highlight ? 'is-highlight' : ''} ${dim ? 'is-dim' : ''} ${player.connected ? '' : 'is-offline'}`}
    style={{ left: spot.x, top: spot.y, transform: `translate(-50%, -100%) scale(${1})` }} data-player={player.id}>
    {offerTag && <div className="dod-offer-tag">{offerTag}</div>}
    <div className="dod-seat-figure" style={{ width: size * 1.5 }}>
      <Avatar look={player.look} size={size} className="dod-seat-head"/>
      <svg className="dod-seat-body" viewBox="0 0 200 110" width={size * 1.35} aria-hidden="true">
        <path d="M20 110 Q24 30 100 22 Q176 30 180 110 Z" fill="#1c2233"/>
        <path d="M80 26 L100 70 L120 26 Z" fill="#f4f1ea"/>
        <path d="M96 34 L104 34 L108 76 L100 86 L92 76 Z" fill="#c0392b"/>
      </svg>
    </div>
    <div className="dod-nameplate">
      <span className="dod-name">{player.name}</span>
      <span className="dod-score">{player.score}</span>
      {locked && <span className="dod-lock" aria-label="Locked">🔒</span>}
    </div>
  </div>;
}

function StandingPresenter({ player, label = 'Presenter' }: { player: DealPlayer; label?: string }) {
  const size = 190;
  return <div className={`dod-presenter ${player.connected ? '' : 'is-offline'}`} style={{ left: PRESENTER_SPOT.x, top: PRESENTER_SPOT.y }}>
    <div className="dod-presenter-label">{label}</div>
    <Avatar look={player.look} size={size} className="dod-presenter-head"/>
    <svg className="dod-presenter-body" viewBox="0 0 200 260" width={230} aria-hidden="true">
      <path d="M30 60 Q40 10 100 8 Q160 10 170 60 L160 170 L40 170 Z" fill="#26324d"/>
      <path d="M78 10 L100 70 L122 10 Z" fill="#f4f1ea"/>
      <rect x="48" y="168" width="44" height="90" rx="12" fill="#1b2438"/>
      <rect x="108" y="168" width="44" height="90" rx="12" fill="#1b2438"/>
      <path d="M30 60 L6 150 L26 156 L50 80 Z M170 60 L194 150 L174 156 L150 80 Z" fill="#26324d"/>
    </svg>
    <div className="dod-nameplate presenter"><span className="dod-name">{player.name}</span><span className="dod-score">{player.score}</span></div>
  </div>;
}

function FactCardView({ fact, fresh }: { fact: Pick<PublicFact, 'subject' | 'text' | 'source'>; fresh?: boolean }) {
  return <article className={`dod-card src-${fact.source} ${fresh ? 'is-fresh' : ''}`}>
    <header><span className="dod-card-subject">{subjectLabel(fact.subject)}</span><span className="dod-card-source">{SOURCE_LABEL[fact.source]}</span></header>
    <p>{fact.text}</p>
    <footer>✓ Verified</footer>
  </article>;
}

function FactBoard({ room }: { room: DealSnapshot }) {
  const now = useNow(1000);
  const offset = useServerOffset(room);
  const facts = room.round?.publicFacts ?? [];
  if (!facts.length) return null;
  return <section className={`dod-board count-${Math.min(6, facts.length)}`} aria-label="Verified facts">
    {facts.map((fact) => <FactCardView key={fact.id} fact={fact} fresh={now + offset - fact.revealedAt < 6000}/>)}
  </section>;
}

function TopBar({ room }: { room: DealSnapshot }) {
  const seconds = useClockSeconds(room);
  const premise = room.round?.premise;
  const showClock = room.clock && !['reveal', 'break', 'gameover', 'tutorial', 'final', 'forecast-result', 'offers-reveal'].includes(room.phase);
  const frozen = room.clock?.endsAt === null;
  return <header className="dod-topbar">
    <div className="dod-headline">
      {premise ? <>
        <div className="dod-business-name">{premise.businessName}</div>
        <h1>{premise.headline}</h1>
        {premise.addOn && <div className="dod-addon">+ Add-on: {premise.addOn}</div>}
      </> : <>
        <div className="dod-business-name">Deal or Dud</div>
        <h1>{room.phase === 'lobby' ? 'The studio is open' : room.phase === 'build' ? 'Everyone is building a business…' : PHASE_LABEL[room.phase]}</h1>
      </>}
    </div>
    <div className="dod-phase-box">
      <div className="dod-phase">{room.round ? `Round ${room.round.index + 1} of 4 · ` : ''}{PHASE_LABEL[room.phase]}</div>
      {showClock && <div className={`dod-clock ${seconds <= 10 ? 'is-low' : ''} ${room.paused || frozen ? 'is-paused' : ''}`}>{formatClock(seconds)}{(room.paused || frozen) && <small>{room.paused ? 'PAUSED' : 'ON HOLD'}</small>}</div>}
    </div>
  </header>;
}

function Banner({ children, tone = 'info' }: { children: ReactNode; tone?: 'info' | 'alert' | 'good' | 'bad' }) {
  return <div className={`dod-banner tone-${tone}`}>{children}</div>;
}

function PhaseOverlay({ room }: { room: DealSnapshot }) {
  const round = room.round;
  const presenter = playerById(room, round?.presenterId);
  if (room.phase === 'build') {
    const locked = room.upcoming.filter((item) => item.lockedAt).length;
    return <Banner>Everyone: build a business on your phone. You each pitch it once. <span className="dod-banner-count">Locked in {locked}/{room.players.length}</span></Banner>;
  }
  if (!round) return null;
  return <>
    {room.phase === 'pitch' && <Banner>{presenter?.name} is pitching. The three good facts are on the board. Sharks, listen first.</Banner>}
    {room.phase === 'discussion' && <Banner>Ask anything. Hit a hidden bad fact and the presenter must admit it. <span className="dod-banner-count">Ready to bid {round.readyToBid.length}/3</span></Banner>}
    {room.phase === 'offers' && <Banner>Negotiate out loud, then lock in a bid from $0 to $500K on your phone.</Banner>}
    {room.phase === 'partner' && <Banner tone="alert">Tie at the top! {presenter?.name} chooses a partner.</Banner>}
  </>;
}

function RevealPanel({ room }: { room: DealSnapshot }) {
  const result = room.round?.result;
  const premise = room.round?.premise;
  if (!result) return null;
  const deal = result.deal;
  const shark = playerById(room, deal?.sharkId);
  return <section className={`dod-reveal verdict-${result.verdict}`}>
    <div className="dod-stamp">{result.verdict === 'good' ? 'GOOD BUSINESS' : 'BAD BUSINESS'}</div>
    <p className="dod-deal-line">{(deal ? `${shark?.name} invested $${deal.amount}K in ${premise?.businessName}.` : `No deal for ${premise?.businessName}.`).replace(/\.\.$/, '.')}</p>
    <p className="dod-why">{result.explanation}</p>
    <p className="dod-later">Later… {result.laterLine}</p>
    <ul className="dod-deltas">
      {result.scores.map((score) => {
        const player = playerById(room, score.playerId);
        return <li key={score.playerId} className={score.delta > 0 ? 'up' : score.delta < 0 ? 'down' : ''}>
          {player && <Avatar look={player.look} size={48}/>}<b>{player?.name}</b><span>{score.reason}</span><strong>{signed(score.delta)}</strong>
        </li>;
      })}
    </ul>
  </section>;
}

function Standings({ room, title }: { room: DealSnapshot; title: string }) {
  const nextIndex = room.roundIndex + 1;
  const next = room.phase === 'break' ? room.players[nextIndex] : null;
  return <section className="dod-standings">
    <h2>{title}</h2>
    <ol>{standings(room).map((player) => <li key={player.id}><span className="rank">{rankOf(room, player)}</span><Avatar look={player.look} size={64}/><b>{player.name}</b><strong>{player.score}</strong></li>)}</ol>
    {next && <p className="dod-next">Next presenter: <b>{next.name}</b></p>}
  </section>;
}

function ForecastPanel({ room }: { room: DealSnapshot }) {
  const forecast = room.forecast;
  if (!forecast) return null;
  const names = forecast.playerIds.map((id) => playerById(room, id)?.name).join(' vs ');
  const winner = playerById(room, forecast.winnerId);
  return <section className="dod-forecast">
    <div className="dod-kicker">Tiebreaker: Final Forecast {forecast.attempt === 2 ? '(round 2)' : ''}</div>
    <h2>{forecast.card.title}</h2>
    {room.phase === 'forecast' && <ul>{forecast.card.clues.map((clue) => <li key={clue}>{clue}</li>)}</ul>}
    <p className="dod-question">{forecast.card.question}</p>
    {room.phase === 'forecast' && <p>{names} · guess on your phones</p>}
    {room.phase === 'forecast-result' && <div className="dod-forecast-result">
      <p>Answer: <b>{forecast.answer?.toLocaleString()}</b></p>
      <ul>{forecast.playerIds.map((id) => <li key={id}>{playerById(room, id)?.name}: {forecast.guesses[id] == null ? 'no guess' : forecast.guesses[id]!.toLocaleString()}</li>)}</ul>
      <p>{winner ? `${winner.name} wins${forecast.randomDraw ? ' by random draw' : ''}!` : 'Still tied! One more card…'}</p>
    </div>}
  </section>;
}

function GameOver({ room }: { room: DealSnapshot }) {
  const winner = playerById(room, room.winnerIds[0]);
  return <section className="dod-gameover">
    <div className="dod-kicker">Top investor</div>
    {winner && <><Avatar look={winner.look} size={220}/><h2>{winner.name} wins!</h2></>}
    <ol>{standings(room).map((player) => <li key={player.id} value={rankOf(room, player)}><b>{player.name}</b> {player.score}</li>)}</ol>
  </section>;
}

function LobbyMessage({ room }: { room: DealSnapshot }) {
  const ready = room.players.filter((player) => player.lookSet).length;
  const { low, high } = estimateMinutes(room.settings.timers, room.settings.tutorial);
  return <section className="dod-lobby-note">
    <p>{ready < 4 ? `Waiting for players… ${ready}/4 in the studio` : 'All four players are in the studio!'}</p>
    <p className="dod-sub">About {low}–{high} minutes · {room.settings.tone} topics · {room.settings.complexity} facts</p>
  </section>;
}

// ---------- tutorial ----------
const DEMO_FACTS: Pick<PublicFact, 'subject' | 'text' | 'source'>[] = [
  { subject: 'sales', text: 'It sold 10,000 in its first month.', source: 'opening' },
  { subject: 'stores', text: 'Stores ordered 5,000 more.', source: 'opening' },
  { subject: 'reviews', text: 'Most buyers rate it 5 stars.', source: 'opening' }
];

export function tutorialElapsed(room: DealSnapshot, now: number, offset: number): number {
  const clock = room.clock;
  if (!clock) return 0;
  const remaining = clock.endsAt === null ? clock.remainingMs : Math.max(0, clock.endsAt - (room.paused && room.pausedAt ? room.pausedAt : now + offset));
  return (clock.totalMs - remaining) / 1000;
}

function TutorialDemo({ focus }: { focus: TutorialFocus }) {
  switch (focus) {
    case 'phone-dossier':
      return <div className="dod-demo-phone"><div className="dod-demo-screen">
        <div className="dod-demo-secret">🤫 Secret: <b>BAD</b> business</div>
        <div className="dod-demo-cards">{['👍 Lots sold', '👍 Stores want more', '👍 Great reviews', '👎 Most get returned', '👎 Returns cost money', '👎 People stop using it'].map((line) => <span key={line}>{line}</span>)}</div>
      </div></div>;
    case 'cards':
      return <section className="dod-board count-3 is-demo">{DEMO_FACTS.map((fact, index) => <FactCardView key={index} fact={fact} fresh/>)}</section>;
    case 'sharks':
      return <div className="dod-demo-bubble">“Do people keep it, or send it back?”</div>;
    case 'offers':
      return <div className="dod-demo-offers"><span>$300K 🔒</span><span>$0 🔒</span><span>$500K 🔒</span></div>;
    case 'reveal':
      return <div className="dod-demo-reveal"><div className="dod-stamp">GOOD BUSINESS</div><p>Top bid: +1 per $100K, +2 bonus · $500K = +7</p><p className="bad">Bad business: −1 per $100K · a $0 bid +1</p></div>;
    case 'scores':
      return <div className="dod-demo-trophy">🏆</div>;
    default:
      return null;
  }
}

export function TutorialOverlay({ room, captions }: { room: DealSnapshot; captions: boolean }) {
  const now = useNow(200);
  const offset = useServerOffset(room);
  const elapsed = tutorialElapsed(room, now, offset);
  const current = [...TUTORIAL_TIMELINE].reverse().find((item) => elapsed >= item.start) ?? TUTORIAL_TIMELINE[0];
  const index = TUTORIAL_TIMELINE.indexOf(current);
  return <div className={`dod-tutorial focus-${current.step.focus}`}>
    <div className="dod-tutorial-title"><span>{index + 1}/{TUTORIAL_TIMELINE.length}</span> {current.step.title}</div>
    <TutorialDemo focus={current.step.focus}/>
    {/* With captions off, the step title and demo still carry the essential rule. */}
    {captions && <div className="dod-captions" aria-live="polite">{current.step.line}</div>}
  </div>;
}

/** What the hosts are saying, on the screen that plays the narration. */
function NarrationCaption() {
  const caption = useNarrationCaption();
  return caption ? <div className="dod-captions is-live" aria-live="polite">{caption}</div> : null;
}

export function TvStage({ room, hostBar, extra }: { room: DealSnapshot; hostBar?: ReactNode; extra?: ReactNode }) {
  const round = room.round;
  const inRound = Boolean(round);
  const sharks = inRound ? round!.sharkIds.map((id) => playerById(room, id)).filter(Boolean) as DealPlayer[] : room.players.slice(0, 3);
  const presenter = inRound ? playerById(room, round!.presenterId) : ['lobby', 'tutorial', 'build'].includes(room.phase) ? room.players[3] : undefined;
  const built = (id: string) => room.phase === 'build' && Boolean(room.upcoming.find((item) => item.presenterId === id)?.lockedAt);
  const showOffers = round && ['offers-reveal', 'partner', 'reveal'].includes(room.phase);
  const focus = room.phase === 'offers' || room.phase === 'offers-reveal' ? 'sharks' : ['pitch', 'build'].includes(room.phase) ? 'presenter' : null;
  const tutorialFocus = room.phase === 'tutorial' ? (() => {
    const elapsed = tutorialElapsed(room, Date.now(), 0);
    return ([...TUTORIAL_TIMELINE].reverse().find((item) => elapsed >= item.start) ?? TUTORIAL_TIMELINE[0]).step.focus;
  })() : null;
  const bigPanel = ['reveal', 'break', 'final', 'forecast', 'forecast-result', 'gameover'].includes(room.phase);
  const deal = round?.result?.deal;

  // Re-render every second while the tutorial runs so the highlight follows the narration.
  useNow(room.phase === 'tutorial' ? 500 : 60_000);

  return <Stage16x9>
    <StudioSet focus={tutorialFocus === 'sharks' || tutorialFocus === 'offers' ? 'sharks' : tutorialFocus === 'phone-dossier' ? 'presenter' : focus}/>
    {sharks.map((player, index) => {
      const offer = round?.offers[player.id];
      const tag = showOffers ? <span className={`dod-offer ${offer === 0 ? 'out' : ''} ${deal?.sharkId === player.id ? 'won' : ''}`}>{offerLabel(offer)}</span>
        : room.phase === 'offers' ? <span className="dod-offer thinking">{round!.lockedOffers.includes(player.id) ? 'Locked 🔒' : 'Thinking…'}</span>
          : room.phase === 'partner' && round!.tiedSharkIds.includes(player.id) ? <span className="dod-offer">{offerLabel(offer)}</span> : undefined;
      return <SeatedShark key={player.id} player={player} spot={CHAIR_SPOTS[index]} offerTag={tag}
        highlight={room.phase === 'partner' && round!.tiedSharkIds.includes(player.id) || deal?.sharkId === player.id}
        dim={bigPanel && room.phase !== 'reveal'} locked={(room.phase === 'offers' && round!.lockedOffers.includes(player.id)) || built(player.id)}/>;
    })}
    {presenter && !bigPanel && <StandingPresenter player={presenter} label={inRound ? 'Presenter' : room.phase === 'build' ? (built(presenter.id) ? 'Locked in 🔒' : 'Building…') : 'Waiting to play'}/>}
    <TopBar room={room}/>
    {room.phase !== 'tutorial' && !['break', 'final', 'forecast', 'forecast-result', 'gameover'].includes(room.phase) && <FactBoard room={room}/>}
    <div className="dod-overlays">
      {room.phase === 'lobby' && <LobbyMessage room={room}/>}
      <PhaseOverlay room={room}/>
      {room.phase === 'reveal' && <RevealPanel room={room}/>}
      {room.phase === 'break' && <Standings room={room} title={`After round ${room.roundIndex + 1}`}/>}
      {room.phase === 'final' && <Standings room={room} title={room.winnerIds.length ? 'Final scores' : 'Final scores — it\'s a tie!'}/>}
      {(room.phase === 'forecast' || room.phase === 'forecast-result') && <ForecastPanel room={room}/>}
      {room.phase === 'gameover' && <GameOver room={room}/>}
      {room.phase === 'tutorial' && <TutorialOverlay room={room} captions={room.settings.captions}/>}
    </div>
    {room.settings.captions && room.phase !== 'tutorial' && <NarrationCaption/>}
    {room.paused && <div className="dod-paused"><div>⏸ Paused{room.pauseReason === 'presenter-offline' ? ' — waiting for the presenter\'s phone to reconnect' : ''}</div></div>}
    {extra}
    {hostBar}
  </Stage16x9>;
}
