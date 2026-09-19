import { useState } from 'react';
import { audio } from '../lib/audio';
import {
  AVATAR_CATALOG,
  AVATAR_CATEGORIES,
  BUZZER_SOUNDS,
  FRAME_STYLES,
  PLAYER_ACCENTS,
  PLAYER_TITLES,
  SCORE_EFFECTS,
  VICTORY_EFFECTS,
  getPlayerTitleLabel,
  type PlayerBuzzerSound,
  type PlayerFrameStyle,
  type PlayerScoreEffect,
  type PlayerTitle,
  type PlayerVictoryEffect
} from '../shared/playerCustomization';
import { PlayerAvatar } from './PlayerAvatar';

type Props = {
  name: string;
  avatarId: string;
  accent: string;
  frameStyle: PlayerFrameStyle;
  title: PlayerTitle;
  buzzerSound: PlayerBuzzerSound;
  scoreEffect: PlayerScoreEffect;
  victoryEffect: PlayerVictoryEffect;
  onAvatarId: (value: string) => void;
  onAccent: (value: string) => void;
  onFrameStyle: (value: PlayerFrameStyle) => void;
  onTitle: (value: PlayerTitle) => void;
  onBuzzerSound: (value: PlayerBuzzerSound) => void;
  onScoreEffect: (value: PlayerScoreEffect) => void;
  onVictoryEffect: (value: PlayerVictoryEffect) => void;
};

type EffectPreview =
  | { kind: 'buzzer'; id: PlayerBuzzerSound; nonce: number }
  | { kind: 'score'; id: PlayerScoreEffect; nonce: number }
  | { kind: 'victory'; id: PlayerVictoryEffect; nonce: number }
  | null;

export function PlayerJoinCustomization(props: Props) {
  const [tab, setTab] = useState<'avatar' | 'style' | 'effects'>('avatar');
  const selected = AVATAR_CATALOG.find((avatar) => avatar.id === props.avatarId) ?? AVATAR_CATALOG[0];
  const [category, setCategory] = useState(selected.category);
  const [effectPreview, setEffectPreview] = useState<EffectPreview>(null);
  const titleLabel = getPlayerTitleLabel(props.title);

  const previewBuzzer = async (sound: PlayerBuzzerSound) => {
    props.onBuzzerSound(sound);
    setEffectPreview({ kind: 'buzzer', id: sound, nonce: Date.now() });
    try {
      await audio.unlock();
      audio.playerBuzz(sound);
    } catch {
      // The visual preview still explains the effect if the browser blocks audio.
    }
  };

  const previewScoreEffect = (effect: PlayerScoreEffect) => {
    props.onScoreEffect(effect);
    setEffectPreview({ kind: 'score', id: effect, nonce: Date.now() });
  };

  const previewVictoryEffect = (effect: PlayerVictoryEffect) => {
    props.onVictoryEffect(effect);
    setEffectPreview({ kind: 'victory', id: effect, nonce: Date.now() });
  };

  const previewClass = effectPreview ? ` preview-${effectPreview.kind}-${effectPreview.id}` : '';

  return <section className="player-customizer" style={{ '--accent': props.accent } as React.CSSProperties}>
    <div
      className={`customization-preview${previewClass}`}
      data-testid="player-customization-preview"
      data-score-effect={props.scoreEffect}
      data-victory-effect={props.victoryEffect}
      data-preview-kind={effectPreview?.kind}
      data-preview-id={effectPreview?.id}
    >
      <PlayerAvatar avatarId={props.avatarId} frameStyle={props.frameStyle} accent={props.accent} className="customization-preview-avatar" />
      <div className="customization-preview-copy">
        <small>PLAYER PREVIEW</small>
        <strong>{props.name.trim() || 'Your name'}</strong>
        <span>{titleLabel ?? 'No title'} · {FRAME_STYLES.find((item) => item.id === props.frameStyle)?.label}</span>
      </div>
      <i className="customization-accent-bar" aria-hidden="true" />

      {effectPreview && <div className="effect-preview-layer" key={effectPreview.nonce} aria-hidden="true">
        {effectPreview.kind === 'buzzer' && <span className="effect-preview-buzz">BUZZ!</span>}
        {effectPreview.kind === 'score' && <span className="effect-preview-score">+100</span>}
        {effectPreview.kind === 'victory' && effectPreview.id === 'confetti' && <span className="effect-preview-confetti">{Array.from({ length: 10 }, (_, index) => <i key={index} />)}</span>}
        {effectPreview.kind === 'victory' && effectPreview.id === 'spotlight' && <span className="effect-preview-spotlight" />}
        {effectPreview.kind === 'victory' && effectPreview.id === 'stars' && <span className="effect-preview-stars">✦ ✧ ✦</span>}
      </div>}
      <span className="sr-only" aria-live="polite">
        {effectPreview ? `Previewing ${effectPreview.id} ${effectPreview.kind} effect` : ''}
      </span>
    </div>

    <div className="customization-tabs" role="tablist" aria-label="Player customization">
      {([
        ['avatar', 'Avatar'],
        ['style', 'Style'],
        ['effects', 'Effects']
      ] as const).map(([id, label]) => <button key={id} type="button" role="tab" aria-selected={tab === id} className={tab === id ? 'selected' : ''} onClick={() => setTab(id)}>{label}</button>)}
    </div>

    {tab === 'avatar' && <div className="customization-panel" role="tabpanel">
      <div className="avatar-category-strip" aria-label="Avatar categories">
        {AVATAR_CATEGORIES.map((item) => <button type="button" key={item.id} aria-pressed={category === item.id} className={category === item.id ? 'selected' : ''} onClick={() => setCategory(item.id)}>{item.label}</button>)}
      </div>
      <div className="avatar-grid-v3">
        {AVATAR_CATALOG.filter((avatar) => avatar.category === category).map((avatar) => <button type="button" key={avatar.id} aria-label={avatar.label} aria-pressed={props.avatarId === avatar.id} className={props.avatarId === avatar.id ? 'selected' : ''} onClick={() => props.onAvatarId(avatar.id)}>
          <PlayerAvatar avatarId={avatar.id} frameStyle="clean" accent={props.accent} />
        </button>)}
      </div>
    </div>}

    {tab === 'style' && <div className="customization-panel customization-style-panel" role="tabpanel">
      <div className="customization-field">
        <span className="customization-label">Accent <small>Cards, buzz states and highlights</small></span>
        <div className="accent-grid-v3">{PLAYER_ACCENTS.map((item) => <button type="button" aria-label={item.label} title={item.label} aria-pressed={props.accent === item.color} className={props.accent === item.color ? 'selected' : ''} style={{ '--swatch': item.color } as React.CSSProperties} key={item.color} onClick={() => props.onAccent(item.color)} />)}</div>
      </div>
      <div className="customization-field">
        <span className="customization-label">Frame <small>Around your avatar</small></span>
        <div className="choice-row-v3">{FRAME_STYLES.map((item) => <button type="button" key={item.id} aria-pressed={props.frameStyle === item.id} className={props.frameStyle === item.id ? 'selected' : ''} onClick={() => props.onFrameStyle(item.id)}>{item.label}</button>)}</div>
      </div>
      <label className="customization-field customization-select">
        <span className="customization-label">Title <small>Shown with your name</small></span>
        <select value={props.title} onChange={(event) => props.onTitle(event.target.value as PlayerTitle)}>{PLAYER_TITLES.map((item) => <option value={item.id} key={item.id}>{item.label}</option>)}</select>
      </label>
    </div>}

    {tab === 'effects' && <div className="customization-panel customization-effects-panel" role="tabpanel">
      <div className="customization-field">
        <span className="customization-label">Buzzer <small>Tap any option to hear and see it</small></span>
        <div className="choice-row-v3">{BUZZER_SOUNDS.map((item) => <button type="button" key={item.id} aria-pressed={props.buzzerSound === item.id} className={props.buzzerSound === item.id ? 'selected' : ''} onClick={() => void previewBuzzer(item.id)}>{item.label}</button>)}</div>
      </div>
      <div className="customization-field">
        <span className="customization-label">Score effect <small>Tap to preview a +100 score change</small></span>
        <div className="choice-row-v3 three">{SCORE_EFFECTS.map((item) => <button type="button" key={item.id} aria-pressed={props.scoreEffect === item.id} className={props.scoreEffect === item.id ? 'selected' : ''} onClick={() => previewScoreEffect(item.id)}>{item.label}</button>)}</div>
      </div>
      <div className="customization-field">
        <span className="customization-label">Victory <small>Tap to preview your win celebration</small></span>
        <div className="choice-row-v3 three">{VICTORY_EFFECTS.map((item) => <button type="button" key={item.id} aria-pressed={props.victoryEffect === item.id} className={props.victoryEffect === item.id ? 'selected' : ''} onClick={() => previewVictoryEffect(item.id)}>{item.label}</button>)}</div>
      </div>
    </div>}
  </section>;
}
