import { useState } from 'react';
import type { BuilderColumn, BuilderPicks, DealSnapshot, RoundState } from '../../types';
import { audienceById, buildHeadline, modifierById, productById } from '../../content/dealer';
import { useClockSeconds } from '../net';
import { Emoji } from '../Emoji';

type Send = (event: string, payload?: Record<string, unknown>) => Promise<boolean>;
type Step = BuilderColumn | 'name';

const STEPS: { id: BuilderColumn; label: string; title: string }[] = [
  { id: 'products', label: 'Product', title: 'Pick a product' },
  { id: 'modifiers', label: 'Twist', title: 'Add a twist' },
  { id: 'audiences', label: 'For', title: 'Who is it for?' }
];

function card(column: BuilderColumn, id: string | null): { emoji: string; text: string } | null {
  const item = column === 'products' ? productById(id) : column === 'modifiers' ? modifierById(id) : audienceById(id);
  return item ? { emoji: item.emoji, text: item.text } : null;
}
function picked(picks: BuilderPicks, column: BuilderColumn): string | null {
  return column === 'products' ? picks.product : column === 'modifiers' ? picks.modifier : picks.audience;
}
/** Where a phone that just (re)opened the builder should be: the first step without a pick. */
function firstOpenStep(picks: BuilderPicks): Step {
  return STEPS.find((step) => !picked(picks, step.id))?.id ?? 'name';
}

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
    <p className="dod-hint">Your secret scorecard (GOOD or BAD) shows up when it's your turn on stage.</p>
  </div>
    <div className="dod-screen-action"><p className="dod-hint">{locked}/{room.players.length} locked in · round 1 starts when everyone is ready, or in {lockSeconds}s</p></div>
  </section>;
}

/** Three quick card picks: a product, a twist, and who it's for. Each step deals four cards; 🔀 deals four new ones. */
export function Builder({ room, round, send }: { room: DealSnapshot; round: RoundState; send: Send }) {
  const picks = round.builder;
  const [step, setStep] = useState<Step>(() => firstOpenStep(picks));
  const lockSeconds = useClockSeconds(room);
  const headline = buildHeadline(picks);
  const at = STEPS.findIndex((item) => item.id === step);
  const current = STEPS[at];
  const choose = (column: BuilderColumn, id: string) => {
    void send('player:builder-pick', { column, id });
    setStep(STEPS[STEPS.findIndex((item) => item.id === column) + 1]?.id ?? 'name');
  };

  return <section className="dod-screen dod-builder"><div className="dod-screen-main">
    <ol className="dod-build-steps" aria-label="Your three picks">
      {STEPS.map((item, index) => {
        const chosen = card(item.id, picked(picks, item.id));
        const reachable = index === 0 || Boolean(picks.product);
        return <li key={item.id}><button className={`${step === item.id ? 'is-on' : ''} ${chosen ? 'is-done' : ''}`} disabled={!reachable} aria-current={step === item.id ? 'step' : undefined} onClick={() => setStep(item.id)}>
          <small>{index + 1}. {item.label}</small><span>{chosen ? <><Emoji char={chosen.emoji}/> {chosen.text}</> : '—'}</span>
        </button></li>;
      })}
    </ol>
    <div className="dod-headline-preview"><small>Your business</small><b>{headline || 'Pick three cards to build it'}</b></div>
    {current ? <>
      <h2 className="dod-step-title">{current.title}</h2>
      <div className="dod-hand" role="group" aria-label={current.title}>
        {picks.hands[current.id].map((id) => {
          const item = card(current.id, id);
          if (!item) return null;
          const on = picked(picks, current.id) === id;
          return <button key={id} className={`dod-pick-card ${on ? 'is-on' : ''}`} aria-pressed={on} onClick={() => choose(current.id, id)}>
            <span className="dod-pick-emoji" aria-hidden="true"><Emoji char={item.emoji}/></span><b>{item.text}</b>
          </button>;
        })}
      </div>
      <div className="dod-row dod-hand-tools">
        {at > 0 ? <button className="dod-ghost" onClick={() => setStep(STEPS[at - 1].id)}>← Back</button> : <span/>}
        <button className="dod-ghost" onClick={() => void send('player:builder-reroll', { column: current.id })}>🔀 New cards</button>
        {picked(picks, current.id) && <button className="dod-ghost" onClick={() => setStep(STEPS[at + 1]?.id ?? 'name')}>Next →</button>}
      </div>
    </> : <>
      <NameChoice round={round} send={send}/>
      <p className="dod-hint">Tap a pick above to change it.</p>
    </>}
  </div>
    <div className="dod-screen-action">
      {step === 'name'
        ? <button className="dod-primary big" onClick={() => void send('player:builder-lock')}>Lock it in · auto in {lockSeconds}s</button>
        : <p className="dod-hint">Auto-locks in {lockSeconds}s (empty picks get a random card)</p>}
    </div>
  </section>;
}
