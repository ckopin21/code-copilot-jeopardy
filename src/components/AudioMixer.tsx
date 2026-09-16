import { useState } from 'react';
import { audio } from '../lib/audio';

export function AudioMixer() {
  const [settings, setSettings] = useState(audio.settings);
  const update = (key: 'master' | 'music' | 'effects', value: number) => { const next = { ...settings, [key]: value }; setSettings(next); audio.setSettings(next); };
  const mute = () => { const next = { ...settings, muted: !settings.muted }; setSettings(next); audio.setSettings(next); };
  return <details className="audio-mixer"><summary>Audio</summary>{(['master', 'music', 'effects'] as const).map((key) => <label key={key}>{key}<input type="range" min="0" max="1" step="0.05" value={settings[key]} onChange={(event) => update(key, Number(event.target.value))} /></label>)}<button type="button" className="small-button" onClick={mute}>{settings.muted ? 'Unmute' : 'Mute'}</button></details>;
}
