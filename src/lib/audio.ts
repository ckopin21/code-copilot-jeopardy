type MusicState = 'lobby' | 'board' | 'thinking' | 'daily-double' | 'double' | 'triple' | 'final' | 'winner';
type Cue = 'open' | 'buzz' | 'locked' | 'correct' | 'wrong' | 'daily-double' | 'fire' | 'cold' | 'phase';

const KEY = 'blue-stage-audio';
interface AudioSettings { master: number; music: number; effects: number; muted: boolean }

class AudioEngine {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private music: GainNode | null = null;
  private effects: GainNode | null = null;
  private ambient: OscillatorNode[] = [];
  settings: AudioSettings = { master: 0.7, music: 0.32, effects: 0.75, muted: false };
  private musicState: MusicState | null = null;

  constructor() {
    try {
      const saved = localStorage.getItem(KEY);
      if (saved) this.settings = { ...this.settings, ...JSON.parse(saved) };
    } catch { /* preferences are optional */ }
  }

  async unlock(): Promise<void> {
    if (!this.context) {
      this.context = new AudioContext();
      this.master = this.context.createGain();
      this.music = this.context.createGain();
      this.effects = this.context.createGain();
      this.music.connect(this.master);
      this.effects.connect(this.master);
      this.master.connect(this.context.destination);
      this.apply();
    }
    if (this.context.state === 'suspended') await this.context.resume();
  }

  setSettings(next: Partial<AudioSettings>): void {
    this.settings = { ...this.settings, ...next };
    localStorage.setItem(KEY, JSON.stringify(this.settings));
    this.apply();
  }

  private apply(): void {
    if (!this.context || !this.master || !this.music || !this.effects) return;
    const now = this.context.currentTime;
    this.master.gain.setTargetAtTime(this.settings.muted ? 0 : this.settings.master, now, 0.03);
    this.music.gain.setTargetAtTime(this.settings.music, now, 0.08);
    this.effects.gain.setTargetAtTime(this.settings.effects, now, 0.03);
  }

  cue(name: Cue): void {
    if (!this.context || !this.effects || this.settings.muted) return;
    const patterns: Record<Cue, [number, number, number][]> = {
      open: [[520, 0, .08], [660, .08, .11]], buzz: [[880, 0, .08], [1180, .06, .12]], locked: [[180, 0, .12]],
      correct: [[520, 0, .08], [660, .07, .08], [820, .14, .18]], wrong: [[260, 0, .11], [190, .09, .2]],
      'daily-double': [[330, 0, .12], [500, .1, .12], [760, .2, .28]], fire: [[440, 0, .08], [660, .05, .08], [990, .1, .2]],
      cold: [[380, 0, .12], [290, .1, .25]], phase: [[300, 0, .08], [600, .06, .1], [900, .12, .18]]
    };
    const start = this.context.currentTime;
    for (const [frequency, offset, duration] of patterns[name]) {
      const osc = this.context.createOscillator();
      const gain = this.context.createGain();
      osc.type = name === 'wrong' || name === 'locked' ? 'sawtooth' : 'sine';
      osc.frequency.value = frequency;
      gain.gain.setValueAtTime(0.0001, start + offset);
      gain.gain.exponentialRampToValueAtTime(0.18, start + offset + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + offset + duration);
      osc.connect(gain); gain.connect(this.effects);
      osc.start(start + offset); osc.stop(start + offset + duration + .02);
    }
  }

  async setMusic(state: MusicState): Promise<void> {
    if (this.musicState === state) return;
    this.musicState = state;
    await this.unlock();
    if (!this.context || !this.music) return;
    const now = this.context.currentTime;
    for (const osc of this.ambient) { try { osc.stop(now + .35); } catch { /* already stopped */ } }
    this.ambient = [];
    const root: Record<MusicState, number> = { lobby: 110, board: 123.47, thinking: 98, 'daily-double': 146.83, double: 138.59, triple: 155.56, final: 92.5, winner: 164.81 };
    const ratios = state === 'final' ? [1, 1.5] : state === 'triple' ? [1, 1.25, 1.5] : [1, 1.5, 2];
    ratios.forEach((ratio, index) => {
      const osc = this.context!.createOscillator();
      const gain = this.context!.createGain();
      osc.type = index === 0 ? 'sine' : 'triangle';
      osc.frequency.value = root[state] * ratio;
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(index === 0 ? 0.055 : 0.025, now + .5);
      osc.connect(gain); gain.connect(this.music!); osc.start();
      this.ambient.push(osc);
    });
  }
}

export const audio = new AudioEngine();
