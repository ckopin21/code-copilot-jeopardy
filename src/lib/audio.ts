type MusicState = 'lobby' | 'board' | 'thinking' | 'daily-double' | 'double' | 'triple' | 'final' | 'winner';
type Cue = 'open' | 'buzz' | 'locked' | 'correct' | 'wrong' | 'daily-double' | 'fire' | 'cold' | 'phase';

const KEY = 'blue-stage-audio';
interface AudioSettings { master: number; music: number; effects: number; muted: boolean }

const NOTE: Record<string, number> = {
  C3: 130.81, D3: 146.83, E3: 164.81, F3: 174.61, G3: 196.0, A3: 220.0, B3: 246.94,
  C4: 261.63, D4: 293.66, E4: 329.63, F4: 349.23, G4: 392.0, A4: 440.0, B4: 493.88,
  C5: 523.25, D5: 587.33, E5: 659.25, F5: 698.46, G5: 783.99, A5: 880.0
};

const THEMES: Record<MusicState, { bpm: number; melody: string[]; bass: string[]; wave: OscillatorType }> = {
  lobby: { bpm: 96, melody: ['C4','E4','G4','E4','F4','A4','C5','A4','A4','C5','E5','C5','G4','B4','D5','B4'], bass: ['C3','F3','A3','G3'], wave: 'triangle' },
  board: { bpm: 104, melody: ['E4','G4','C5','G4','F4','A4','C5','A4','D4','G4','B4','G4','E4','G4','B4','G4'], bass: ['C3','F3','G3','E3'], wave: 'triangle' },
  thinking: { bpm: 84, melody: ['A4','E4','C5','E4','F4','C5','A4','C5','G4','D5','B4','D5','E4','B4','G4','B4'], bass: ['A3','F3','G3','E3'], wave: 'sine' },
  'daily-double': { bpm: 112, melody: ['C5','G4','E5','G4','D5','A4','F5','A4','E5','B4','G5','B4','D5','G4','C5','G4'], bass: ['C3','D3','E3','G3'], wave: 'triangle' },
  double: { bpm: 112, melody: ['A4','C5','E5','C5','G4','B4','D5','B4','F4','A4','C5','A4','E4','G4','B4','G4'], bass: ['A3','G3','F3','E3'], wave: 'triangle' },
  triple: { bpm: 120, melody: ['C5','E5','G5','E5','A4','C5','E5','C5','G4','B4','D5','B4','F4','A4','C5','A4'], bass: ['C3','A3','G3','F3'], wave: 'triangle' },
  final: { bpm: 76, melody: ['A4','E4','C5','E4','F4','C5','A4','C5','G4','D5','B4','D5','E4','B4','G4','B4'], bass: ['A3','F3','G3','E3'], wave: 'sine' },
  winner: { bpm: 108, melody: ['C5','E5','G5','E5','F5','A5','G5','E5','D5','F5','A5','F5','C5','E5','G5','C5'], bass: ['C3','F3','D3','G3'], wave: 'triangle' }
};

class AudioEngine {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private music: GainNode | null = null;
  private effects: GainNode | null = null;
  private musicState: MusicState | null = null;
  private musicTimer: number | null = null;
  private transitionTimer: number | null = null;
  private generation = 0;
  private musicNodes = new Set<OscillatorNode>();
  settings: AudioSettings = { master: 0.72, music: 0.22, effects: 0.74, muted: false };

  constructor() {
    try {
      const saved = localStorage.getItem(KEY);
      if (saved) this.settings = { ...this.settings, ...JSON.parse(saved) };
    } catch { /* optional preference storage */ }
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
    this.master.gain.cancelScheduledValues(now);
    this.music.gain.cancelScheduledValues(now);
    this.effects.gain.cancelScheduledValues(now);
    this.master.gain.setTargetAtTime(this.settings.muted ? 0 : this.settings.master, now, 0.025);
    this.music.gain.setTargetAtTime(this.settings.music, now, 0.05);
    this.effects.gain.setTargetAtTime(this.settings.effects, now, 0.025);
  }

  private tone(frequency: number, at: number, duration: number, volume: number, type: OscillatorType, destination: AudioNode, trackMusic = false): void {
    if (!this.context) return;
    const osc = this.context.createOscillator();
    const gain = this.context.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(frequency, at);
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, volume), at + Math.min(0.025, duration * 0.18));
    gain.gain.exponentialRampToValueAtTime(0.0001, at + duration);
    osc.connect(gain);
    gain.connect(destination);
    if (trackMusic) {
      this.musicNodes.add(osc);
      osc.addEventListener('ended', () => this.musicNodes.delete(osc), { once: true });
    }
    osc.start(at);
    osc.stop(at + duration + 0.035);
  }

  cue(name: Cue): void {
    if (!this.context || !this.effects || this.settings.muted) return;
    const patterns: Record<Cue, [number, number, number][]> = {
      open: [[523, 0, .08], [659, .08, .1]],
      buzz: [[784, 0, .07], [1047, .055, .13]],
      locked: [[196, 0, .14]],
      correct: [[523, 0, .07], [659, .065, .08], [784, .13, .18]],
      wrong: [[233, 0, .12], [185, .1, .2]],
      'daily-double': [[392, 0, .1], [523, .09, .1], [784, .18, .24]],
      fire: [[440, 0, .07], [659, .05, .08], [880, .11, .16]],
      cold: [[330, 0, .12], [247, .1, .2]],
      phase: [[330, 0, .06], [494, .06, .08]]
    };
    const start = this.context.currentTime;
    for (const [frequency, offset, duration] of patterns[name]) {
      this.tone(frequency, start + offset, duration, 0.15, name === 'wrong' || name === 'locked' ? 'sawtooth' : 'sine', this.effects);
    }
  }

  private stopScheduledMusic(): void {
    if (!this.context || !this.music) return;
    this.generation += 1;
    if (this.musicTimer !== null) window.clearTimeout(this.musicTimer);
    if (this.transitionTimer !== null) window.clearTimeout(this.transitionTimer);
    this.musicTimer = null;
    this.transitionTimer = null;
    const now = this.context.currentTime;
    this.music.gain.cancelScheduledValues(now);
    this.music.gain.setValueAtTime(Math.max(0.0001, this.music.gain.value), now);
    this.music.gain.exponentialRampToValueAtTime(0.0001, now + 0.045);
    for (const node of this.musicNodes) {
      try { node.stop(now + 0.05); } catch { /* already stopped */ }
    }
    this.musicNodes.clear();
  }

  private scheduleTheme(state: MusicState, generation: number): void {
    if (!this.context || !this.music || generation !== this.generation) return;
    const theme = THEMES[state];
    const eighth = 60 / theme.bpm / 2;
    const start = this.context.currentTime + 0.07;

    theme.melody.forEach((note, index) => {
      const at = start + index * eighth;
      const strongBeat = index % 4 === 0;
      this.tone(NOTE[note], at, eighth * 0.78, strongBeat ? 0.042 : 0.032, theme.wave, this.music!, true);
    });

    theme.bass.forEach((note, index) => {
      const at = start + index * eighth * 4;
      this.tone(NOTE[note], at, eighth * 3.2, 0.025, 'sine', this.music!, true);
    });

    const cycleMs = Math.round(eighth * theme.melody.length * 1000);
    this.musicTimer = window.setTimeout(() => this.scheduleTheme(state, generation), Math.max(650, cycleMs - 40));
  }

  async setMusic(state: MusicState): Promise<void> {
    if (this.musicState === state && this.musicTimer !== null) return;
    await this.unlock();
    this.stopScheduledMusic();
    this.musicState = state;
    if (!this.context || !this.music) return;
    const generation = this.generation;
    this.transitionTimer = window.setTimeout(() => {
      if (!this.context || !this.music || generation !== this.generation) return;
      const now = this.context.currentTime;
      this.music.gain.cancelScheduledValues(now);
      this.music.gain.setValueAtTime(0.0001, now);
      this.music.gain.exponentialRampToValueAtTime(Math.max(0.0002, this.settings.music), now + 0.09);
      this.scheduleTheme(state, generation);
      this.transitionTimer = null;
    }, 60);
  }

  stop(): void {
    this.musicState = null;
    this.stopScheduledMusic();
  }
}

export const audio = new AudioEngine();
