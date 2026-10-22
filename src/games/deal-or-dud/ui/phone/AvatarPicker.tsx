import { useState } from 'react';
import type { PlayerLook, Tone } from '../../types';
import { AVATAR_PRESETS } from '../../content/cues';
import { tonePool } from '../../content/dealer';
import { Avatar } from '../Avatar';
import { CameraButton, PhotoCapture } from './PhotoCapture';

/** Funny presets that work instantly, plus an optional selfie. The last choice is remembered on this phone. */
export function AvatarPicker({ tone, value, onChange }: { tone: Tone; value: PlayerLook | null; onChange: (look: PlayerLook) => void }) {
  const [camera, setCamera] = useState<File | null>(null);
  const presets = tonePool(AVATAR_PRESETS, tone);
  if (camera) return <PhotoCapture file={camera} onUse={(photo) => { setCamera(null); onChange({ kind: 'photo', photo }); }} onCancel={() => setCamera(null)}/>;
  return <div className="dod-picker">
    <CameraButton className={`dod-photo-button ${value?.kind === 'photo' ? 'is-on' : ''}`} onFile={(file) => { if (file) setCamera(file); }}>
      {value?.kind === 'photo' ? <Avatar look={value} size={56}/> : <span className="dod-cam">📷</span>}
      <span>{value?.kind === 'photo' ? 'Retake photo' : 'Take a photo'}</span>
    </CameraButton>
    <div className="dod-preset-grid" role="listbox" aria-label="Characters">
      {presets.map((preset) => {
        const selected = value?.kind === 'preset' && value.presetId === preset.id;
        return <button key={preset.id} role="option" aria-selected={selected} aria-label={preset.label} className={selected ? 'is-on' : ''} onClick={() => onChange({ kind: 'preset', presetId: preset.id })}>
          <Avatar look={{ kind: 'preset', presetId: preset.id }} size={46}/>
        </button>;
      })}
    </div>
    {/* Names only for the pick, so the whole grid fits on a phone without scrolling. */}
    <p className="dod-picked">{value?.kind === 'preset' ? presets.find((preset) => preset.id === value.presetId)?.label ?? '' : value?.kind === 'photo' ? 'Your photo' : 'Tap a character'}</p>
  </div>;
}

const LOOK_KEY = 'blue-stage-deal-or-dud-last-look';
export function rememberLook(look: PlayerLook, name: string): void {
  try { localStorage.setItem(LOOK_KEY, JSON.stringify({ look, name })); } catch { /* optional */ }
}
export function recallLook(): { look: PlayerLook | null; name: string } {
  try {
    const saved = JSON.parse(localStorage.getItem(LOOK_KEY) ?? 'null') as { look?: PlayerLook; name?: string } | null;
    return { look: saved?.look ?? null, name: saved?.name ?? '' };
  } catch { return { look: null, name: '' }; }
}
