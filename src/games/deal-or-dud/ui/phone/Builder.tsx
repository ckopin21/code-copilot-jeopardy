import { useEffect, useRef, useState } from 'react';
import type { BuilderColumn, BuilderPicks, DealSnapshot, RoundState } from '../../types';
import { CUSTOM_EMOJI, CUSTOM_MAX, audienceById, modifierById, productById, stepText } from '../../content/dealer';
import { useClockSeconds } from '../net';
import { Emoji } from '../Emoji';

type Send = (event: string, payload?: Record<string, unknown>) => Promise<boolean>;
type Step = BuilderColumn | 'name';

/** The steps in reading order, so each pick lands left to right: "[twist] [product] for [who]". */
const STEPS: { id: BuilderColumn; label: string; title: string; where: string; placeholder: string; example: string }[] = [
  { id: 'modifiers', label: 'Twist', title: 'Pick a twist', where: 'the first word: what makes it special', placeholder: '[twist]', example: 'haunted' },
  { id: 'products', label: 'Product', title: 'Pick a product', where: 'the thing you sell', placeholder: '[product]', example: 'hot tubs' },
  { id: 'audiences', label: 'For', title: 'Who is it for?', where: 'the end, after "for"', placeholder: '[who]', example: 'bored astronauts' }
];

/**
 * The business as a sentence with a slot for each pick, in reading order: "[twist] [product] for [who]". Empty slots
 * show what goes there, and the slot the player is picking right now is highlighted, so it's clear where a card lands.
 */
function HeadlineSlots({ picks, step }: { picks: BuilderPicks; step: Step }) {
  const slot = (item: typeof STEPS[number]) => {
    const text = stepText(picks, item.id);
    return <span className={`dod-slot ${step === item.id ? 'is-active' : ''} ${text ? 'is-filled' : ''}`}>{text ?? item.placeholder}</span>;
  };
  return <b className="dod-slots">{slot(STEPS[0])} {slot(STEPS[1])} for {slot(STEPS[2])}</b>;
}

function card(column: BuilderColumn, id: string | null): { emoji: string; text: string } | null {
  const item = column === 'products' ? productById(id) : column === 'modifiers' ? modifierById(id) : audienceById(id);
  return item ? { emoji: item.emoji, text: item.text } : null;
}
function picked(picks: BuilderPicks, column: BuilderColumn): string | null {
  return column === 'products' ? picks.product : column === 'modifiers' ? picks.modifier : picks.audience;
}
/** Where a phone that just (re)opened the builder should be: the first step without a pick. */
function firstOpenStep(picks: BuilderPicks): Step {
  return STEPS.find((step) => !stepText(picks, step.id))?.id ?? 'name';
}

/** "✏️ Write your own" for a step: a small form in place of the cards. */
function WriteOwn({ step, picks, send, onDone }: { step: typeof STEPS[number]; picks: BuilderPicks; send: Send; onDone: (saved: boolean) => void }) {
  const [draft, setDraft] = useState(picks.custom?.[step.id] ?? '');
  const save = () => {
    const text = draft.trim();
    void send('player:builder-custom', { column: step.id, text });
    onDone(Boolean(text));
  };
  return <form className="dod-write-own" onSubmit={(event) => { event.preventDefault(); save(); }}>
    <label>Your own {step.label.toLowerCase()}<input value={draft} maxLength={CUSTOM_MAX} autoFocus placeholder={`e.g. ${step.example}`} onChange={(event) => setDraft(event.target.value)} enterKeyHint="done"/></label>
    <div className="dod-row">
      <button type="button" className="dod-ghost" onClick={() => onDone(false)}>Back to cards</button>
      <button className="dod-primary" disabled={!draft.trim() && !picks.custom?.[step.id]}>{draft.trim() ? 'Use it' : 'Clear it'}</button>
    </div>
  </form>;
}

/**
 * The business name: type anything. The generated name shows as the placeholder and is used if the box is left empty;
 * 🎲 drops in a generated idea. Sent as you type (and when the box loses focus, so a quick "Lock it in" keeps it).
 */
export function NameChoice({ round, send }: { round: RoundState; send: Send }) {
  const [draft, setDraft] = useState(round.typedName ?? '');
  const sent = useRef(round.typedName ?? '');
  const idea = useRef(0);
  const flush = (value: string) => {
    if (value.trim() === sent.current.trim()) return;
    sent.current = value;
    void send('player:business-name', { name: value });
  };
  // Only a change to the text restarts the wait; the builder re-renders every clock tick.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { const id = window.setTimeout(() => flush(draft), 400); return () => window.clearTimeout(id); }, [draft]);
  const suggest = () => {
    const options = round.nameOptions.filter((name) => name !== draft);
    if (idea.current >= options.length) { idea.current = 0; void send('player:names-reshuffle'); }
    const next = options[idea.current++ % Math.max(1, options.length)];
    if (next) { setDraft(next); flush(next); }
  };
  return <div className="dod-name-choice">
    <small>Business name</small>
    <div className="dod-name-field">
      <input value={draft} maxLength={32} placeholder={round.nameOptions[0] ?? 'Name your business'} aria-label="Business name"
        onChange={(event) => setDraft(event.target.value)} onBlur={() => flush(draft)} autoComplete="off" enterKeyHint="done"
        onKeyDown={(event) => { if (event.key === 'Enter') (event.target as HTMLInputElement).blur(); }}/>
      <button type="button" className="dod-ghost" aria-label="Give me a name idea" onClick={suggest}>🎲</button>
    </div>
    {!draft.trim() && round.nameOptions[0] && <p className="dod-hint">Leave it empty to use “{round.nameOptions[0]}”.</p>}
  </div>;
}

/** After locking: the product is set, the name can still change, and the phone waits for everyone else. */
export function BuildLocked({ room, round, send }: { room: DealSnapshot; round: RoundState; send: Send }) {
  const lockSeconds = useClockSeconds(room);
  const locked = room.upcoming.filter((item) => item.lockedAt).length;
  return <section className="dod-screen dod-builder"><div className="dod-screen-main">
    <div className="dod-headline-preview"><small>Locked in 🔒 · you pitch in round {round.index + 1}</small><b>{round.premise?.headline}</b></div>
    <NameChoice round={round} send={send}/>
    <p className="dod-hint">On your turn you get pitch time to sell it, then the sharks ask questions. Think of a killer line!</p>
  </div>
    <div className="dod-screen-action"><p className="dod-hint">{locked}/{room.players.length} locked in · round 1 starts when everyone is ready, or in {lockSeconds}s</p></div>
  </section>;
}

/**
 * Three quick steps in reading order: a twist, a product, and who it's for. Each step deals six cards (🔀 deals new
 * ones) and has "✏️ Write your own". The twist and product cards only ever deal ones that fit each other.
 */
export function Builder({ room, round, send }: { room: DealSnapshot; round: RoundState; send: Send }) {
  const picks = round.builder;
  const [step, setStep] = useState<Step>(() => firstOpenStep(picks));
  const [writing, setWriting] = useState(false);
  const lockSeconds = useClockSeconds(room);
  const at = STEPS.findIndex((item) => item.id === step);
  const current = STEPS[at];
  const next = () => { setWriting(false); setStep(STEPS[at + 1]?.id ?? 'name'); };
  const choose = (column: BuilderColumn, id: string) => {
    void send('player:builder-pick', { column, id });
    next();
  };

  return <section className="dod-screen dod-builder"><div className="dod-screen-main">
    <ol className="dod-build-steps" aria-label="Your three picks">
      {STEPS.map((item, index) => {
        const written = picks.custom?.[item.id];
        const chosen = written ? { emoji: CUSTOM_EMOJI, text: written } : card(item.id, picked(picks, item.id));
        return <li key={item.id}><button className={`${step === item.id ? 'is-on' : ''} ${chosen ? 'is-done' : ''}`} aria-current={step === item.id ? 'step' : undefined} onClick={() => { setWriting(false); setStep(item.id); }}>
          <small>{index + 1}. {item.label}</small><span>{chosen ? <><Emoji char={chosen.emoji}/> {chosen.text}</> : '—'}</span>
        </button></li>;
      })}
    </ol>
    <div className="dod-headline-preview"><small>Your business</small><HeadlineSlots picks={picks} step={step}/></div>
    {current ? <>
      <h2 className="dod-step-title">{current.title}</h2>
      <p className="dod-hint dod-step-where">{current.where}</p>
      {writing ? <WriteOwn step={current} picks={picks} send={send} onDone={(saved) => { if (saved) next(); else setWriting(false); }}/> : <>
        <div className="dod-hand" role="group" aria-label={current.title}>
          {picks.hands[current.id].map((id) => {
            const item = card(current.id, id);
            if (!item) return null;
            const on = !picks.custom?.[current.id] && picked(picks, current.id) === id;
            return <button key={id} className={`dod-pick-card ${on ? 'is-on' : ''}`} aria-pressed={on} onClick={() => choose(current.id, id)}>
              <span className="dod-pick-emoji" aria-hidden="true"><Emoji char={item.emoji}/></span><b>{item.text}</b>
            </button>;
          })}
        </div>
        <div className="dod-row dod-hand-tools">
          {at > 0 ? <button className="dod-ghost" onClick={() => setStep(STEPS[at - 1].id)}>← Back</button> : <span/>}
          <button className="dod-ghost" onClick={() => void send('player:builder-reroll', { column: current.id })}>🔀 New cards</button>
          <button className={`dod-ghost ${picks.custom?.[current.id] ? 'is-on' : ''}`} onClick={() => setWriting(true)}>✏️ {picks.custom?.[current.id] ? 'Edit mine' : 'Write your own'}</button>
          {stepText(picks, current.id) && <button className="dod-ghost" onClick={next}>Next →</button>}
        </div>
      </>}
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
