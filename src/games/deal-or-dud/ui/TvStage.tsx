// The shared TV view. Host and Presentation both render this; neither ever receives secrets.
import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import type { DealPlayer, DealSnapshot, OfferChoice, RoundState } from '../types';
import { estimateMinutes } from '../types';
import { gameAwards, moneyLabel } from '../engine/scoring';
import { ProductCard } from './ProductCard';
import { StudioSet, CHAIR_SPOTS, PRESENTER_SPOT } from './StudioSet';
import { Avatar } from './Avatar';
import { Emoji } from './Emoji';
import { CountUp } from './CountUp';
import { BID_LABELS, PHASE_LABEL, TUTORIAL_TIMELINE, clockElapsed, formatClock, offerLabel, pitchSecondsLeft, playerById, rankOf, revealSchedule, signed, standings } from './labels';
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

function SeatedShark({ player, score, spot, offerTag, highlight, dim, locked, out }: {
  player: DealPlayer; score: number; spot: { x: number; y: number; scale: number }; offerTag?: ReactNode; highlight?: boolean; dim?: boolean; locked?: boolean; out?: boolean;
}) {
  const size = 150 * spot.scale;
  return <div className={`dod-seat ${highlight ? 'is-highlight' : ''} ${dim ? 'is-dim' : ''} ${out ? 'is-out' : ''} ${player.connected ? '' : 'is-offline'}`}
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
      <CountUp className="dod-score" value={score}/>
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
    <div className="dod-nameplate presenter"><span className="dod-name">{player.name}</span><CountUp className="dod-score" value={player.score}/></div>
  </div>;
}

/** The product on stage: big during pitch time, tucked into the corner once questions open. */
function StageProduct({ room }: { room: DealSnapshot }) {
  const round = room.round;
  if (!round?.premise || !['stage', 'offers'].includes(room.phase)) return null;
  const big = room.phase === 'stage' && !round.questionsOpen;
  return <ProductCard key={big ? 'big' : 'corner'} premise={round.premise} className={big ? 'is-stage-big' : 'is-stage-corner'}/>;
}

/** The top row: headline on the left; host controls (Host tab only) beside the phase label on the right. */
function TopBar({ room, hostBar }: { room: DealSnapshot; hostBar?: ReactNode }) {
  const seconds = useClockSeconds(room);
  const premise = room.round?.premise;
  const showClock = room.clock && !['reveal', 'break', 'gameover', 'tutorial', 'final', 'forecast-result'].includes(room.phase);
  const frozen = room.clock?.endsAt === null;
  return <header className={`dod-topbar ${hostBar ? 'has-hostbar' : ''}`}>
    <div className="dod-headline">
      {premise ? <>
        <div className="dod-business-name">{premise.businessName}</div>
        {/* Long headlines step down in size so they stay clear of the scoreboard. */}
        <h1 key={premise.headline} className={premise.headline.length > 58 ? 'is-long' : premise.headline.length > 44 ? 'is-mid' : ''}>{premise.headline}</h1>
      </> : <>
        <div className="dod-business-name">Deal or Dud</div>
        <h1>{room.phase === 'lobby' ? 'The studio is open' : room.phase === 'build' ? 'Everyone is building a business…' : PHASE_LABEL[room.phase]}</h1>
      </>}
    </div>
    <div className="dod-phase-box">
      <div className="dod-phase-row">
        {hostBar}
        <div className="dod-phase">{room.round ? `Round ${room.round.index + 1} of 4 · ` : ''}{PHASE_LABEL[room.phase]}</div>
      </div>
      {showClock && <div className={`dod-clock ${seconds <= 10 ? 'is-low' : ''} ${room.paused || frozen ? 'is-paused' : ''}`}>{formatClock(seconds)}{(room.paused || frozen) && <small>{room.paused ? 'PAUSED' : 'ON HOLD'}</small>}</div>}
    </div>
  </header>;
}

function Banner({ children, tone = 'info' }: { children: ReactNode; tone?: 'info' | 'alert' | 'good' | 'bad' }) {
  return <div className={`dod-banner tone-${tone}`}>{children}</div>;
}

function StageBanner({ room, round }: { room: DealSnapshot; round: RoundState }) {
  const seconds = useClockSeconds(room);
  const pitch = pitchSecondsLeft(room, seconds);
  const presenter = playerById(room, round.presenterId);
  if (pitch !== null) return <Banner tone="alert"><Emoji char="🎤"/> Pitch time! {presenter?.name} has the floor. <span className="dod-banner-count">Questions in {formatClock(pitch)}</span></Banner>;
  const out = round.out.map((item) => playerById(room, item.sharkId)?.name).filter(Boolean);
  const stillIn = round.sharkIds.length - round.out.length;
  return <Banner><Emoji char="❓"/> Questions open! Sharks: ask anything.
    <span className="dod-banner-count">Ready to bid {round.readyToBid.length}/{stillIn}</span>
    {out.length > 0 && <span className="dod-banner-count is-out">Out: {out.join(', ')}</span>}</Banner>;
}

function PhaseOverlay({ room }: { room: DealSnapshot }) {
  const round = room.round;
  if (room.phase === 'build') {
    const locked = room.upcoming.filter((item) => item.lockedAt).length;
    return <Banner>Everyone: build a business on your phone. You each pitch it once. <span className="dod-banner-count">Locked in {locked}/{room.players.length}</span></Banner>;
  }
  if (!round) return null;
  return <>
    {room.phase === 'stage' && <StageBanner room={room} round={round}/>}
    {room.phase === 'offers' && <Banner>Sharks: lock in a secret bid on your phone. Closest to the other two scores!</Banner>}
  </>;
}

/** Reactions float up from the shark who sent them, for a few seconds. */
function FloatingReactions({ room, round }: { room: DealSnapshot; round: RoundState }) {
  const now = useNow(250);
  const offset = useServerOffset(room);
  const live = round.reactions.filter((item) => now + offset - item.at < 3_200);
  return <div className="dod-floats" aria-hidden="true">{live.map((item) => {
    const spot = CHAIR_SPOTS[round.sharkIds.indexOf(item.sharkId)] ?? CHAIR_SPOTS[0];
    const drift = ((item.id * 37) % 90) - 45;
    return <span key={`${round.index}:${item.id}`} className="dod-float" style={{ left: spot.x + drift, top: spot.y - 250 }}><Emoji char={item.emoji}/></span>;
  })}</div>;
}

/** "Ben is out!" slams onto the TV for a moment when a shark bails. */
function OutSting({ room, round }: { room: DealSnapshot; round: RoundState }) {
  const now = useNow(250);
  const offset = useServerOffset(room);
  const latest = round.out[round.out.length - 1];
  if (!latest || now + offset - latest.at > 2_600) return null;
  return <div className="dod-out-sting" key={latest.sharkId}><Emoji char="🚪"/> {playerById(room, latest.sharkId)?.name} is out!</div>;
}

function dealLine(room: DealSnapshot, sharkIds: string[]): string {
  const names = sharkIds.map((id) => playerById(room, id)?.name ?? '');
  if (!names.length) return 'No deal. Ouch!';
  if (names.length === 1) return `${names[0]} is in!`;
  if (names.length === 2) return `${names[0]} and ${names[1]} both want in!`;
  return 'All three sharks want in!';
}

/** How far the reveal has got: how many bids have flipped, and whether the total is up. */
function useRevealProgress(room: DealSnapshot): { flipped: number; totalShown: boolean } {
  const now = useNow(100);
  const offset = useServerOffset(room);
  if (room.phase !== 'reveal' || !room.clock) return { flipped: 3, totalShown: true };
  const elapsed = clockElapsed(room, now, offset);
  const schedule = revealSchedule(room.clock.totalMs);
  return { flipped: schedule.flips.filter((at) => elapsed >= at).length, totalShown: elapsed >= schedule.total };
}

/** The bids flip one at a time, lowest first, then the total and who is in. */
function RevealPanel({ room }: { room: DealSnapshot }) {
  const result = room.round?.result;
  const { flipped, totalShown } = useRevealProgress(room);
  if (!result) return null;
  return <section className={`dod-reveal ${totalShown ? (result.total ? 'is-raised' : 'is-empty') : ''}`}>
    <div className="dod-kicker">{totalShown ? result.businessName : <><Emoji char="🥁"/> The bids are in…</>}</div>
    <ol className="dod-bid-flips">{result.revealOrder.map((id, index) => {
      const player = playerById(room, id);
      const offer = result.offers[id] as OfferChoice;
      const shown = index < flipped;
      return <li key={id} className={shown ? 'is-flipped' : ''}>
        {player && <Avatar look={player.look} size={56}/>}<b>{player?.name}</b>
        {shown ? <strong><span>{offerLabel(offer)}</span><small><Emoji char={BID_LABELS[offer].emoji}/> {BID_LABELS[offer].text}</small></strong> : <strong className="is-hidden">?</strong>}
      </li>;
    })}</ol>
    {totalShown && <>
      <p className="dod-total">{result.total ? `${moneyLabel(result.total)} raised!` : 'Not a single dollar!'}</p>
      <p className="dod-deal-line">{result.dealSharkIds.length > 0 && <Emoji char="🤝"/>} {dealLine(room, result.dealSharkIds)}</p>
      <ul className="dod-deltas">{result.scores.filter((score) => score.delta !== 0 || score.playerId === result.presenterId).map((score) => {
        const player = playerById(room, score.playerId);
        return <li key={score.playerId} className={score.delta > 0 ? 'up' : score.delta < 0 ? 'down' : ''}>
          {player && <Avatar look={player.look} size={44}/>}<b>{player?.name}</b><span>{score.reason}</span><strong>{signed(score.delta)}</strong>
        </li>;
      })}</ul>
    </>}
  </section>;
}

function Standings({ room, title }: { room: DealSnapshot; title: string }) {
  const nextIndex = room.roundIndex + 1;
  const next = room.phase === 'break' ? room.players[nextIndex] : null;
  return <section className="dod-standings">
    <h2>{title}</h2>
    <ol>{standings(room).map((player) => <li key={player.id}><span className="rank">{rankOf(room, player)}</span><Avatar look={player.look} size={64}/><b>{player.name}</b><strong><CountUp value={player.score}/></strong></li>)}</ol>
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

/** End-of-game titles, just for fun. */
function Awards({ room }: { room: DealSnapshot }) {
  const awards = gameAwards(room.history, room.players);
  if (!awards.length) return null;
  return <ul className="dod-awards">{awards.map((award) => <li key={award.id}>
    <span className="dod-award-emoji"><Emoji char={award.emoji}/></span>
    <div><small>{award.title}</small><b>{award.playerIds.map((id) => playerById(room, id)?.name).join(' & ')}</b><span>{award.detail}</span></div>
  </li>)}</ul>;
}

function GameOver({ room }: { room: DealSnapshot }) {
  const winner = playerById(room, room.winnerIds[0]);
  return <section className="dod-gameover">
    <div className="dod-kicker">Top investor</div>
    {winner && <><Avatar look={winner.look} size={170}/><h2>{winner.name} wins!</h2></>}
    <ol>{standings(room).map((player) => <li key={player.id} value={rankOf(room, player)}><b>{player.name}</b> {player.score}</li>)}</ol>
    <Awards room={room}/>
  </section>;
}

function LobbyMessage({ room }: { room: DealSnapshot }) {
  const ready = room.players.filter((player) => player.lookSet).length;
  const { low, high } = estimateMinutes(room.settings.timers, room.settings.tutorial);
  return <section className="dod-lobby-note">
    <p>{ready < 4 ? `Waiting for players… ${ready}/4 in the studio` : 'All four players are in the studio!'}</p>
    <p className="dod-sub">About {low}–{high} minutes</p>
  </section>;
}

// ---------- tutorial ----------
const DEMO_CARDS = [{ emoji: '🍞', step: 'Product', text: 'Toasters' }, { emoji: '🦜', step: 'Twist', text: 'Pirate-themed' }, { emoji: '👵', step: 'For', text: 'Grandmas' }];
const DEMO_PREMISE = { headline: 'Pirate-themed toasters for grandmas', businessName: 'Toast Ahoy', mainProductId: 'demo', form: 'gadget' as const, emojis: ['🍞', '🦜', '👵'] };

function TutorialDemo({ focus }: { focus: TutorialFocus }) {
  switch (focus) {
    case 'build':
      return <div className="dod-demo-build">
        {DEMO_CARDS.map((card) => <div key={card.step} className="dod-demo-card"><small>{card.step}</small><span><Emoji char={card.emoji}/></span><b>{card.text}</b></div>)}
        <p>“Pirate-themed toasters for grandmas”</p>
      </div>;
    case 'pitch':
      return <>
        <ProductCard premise={DEMO_PREMISE} className="is-stage-big"/>
        <div className="dod-banner tone-alert"><Emoji char="🎤"/> Pitch time! One minute to sell it.</div>
      </>;
    case 'questions':
      return <>
        <div className="dod-demo-reactions">{['😂', '🔥', '🤔', '💀'].map((emoji, index) => <span key={emoji} style={{ animationDelay: `${index * 0.35}s` }}><Emoji char={emoji}/></span>)}</div>
        <div className="dod-out-sting is-demo"><Emoji char="🚪"/> I'm out!</div>
      </>;
    case 'offers':
      return <div className="dod-demo-offers"><span>$300K 🔒</span><span>$0 🔒</span><span>$500K 🔒</span></div>;
    case 'reveal':
      return <div className="dod-demo-reveal">
        <p className="dod-total">$800K raised!</p>
        <p>Presenter: <b>+8</b> (one point per $100K)</p>
        <p>Shark closest to the other two: <b>+2</b></p>
      </div>;
    default:
      return null;
  }
}

export function TutorialOverlay({ room, captions }: { room: DealSnapshot; captions: boolean }) {
  const now = useNow(200);
  const offset = useServerOffset(room);
  const elapsed = clockElapsed(room, now, offset);
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
  const reveal = useRevealProgress(room);
  const result = room.phase === 'reveal' ? round?.result : null;
  const flippedIds = result ? result.revealOrder.slice(0, reveal.flipped) : [];
  // The round's points are already in the scores; the nameplates hold them back until the reveal shows the total.
  const shownScore = (player: DealPlayer) => result && !reveal.totalShown
    ? player.score - (result.scores.find((score) => score.playerId === player.id)?.delta ?? 0) : player.score;
  const isOut = (id: string) => Boolean(round?.out.some((item) => item.sharkId === id));
  const focus = room.phase === 'offers' ? 'sharks' : ['stage', 'build'].includes(room.phase) ? 'presenter' : null;
  const tutorialFocus = room.phase === 'tutorial' ? (() => {
    const elapsed = clockElapsed(room, Date.now(), 0);
    return ([...TUTORIAL_TIMELINE].reverse().find((item) => elapsed >= item.start) ?? TUTORIAL_TIMELINE[0]).step.focus;
  })() : null;
  const bigPanel = ['reveal', 'break', 'final', 'forecast', 'forecast-result', 'gameover'].includes(room.phase);

  // Re-render every second while the tutorial runs so the highlight follows the narration.
  useNow(room.phase === 'tutorial' ? 500 : 60_000);

  return <Stage16x9>
    <StudioSet focus={tutorialFocus === 'questions' || tutorialFocus === 'offers' ? 'sharks' : tutorialFocus === 'pitch' ? 'presenter' : focus}/>
    {sharks.map((player, index) => {
      const offer = round?.offers[player.id];
      const out = isOut(player.id) && ['stage', 'offers', 'reveal'].includes(room.phase);
      const won = Boolean(result && reveal.totalShown && result.dealSharkIds.includes(player.id));
      const tag = result ? (flippedIds.includes(player.id) ? <span className={`dod-offer ${offer === 0 ? 'out' : ''} ${won ? 'won' : ''}`}>{offerLabel(offer)}</span> : undefined)
        : out ? <span className="dod-offer out">Out 🚪</span>
          : room.phase === 'offers' ? <span className="dod-offer thinking">{round!.lockedOffers.includes(player.id) ? 'Locked 🔒' : 'Thinking…'}</span>
            : room.phase === 'stage' && round!.readyToBid.includes(player.id) ? <span className="dod-offer thinking">Ready ✋</span> : undefined;
      return <SeatedShark key={player.id} player={player} score={shownScore(player)} spot={CHAIR_SPOTS[index]} offerTag={tag} highlight={won} out={out}
        dim={bigPanel && room.phase !== 'reveal'} locked={(room.phase === 'offers' && !out && round!.lockedOffers.includes(player.id)) || built(player.id)}/>;
    })}
    {presenter && !bigPanel && <StandingPresenter player={presenter} label={inRound ? 'Presenter' : room.phase === 'build' ? (built(presenter.id) ? 'Locked in 🔒' : 'Building…') : 'Waiting to play'}/>}
    <TopBar room={room} hostBar={hostBar}/>
    <StageProduct room={room}/>
    {round && room.phase === 'stage' && <FloatingReactions room={room} round={round}/>}
    <div className="dod-overlays">
      {room.phase === 'lobby' && <LobbyMessage room={room}/>}
      <PhaseOverlay room={room}/>
      {round && room.phase === 'stage' && <OutSting room={room} round={round}/>}
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
  </Stage16x9>;
}
