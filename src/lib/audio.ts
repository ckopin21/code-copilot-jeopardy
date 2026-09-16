type MusicState = 'lobby' | 'board' | 'thinking' | 'daily-double' | 'double' | 'triple' | 'final' | 'winner';
type Cue = 'open' | 'buzz' | 'locked' | 'correct' | 'wrong' | 'daily-double' | 'fire' | 'cold' | 'phase';

const KEY = 'blue-stage-audio';
interface AudioSettings { master: number; music: number; effects: number; muted: boolean }

const NOTES: Record<string, number> = {
  C3: 130.81, D3: 146.83, E3: 164.81, F3: 174.61, G3: 196, A3: 220, B3: 246.94,
  C4: 261.63, D4: 293.66, E4: 329.63, F4: 349.23, G4: 392, A4: 440, B4: 493.88,
  C5: 523.25, D5: 587.33, E5: 659.25, G5: 783.99
};

class AudioEngine {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private music: GainNode | null = null;
  private effects: GainNode | null = null;
  private musicState: MusicState | null = null;
  private musicTimer: number | null = null;
  private generation = 0;
  settings: AudioSettings = { master: 0.7, music: 0.34, effects: 0.75, muted: false };

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

  private tone(frequency: number, at: number, duration: number, volume: number, type: OscillatorType, destination: AudioNode): void {
    if (!this.context) return;
    const osc = this.context.createOscillator();
    const gain = this.context.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(frequency, at);
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(volume, at + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + duration);
    osc.connect(gain); gain.connect(destination);
    osc.start(at); osc.stop(at + duration + 0.03);
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
    for (const [frequency, offset, duration] of patterns[name]) this.tone(frequency, start + offset, duration, 0.18, name === 'wrong' || name === 'locked' ? 'sawtooth' : 'sine', this.effects);
  }

  private scheduleTheme(state: MusicState, generation: number): void {
    if (!this.context || !this.music || generation !== this.generation) return;
    const tempo = state === 'thinking' || state === 'final' ? 126 : state === 'triple' ? 156 : state === 'double' ? 148 : 140;
    const beat = 60 / tempo;
    const start = this.context.currentTime + 0.06;
    const melodies: Record<MusicState, string[]> = {
      lobby: ['C4','E4','G4','E4','D4','F4','A4','G4','E4','G4','C5','B4','A4','G4','E4','D4'],
      board: ['E4','G4','B4','G4','A4','C5','B4','G4','D4','F4','A4','F4','G4','B4','A4','E4'],
      thinking: ['C4','E4','G4','E4','D4','F4','A4','F4','E4','G4','B4','G4','D4','F4','G4','E4'],
      'daily-double': ['G4','C5','E5','D5','B4','G4','A4','C5','B4','G4','E4','G4','C5','B4','G4','E4'],
      double: ['A4','C5','E5','C5','B4','D5','E5','B4','G4','B4','D5','B4','A4','C5','B4','G4'],
      triple: ['C5','E5','G5','E5','D5','B4','C5','A4','B4','D5','E5','D5','C5','B4','G4','E4'],
      final: ['A3','E4','A4','E4','G4','D4','G4','D4','F4','C4','F4','C4','E4','B3','E4','B3'],
      winner: ['C4','E4','G4','C5','E5','G5','E5','C5','G4','B4','D5','G5','E5','D5','C5','G4']
    };
    const bass: Record<MusicState, string[]> = {
      lobby: ['C3','F3','A3','G3'], board: ['E3','A3','D3','G3'], thinking: ['C3','D3','E3','G3'], 'daily-double': ['C3','G3','A3','E3'],
      double: ['A3','G3','E3','D3'], triple: ['C3','A3','G3','E3'], final: ['A3','G3','F3','E3'], winner: ['C3','G3','A3','F3']
    };
    melodies[state].forEach((note, index) => {
      const at = start + index * beat * 0.5;
      this.tone(NOTES[note], at, beat * 0.42, state === 'thinking' ? 0.038 : 0.05, index % 4 === 0 ? 'square' : 'triangle', this.music!);
    });
    bass[state].forEach((note, index) => this.tone(NOTES[note], start + index * beat * 2, beat * 1.45, 0.035, 'sine', this.music!));
    const cycleMs = Math.round(beat * 8 * 1000);
    this.musicTimer = window.setTimeout(() => this.scheduleTheme(state, generation), Math.max(500, cycleMs - 80));
  }

  async setMusic(state: MusicState): Promise<void> {
    if (this.musicState === state && this.musicTimer !== null) return;
    this.musicState = state;
    await this.unlock();
    this.generation += 1;
    if (this.musicTimer !== null) window.clearTimeout(this.musicTimer);
    this.musicTimer = null;
    this.scheduleTheme(state, this.generation);
  }
}

export const audio = new AudioEngine();
