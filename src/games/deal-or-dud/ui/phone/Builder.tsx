import { useState, type ReactNode } from 'react';
import type { BuilderColumn, BuilderPicks, DealSnapshot, RoundState } from '../../types';
import { COLUMNS, CUSTOM_EMOJI, CUSTOM_MAX, audienceById, connectorText, featureById, modifierById, pickedId, productById, stepDone, stepText } from '../../content/dealer';
import { CONNECTORS } from '../../content/words';
import { useClockSeconds } from '../net';
import { Emoji } from '../Emoji';

type Send = (event: string, payload?: Record<string, unknown>) => Promise<boolean>;
type Step = BuilderColumn | 'done';

type StepInfo = { id: BuilderColumn; label: string; title: string; where: string; placeholder: string; example: string; skip?: string };
/** Every step in reading order, so each pick lands left to right: "[twist] [product] for [who], [feature]". */
const ALL_STEPS: StepInfo[] = [
  { id: 'modifiers', label: 'Twist', title: 'Pick a twist', where: 'Optional: the word in front', placeholder: '[twist]', example: 'haunted', skip: 'No twist' },
  { id: 'products', label: 'Product', title: 'Pick a product', where: 'The thing you sell (the only must-have)', placeholder: '[product]', example: 'hot tubs' },
  { id: 'audiences', label: 'Who', title: 'Who is it for?', where: 'Optional: pick the word, then the who', placeholder: '[who]', example: 'bored astronauts', skip: 'No who' },
  { id: 'features', label: 'Feature', title: 'Add a feature', where: 'Optional: the killer selling point', placeholder: '[feature]', example: 'with a built-in bidet', skip: 'No feature' }
];

/**
 * The business as a sentence with a slot for each pick, in reading order: "[twist] [product] for [who], [feature]". Empty
 * slots show what goes there, the slot being picked is highlighted, and skipped steps drop out.
 */
function HeadlineSlots({ picks, step, steps }: { picks: BuilderPicks; step: Step; steps: StepInfo[] }) {
  const shown = (id: BuilderColumn) => steps.some((item) => item.id === id) && !(id !== 'products' && picks.skipped?.[id]);
  const slot = (item: StepInfo) => {
    const text = stepText(picks, item.id);
    return <span key={item.id} className={`dod-slot ${step === item.id ? 'is-active' : ''} ${text ? 'is-filled' : ''}`}>{text ?? item.placeholder}</span>;
  };
  const parts: ReactNode[] = [];
  for (const item of steps) {
    if (!shown(item.id)) continue;
    if (item.id === 'audiences') parts.push(` ${connectorText(picks.connector)} `);
    else if (item.id === 'features') parts.push(shown('audiences') ? ', ' : ' ');
    else if (parts.length) parts.push(' ');
    parts.push(slot(item));
  }
  return <b className="dod-slots">{parts}</b>;
}

function card(column: BuilderColumn, id: string | null): { emoji: string; text: string } | null {
  const item = column === 'products' ? productById(id) : column === 'modifiers' ? modifierById(id) : column === 'features' ? featureById(id) : audienceById(id);
  return item ? { emoji: item.emoji, text: item.text } : null;
}
/** Where a phone that just (re)opened the builder should be: the first step not done yet. */
function firstOpenStep(picks: BuilderPicks, steps: StepInfo[]): Step {
  return steps.find((step) => !stepDone(picks, step.id))?.id ?? 'done';
}

/** "✏️ Write your own" for a step: a small form in place of the cards. */
function WriteOwn({ step, picks, send, onDone }: { step: StepInfo; picks: BuilderPicks; send: Send; onDone: (saved: boolean) => void }) {
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

/** After locking: the product is set and the phone waits for everyone else. */
export function BuildLocked({ room, round }: { room: DealSnapshot; round: RoundState }) {
  const lockSeconds = useClockSeconds(room);
  const locked = room.upcoming.filter((item) => item.lockedAt).length;
  return <section className="dod-screen dod-builder"><div className="dod-screen-main">
    <div className="dod-headline-preview"><small>Locked in 🔒 · you pitch in round {round.index + 1}</small><b>{round.premise?.headline}</b></div>
    <p className="dod-hint">On your turn you get pitch time to sell it, then the sharks ask questions. Think of a killer line!</p>
  </div>
    <div className="dod-screen-action"><p className="dod-hint">{locked}/{room.players.length} locked in · round 1 starts when everyone is ready, or in {lockSeconds}s</p></div>
  </section>;
}

/**
 * Quick steps in reading order: a twist, a product, who it's for and a feature (the host can switch off all but the
 * product). Each step deals six cards (🔀 deals new ones), has "✏️ Write your own", and all but the product can be
 * skipped. The who step also picks the word in front of it ("for", "made by", "tested on"…). The twist and product
 * cards only ever deal ones that fit each other.
 */
export function Builder({ room, round, send }: { room: DealSnapshot; round: RoundState; send: Send }) {
  const picks = round.builder;
  const STEPS = ALL_STEPS.filter((item) => COLUMNS.includes(item.id));
  const [step, setStep] = useState<Step>(() => firstOpenStep(picks, STEPS));
  const [writing, setWriting] = useState(false);
  const lockSeconds = useClockSeconds(room);
  const at = STEPS.findIndex((item) => item.id === step);
  const current = STEPS[at];
  const next = () => { setWriting(false); setStep(STEPS[at + 1]?.id ?? 'done'); };
  const choose = (column: BuilderColumn, id: string) => {
    void send('player:builder-pick', { column, id });
    next();
  };
  const skip = (column: BuilderColumn) => {
    void send('player:builder-skip', { column });
    next();
  };
  const skipped = (column: BuilderColumn) => column !== 'products' && Boolean(picks.skipped?.[column]);
  const connector = connectorText(picks.connector);

  return <section className="dod-screen dod-builder"><div className="dod-screen-main">
    <ol className="dod-build-steps" aria-label="Your picks" style={{ gridTemplateColumns: `repeat(${STEPS.length}, 1fr)` }}>
      {STEPS.map((item, index) => {
        const written = picks.custom?.[item.id];
        const chosen = written ? { emoji: CUSTOM_EMOJI, text: written } : card(item.id, pickedId(picks, item.id));
        return <li key={item.id}><button className={`${step === item.id ? 'is-on' : ''} ${chosen || skipped(item.id) ? 'is-done' : ''}`} aria-current={step === item.id ? 'step' : undefined} onClick={() => { setWriting(false); setStep(item.id); }}>
          <small>{index + 1}. {item.label}</small><span>{skipped(item.id) ? 'Skipped' : chosen ? <><Emoji char={chosen.emoji}/> {chosen.text}</> : '—'}</span>
        </button></li>;
      })}
    </ol>
    <div className="dod-headline-preview"><small>Your business</small><HeadlineSlots picks={picks} step={step} steps={STEPS}/></div>
    {current ? <>
      <h2 className="dod-step-title">{current.id === 'audiences' ? `Who is it ${connector}?` : current.title}</h2>
      <p className="dod-hint dod-step-where">{current.where}</p>
      {current.id === 'audiences' && <div className="dod-connectors" role="group" aria-label="The word before the who">
        {CONNECTORS.map((item) => {
          const on = connector === item.text;
          return <button key={item.id} className={on ? 'is-on' : ''} aria-pressed={on} onClick={() => void send('player:builder-connector', { connector: item.id })}>{item.text}</button>;
        })}
      </div>}
      {writing ? <WriteOwn step={current} picks={picks} send={send} onDone={(saved) => { if (saved) next(); else setWriting(false); }}/> : <>
        <div className="dod-hand" role="group" aria-label={current.title}>
          {(picks.hands[current.id] ?? []).map((id) => {
            const item = card(current.id, id);
            if (!item) return null;
            const on = !picks.custom?.[current.id] && pickedId(picks, current.id) === id;
            return <button key={id} className={`dod-pick-card ${on ? 'is-on' : ''}`} aria-pressed={on} onClick={() => choose(current.id, id)}>
              <span className="dod-pick-emoji" aria-hidden="true"><Emoji char={item.emoji}/></span><b>{item.text}</b>
            </button>;
          })}
          {current.skip && <button className={`dod-skip-card ${skipped(current.id) ? 'is-on' : ''}`} aria-pressed={skipped(current.id)} onClick={() => skip(current.id)}>🚫 {current.skip}</button>}
        </div>
        <div className="dod-row dod-hand-tools">
          {at > 0 ? <button className="dod-ghost" onClick={() => setStep(STEPS[at - 1].id)}>← Back</button> : <span/>}
          <button className="dod-ghost" onClick={() => void send('player:builder-reroll', { column: current.id })}>🔀 New cards</button>
          {current.id !== 'products' && <button className={`dod-ghost ${picks.custom?.[current.id] ? 'is-on' : ''}`} onClick={() => setWriting(true)}>✏️ {picks.custom?.[current.id] ? 'Edit mine' : 'Write your own'}</button>}
          {stepDone(picks, current.id) && <button className="dod-ghost" onClick={next}>Next →</button>}
        </div>
      </>}
    </> : <>
      <h2 className="dod-step-title">Ready to pitch it?</h2>
      <p className="dod-hint">Tap a pick above to change it, or lock it in.</p>
    </>}
  </div>
    <div className="dod-screen-action">
      {step === 'done'
        ? <button className="dod-primary big" onClick={() => void send('player:builder-lock')}>Lock it in · auto in {lockSeconds}s</button>
        : <p className="dod-hint">Auto-locks in {lockSeconds}s (empty picks get a random card)</p>}
    </div>
  </section>;
}
