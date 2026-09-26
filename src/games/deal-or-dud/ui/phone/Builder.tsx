import { useMemo, useState } from 'react';
import type { BuilderPicks, DealSnapshot, RoundState } from '../../types';
import { AUDIENCES, MODIFIERS, PRODUCTS } from '../../content/words';
import { MAX_PER_COLUMN, buildHeadline, mainProductOf, optionAllowed, productById, shuffle, tonePool } from '../../content/dealer';
import { useClockSeconds } from '../net';

type Column = 'modifiers' | 'products' | 'audiences';
const PAGE_SIZE = 12;
const COLUMNS: { id: Column; label: string; hint: string }[] = [
  { id: 'modifiers', label: 'Modifier', hint: 'haunted, luxury, self-aware…' },
  { id: 'products', label: 'Product', hint: 'what you sell' },
  { id: 'audiences', label: 'Audience', hint: 'who it is for' }
];

function seededRandom(seed: number) {
  return () => { seed = (seed * 16807 + 11) % 2147483647; return seed / 2147483647; };
}

type Send = (event: string, payload?: Record<string, unknown>) => Promise<boolean>;

/** The business-name chips: tap one to use it, 🔀 for three new ones. Works before and after locking. */
export function NameChoice({ round, send }: { round: RoundState; send: Send }) {
  if (!round.nameOptions.length) return null;
  return <div className="dod-name-choice">
    <small>Business name</small>
    <div className="dod-chips">{round.nameOptions.map((name, index) => <button key={name} className={index === 0 ? 'is-on' : ''} aria-pressed={index === 0} onClick={() => void send('player:name-choose', { index })}>{name}</button>)}
      <button className="dod-link" aria-label="Other names" onClick={() => void send('player:names-reshuffle')}>🔀</button></div>
  </div>;
}

/** After locking: the product is set, the name can still change, and the phone waits for everyone else. */
export function BuildLocked({ room, round, send }: { room: DealSnapshot; round: RoundState; send: Send }) {
  const lockSeconds = useClockSeconds(room);
  const locked = room.upcoming.filter((item) => item.lockedAt).length;
  return <section className="dod-screen dod-builder"><div className="dod-screen-main">
    <div className="dod-headline-preview"><small>Locked in 🔒 · you pitch in round {round.index + 1}</small><b>{round.premise?.headline}</b></div>
    <NameChoice round={round} send={send}/>
    <p className="dod-hint">Your secret file (GOOD or BAD) shows up when it's your turn to pitch.</p>
  </div>
    <div className="dod-screen-action"><p className="dod-hint">{locked}/{room.players.length} locked in · round 1 starts when everyone is ready, or in {lockSeconds}s</p></div>
  </section>;
}

export function Builder({ room, round, send }: { room: DealSnapshot; round: RoundState; send: Send }) {
  const [column, setColumn] = useState<Column>('products');
  const [page, setPage] = useState(0);
  const tone = room.settings.tone;
  const picks: BuilderPicks = round.builder;
  const lockSeconds = useClockSeconds(room);
  // Stable shuffle per round so options don't jump around on every update.
  const options = useMemo(() => {
    const random = seededRandom(room.createdAt % 100000 + round.index * 7919 + 1);
    return {
      modifiers: shuffle(tonePool(MODIFIERS, tone), random),
      products: shuffle(tonePool(PRODUCTS, tone), random),
      audiences: shuffle(tonePool(AUDIENCES, tone), random)
    };
  }, [room.createdAt, round.index, tone]);
  const headline = buildHeadline(picks);
  const main = mainProductOf(picks);
  const supplied = picks.suppliedProduct ? productById(picks.suppliedProduct) : null;
  // A page of options fits the phone without scrolling; picked options always stay in view.
  const pool = options[column].filter((option) => !picks[column].includes(option.id) && optionAllowed(column, option.id, picks, tone));
  const pages = Math.max(1, Math.ceil(pool.length / PAGE_SIZE));
  const shown = [
    ...options[column].filter((option) => picks[column].includes(option.id)),
    ...pool.slice((page % pages) * PAGE_SIZE, (page % pages) * PAGE_SIZE + PAGE_SIZE)
  ];

  return <section className="dod-screen dod-builder"><div className="dod-screen-main">
    <div className="dod-headline-preview">
      <small>Your business</small>
      <b>{headline || 'Pick anything, or nothing!'}</b>
      {supplied && !picks.products.length && <button className="dod-link" onClick={() => void send('player:builder-reshuffle')}>🔀 Different product</button>}
      {picks.products.length === 2 && <div className="dod-main-choice">Main product:
        {picks.products.map((id) => <button key={id} className={main?.id === id ? 'is-on' : ''} onClick={() => void send('player:builder-main', { id })}>{productById(id)?.text}</button>)}
      </div>}
    </div>
    <NameChoice round={round} send={send}/>
    <div className="dod-tabs" role="tablist">
      {COLUMNS.map((item) => <button key={item.id} role="tab" aria-selected={column === item.id} className={column === item.id ? 'is-on' : ''} onClick={() => { setColumn(item.id); setPage(0); }}>
        {item.label} <span className="dod-count">{picks[item.id].length}/{MAX_PER_COLUMN}</span>
      </button>)}
    </div>
    <div className="dod-chips" role="group" aria-label={COLUMNS.find((item) => item.id === column)?.hint}>
      {shown.map((option) => {
        const on = picks[column].includes(option.id);
        return <button key={option.id} className={on ? 'is-on' : ''} aria-pressed={on} onClick={() => void send('player:builder-toggle', { column, id: option.id })}>{option.text}</button>;
      })}
      {pages > 1 && <button className="dod-more" onClick={() => setPage((value) => value + 1)}>🔀 More options</button>}
    </div>
    </div>
    <div className="dod-screen-action">
      <button className="dod-primary big" onClick={() => void send('player:builder-lock')}>Lock it in · auto in {lockSeconds}s</button>
    </div>
  </section>;
}
