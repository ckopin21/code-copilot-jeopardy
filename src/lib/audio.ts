type MusicState = 'lobby' | 'board' | 'thinking' | 'daily-double' | 'double' | 'triple' | 'final' | 'winner';
export type Cue = 'click' | 'open' | 'buzz' | 'locked' | 'correct' | 'wrong' | 'daily-double' | 'fire' | 'cold' | 'phase' | 'reveal' | 'category' | 'round' | 'score' | 'winner' | 'diagnostic';

export const BACKGROUND_TRACKS = [
  { id: 'dynamic', label: 'Dynamic Game Theme', file: null },
  { id: 'kulakovka', label: 'Upbeat Music · Kulakovka', file: 'music/kulakovka-upbeat-music-281095.mp3' },
  { id: 'tatamusic', label: 'Upbeat Music · Tatamusic', file: 'music/tatamusic-upbeat-upbeat-music-377668.mp3' },
  { id: 'mountain', label: 'Upbeat Music · The Mountain', file: 'music/the_mountain-upbeat-upbeat-music-567445.mp3' },
  { id: 'sonican', label: 'Tech Quiz News Loop · Sonican', file: 'music/sonican-tech-quiz-news-loop-274362.mp3' }
] as const;
export type BackgroundTrackId = typeof BACKGROUND_TRACKS[number]['id'];

const KEY = 'blue-stage-audio';
interface AudioSettings { master: number; music: number; effects: number; muted: boolean; backgroundTrack: BackgroundTrackId }
interface ThemeNote { note: string; beats: number; rest?: boolean }
interface MusicTheme { bpm: number; melody: ThemeNote[]; bass: string[]; wave: OscillatorType }

const NOTE: Record<string, number> = {
  C3: 130.81, D3: 146.83, E3: 164.81, F3: 174.61, G3: 196.0, A3: 220.0, B3: 246.94,
  C4: 261.63, D4: 293.66, E4: 329.63, F4: 349.23, G4: 392.0, A4: 440.0, B4: 493.88,
  C5: 523.25, D5: 587.33, E5: 659.25, F5: 698.46, G5: 783.99, A5: 880.0
};

const q = (note: string, beats = 1): ThemeNote => ({ note, beats });
const r = (beats = 1): ThemeNote => ({ note: 'C4', beats, rest: true });

// Original quiz-show motifs. The phrasing intentionally uses held notes and rests instead of a constant eighth-note pulse.
const THEMES: Record<MusicState, MusicTheme> = {
  lobby: {
    bpm: 92,
    melody: [q('C4'),q('E4'),q('G4',2),q('E4'),q('G4'),q('C5',2),r(.5),q('B4',.5),q('A4'),q('G4',2),q('F4'),q('A4'),q('G4',2)],
    bass: ['C3','F3','G3','C3'], wave: 'triangle'
  },
  board: {
    bpm: 104,
    melody: [q('C4'),q('G4'),q('E4'),q('G4'),q('D4'),q('A4'),q('F4'),q('A4'),q('F4'),q('C5'),q('A4'),q('C5'),q('G4'),q('B4'),q('D5',2)],
    bass: ['C3','D3','F3','G3'], wave: 'triangle'
  },
  thinking: {
    bpm: 88,
    melody: [q('C4'),q('E4'),q('G4',1.5),r(.5),q('D4'),q('F4'),q('A4',1.5),r(.5),q('E4'),q('G4'),q('B4'),q('G4'),q('D4'),q('F4'),q('E4',2)],
    bass: ['C3','D3','E3','G3'], wave: 'sine'
  },
  'daily-double': {
    bpm: 108,
    melody: [q('C5',.5),q('E5',.5),q('G5',1.5),r(.5),q('D5',.5),q('F5',.5),q('A5',1.5),r(.5),q('G5'),q('E5'),q('C5',2)],
    bass: ['C3','D3','F3','G3'], wave: 'triangle'
  },
  double: {
    bpm: 110,
    melody: [q('A4'),q('C5'),q('E5',2),q('G4'),q('B4'),q('D5',2),q('F4'),q('A4'),q('C5'),q('A4'),q('G4'),q('B4'),q('A4',2)],
    bass: ['A3','G3','F3','E3'], wave: 'triangle'
  },
  triple: {
    bpm: 118,
    melody: [q('C5',.5),q('E5',.5),q('G5'),q('E5'),q('A4',.5),q('C5',.5),q('E5'),q('C5'),q('G4',.5),q('B4',.5),q('D5'),q('B4'),q('F4'),q('A4'),q('C5',2)],
    bass: ['C3','A3','G3','F3'], wave: 'triangle'
  },
  final: {
    bpm: 74,
    melody: [q('A4'),q('E4'),q('C5',2),q('F4'),q('C5'),q('A4',2),q('G4'),q('D5'),q('B4',2),q('E4'),q('B4'),q('G4',2)],
    bass: ['A3','F3','G3','E3'], wave: 'sine'
  },
  winner: {
    bpm: 106,
    melody: [q('C5'),q('E5'),q('G5',2),q('F5'),q('A5'),q('G5',2),q('D5'),q('F5'),q('A5'),q('F5'),q('E5'),q('G5'),q('C5',2)],
    bass: ['C3','F3','G3','C3'], wave: 'triangle'
  }
};

class AudioEngine {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private music: GainNode | null = null;
  private effects: GainNode | null = null;
  private musicState: MusicState | null = null;
  private musicTimer: number | null = null;
  private transitionTimer: number | null = null;
  private clickTimer: number | null = null;
  private generation = 0;
  private musicNodes = new Set<OscillatorNode>();
  private mediaTrack: HTMLAudioElement | null = null;
  private mediaTrackId: BackgroundTrackId | null = null;
  settings: AudioSettings = { master: 0.78, music: 0.26, effects: 0.78, muted: false, backgroundTrack: 'dynamic' };

  constructor() {
    try {
      const saved = localStorage.getItem(KEY);
      if (saved) this.settings = { ...this.settings, ...JSON.parse(saved) };
      if (!BACKGROUND_TRACKS.some((track) => track.id === this.settings.backgroundTrack)) this.settings.backgroundTrack = 'dynamic';
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
    try { localStorage.setItem(KEY, JSON.stringify(this.settings)); } catch { /* optional preference storage */ }
    this.apply();
    if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('blue-stage:audio-settings'));
  }

  async setBackgroundTrack(trackId: BackgroundTrackId): Promise<void> {
    const next = BACKGROUND_TRACKS.some((track) => track.id === trackId) ? trackId : 'dynamic';
    if (next === this.settings.backgroundTrack && (next === 'dynamic' || this.mediaTrackId === next)) return;
    this.stopMediaTrack();
    this.setSettings({ backgroundTrack: next });
    await this.setMusic(this.musicState ?? 'lobby');
  }

  private applyMediaVolume(): void {
    if (!this.mediaTrack) return;
    const volume = this.settings.muted ? 0 : this.settings.master * this.settings.music;
    this.mediaTrack.volume = Math.min(1, Math.max(0, volume));
  }

  private apply(): void {
    this.applyMediaVolume();
    if (!this.context || !this.master || !this.music || !this.effects) return;
    const now = this.context.currentTime;
    this.master.gain.cancelScheduledValues(now);
    this.music.gain.cancelScheduledValues(now);
    this.effects.gain.cancelScheduledValues(now);
    this.master.gain.setTargetAtTime(this.settings.muted ? 0 : this.settings.master, now, 0.025);
    this.music.gain.setTargetAtTime(this.settings.music, now, 0.05);
    this.effects.gain.setTargetAtTime(this.settings.effects, now, 0.025);
  }

  private selectedMediaTrack() {
    return BACKGROUND_TRACKS.find((track) => track.id === this.settings.backgroundTrack && track.file !== null) ?? null;
  }

  private async startSelectedMediaTrack(): Promise<void> {
    const selected = this.selectedMediaTrack();
    if (!selected || typeof document === 'undefined') return;
    if (!this.mediaTrack || this.mediaTrackId !== selected.id) {
      this.stopMediaTrack();
      const media = new Audio(new URL(selected.file!, document.baseURI).href);
      media.loop = true;
      media.preload = 'auto';
      this.mediaTrack = media;
      this.mediaTrackId = selected.id;
    }
    this.applyMediaVolume();
    try { await this.mediaTrack.play(); } catch { /* user interaction will retry playback on the next audio action */ }
  }

  private stopMediaTrack(): void {
    if (this.mediaTrack) {
      this.mediaTrack.pause();
      this.mediaTrack.currentTime = 0;
      this.mediaTrack.removeAttribute('src');
      this.mediaTrack.load();
    }
    this.mediaTrack = null;
    this.mediaTrackId = null;
  }

  private tone(frequency: number, at: number, duration: number, volume: number, type: OscillatorType, destination: AudioNode, trackMusic = false): void {
    if (!this.context) return;
    const osc = this.context.createOscillator();
    const gain = this.context.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(frequency, at);
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, volume), at + Math.min(0.03, duration * 0.18));
    gain.gain.exponentialRampToValueAtTime(0.0001, at + duration);
    osc.connect(gain);
    gain.connect(destination);
    if (trackMusic) {
      this.musicNodes.add(osc);
      osc.addEventListener('ended', () => this.musicNodes.delete(osc), { once: true });
    }
    osc.start(at);
    osc.stop(at + duration + 0.04);
  }

  cue(name: Cue): void {
    if (name === 'click') {
      if (this.clickTimer !== null) window.clearTimeout(this.clickTimer);
      this.clickTimer = window.setTimeout(() => {
        this.clickTimer = null;
        this.playCue('click');
      }, 55);
      return;
    }
    if (this.clickTimer !== null) {
      window.clearTimeout(this.clickTimer);
      this.clickTimer = null;
    }
    this.playCue(name);
  }

  private playCue(name: Cue): void {
    if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('blue-stage:audio-cue', { detail: name }));
    if (!this.context || !this.effects || this.settings.muted) return;
    const patterns: Record<Cue, [number, number, number][]> = {
      click: [[440, 0, .035], [660, .025, .045]],
      open: [[523, 0, .08], [659, .08, .1]],
      buzz: [[784, 0, .07], [1047, .055, .13]],
      locked: [[196, 0, .14]],
      correct: [[523, 0, .07], [659, .065, .08], [784, .13, .18]],
      wrong: [[233, 0, .12], [185, .1, .2]],
      'daily-double': [[392, 0, .1], [523, .09, .1], [784, .18, .24]],
      fire: [[440, 0, .07], [659, .05, .08], [880, .11, .16]],
      cold: [[330, 0, .12], [247, .1, .2]],
      phase: [[330, 0, .06], [494, .06, .08], [659, .13, .14]],
      reveal: [[523, 0, .06], [659, .055, .07], [784, .11, .09], [1047, .19, .18]],
      category: [[392, 0, .07], [523, .07, .08], [659, .14, .1], [784, .23, .18]],
      round: [[196, 0, .12], [392, .09, .12], [523, .2, .14], [784, .32, .24]],
      score: [[659, 0, .05], [880, .05, .12]],
      winner: [[523, 0, .08], [659, .07, .08], [784, .14, .1], [1047, .23, .28]],
      diagnostic: [[523, 0, .06], [784, .08, .12]]
    };
    const start = this.context.currentTime;
    for (const [frequency, offset, duration] of patterns[name]) {
      const volume = name === 'click' ? 0.12 : name === 'reveal' ? 0.28 : 0.24;
      this.tone(frequency, start + offset, duration, volume, name === 'wrong' || name === 'locked' ? 'sawtooth' : 'sine', this.effects);
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
    this.music.gain.exponentialRampToValueAtTime(0.0001, now + 0.05);
    for (const node of this.musicNodes) {
      try { node.stop(now + 0.055); } catch { /* already stopped */ }
    }
    this.musicNodes.clear();
  }

  private scheduleTheme(state: MusicState, generation: number): void {
    if (!this.context || !this.music || generation !== this.generation) return;
    const theme = THEMES[state];
    const beat = 60 / theme.bpm;
    const start = this.context.currentTime + 0.08;
    let cursor = 0;

    theme.melody.forEach((event, index) => {
      const at = start + cursor * beat;
      if (!event.rest && NOTE[event.note]) {
        const strongBeat = index % 4 === 0;
        this.tone(NOTE[event.note], at, beat * event.beats * 0.86, strongBeat ? 0.048 : 0.036, theme.wave, this.music!, true);
      }
      cursor += event.beats;
    });

    const phraseBeats = Math.max(cursor, 8);
    const bassSpan = phraseBeats / Math.max(1, theme.bass.length);
    theme.bass.forEach((note, index) => {
      const at = start + index * bassSpan * beat;
      this.tone(NOTE[note], at, beat * bassSpan * 0.82, 0.027, 'sine', this.music!, true);
    });

    const cycleMs = Math.round(phraseBeats * beat * 1000);
    this.musicTimer = window.setTimeout(() => this.scheduleTheme(state, generation), Math.max(800, cycleMs - 60));
  }

  async setMusic(state: MusicState): Promise<void> {
    await this.unlock();

    if (this.settings.backgroundTrack !== 'dynamic') {
      this.stopScheduledMusic();
      this.musicState = state;
      await this.startSelectedMediaTrack();
      return;
    }

    if (this.musicState === state && this.musicTimer !== null) return;
    this.stopMediaTrack();
    this.stopScheduledMusic();
    this.musicState = state;
    if (!this.context || !this.music) return;
    const generation = this.generation;
    this.transitionTimer = window.setTimeout(() => {
      if (!this.context || !this.music || generation !== this.generation) return;
      const now = this.context.currentTime;
      this.music.gain.cancelScheduledValues(now);
      this.music.gain.setValueAtTime(0.0001, now);
      this.music.gain.exponentialRampToValueAtTime(Math.max(0.0002, this.settings.music), now + 0.1);
      this.scheduleTheme(state, generation);
      this.transitionTimer = null;
    }, 65);
  }

  stop(): void {
    this.musicState = null;
    this.stopMediaTrack();
    this.stopScheduledMusic();
  }
}

export const audio = new AudioEngine();
