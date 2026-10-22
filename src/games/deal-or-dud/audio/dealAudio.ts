// TV-only sound for Deal or Dud: music loops, stings, and recorded narration on separate volume buses.
// Phones never play music, so four phones cannot double the soundtrack.
import type { AudioSettings } from '../types';

export type MusicTrack = 'lobby' | 'bed' | 'offers' | 'celebrate' | null;
export type Sting = 'fanfare' | 'pitch' | 'good' | 'bad' | 'winner' | 'lock' | 'reveal-card' | 'tick' | 'drumroll';

const BASE = '/deal-or-dud/audio/';
/**
 * Music loops. MP3 smears the first and last milliseconds of a file, so each file carries half a second of wrapped
 * audio on both sides and plays between `loopStart` and `loopEnd` (seconds). A decoder that keeps or drops the
 * encoder's priming samples only shifts both points into identical audio, so the loop stays seamless in every browser.
 * Made by tools/deal-or-dud-music/integrate_pixabay.sh; the loop lengths below are its printed sample counts / 44100.
 */
interface MusicLoop { file: string; loopStart: number; loopEnd: number }
const LOOP_PAD = 0.5;
const loopOf = (file: string, samples: number): MusicLoop => ({ file, loopStart: LOOP_PAD, loopEnd: LOOP_PAD + samples / 44_100 });
const MUSIC_FILES: Record<Exclude<MusicTrack, null>, MusicLoop> = {
  lobby: loopOf('lobby-loop.mp3', 5_204_091),
  bed: loopOf('discussion-bed.mp3', 3_364_529),
  offers: loopOf('offer-pulse.mp3', 952_560),
  celebrate: loopOf('winner-loop.mp3', 1_991_613)
};
const STING_FILES: Record<Sting, string> = {
  fanfare: 'fanfare.mp3', pitch: 'pitch-intro.mp3', good: 'reveal-good.mp3', bad: 'reveal-bad.mp3',
  winner: 'winner.mp3', lock: 'lock.mp3', 'reveal-card': 'card.mp3', tick: 'tick.mp3', drumroll: 'drumroll.mp3'
};
/** Per-track level so the discussion bed sits under conversation and the offer pulse is only slightly more present. */
const MUSIC_LEVEL: Record<Exclude<MusicTrack, null>, number> = { lobby: 0.55, bed: 0.22, offers: 0.3, celebrate: 0.5 };
const DUCKED = 0.3;
/** The long musical stings play while the hosts talk ("Round two!", the welcome, the winner), so they dip under speech too. */
const DUCKED_STINGS: ReadonlySet<Sting> = new Set(['fanfare', 'pitch', 'winner']);
const STING_DUCKED = 0.5;
/** Stings that are music, not effects. A phase change fades out any still playing, so they never run under the next loop. */
const MUSICAL_STINGS: ReadonlySet<Sting> = new Set(['fanfare', 'pitch', 'winner', 'drumroll']);

class DealAudio {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private musicBus: GainNode | null = null;
  private duckBus: GainNode | null = null;
  private effectsBus: GainNode | null = null;
  private stingDuckBus: GainNode | null = null;
  private narrationBus: GainNode | null = null;
  private buffers = new Map<string, Promise<AudioBuffer | null>>();
  private currentTrack: MusicTrack = null;
  private currentSource: { source: AudioBufferSourceNode; gain: GainNode } | null = null;
  private narration: AudioBufferSourceNode | null = null;
  private playingStings = new Set<{ source: AudioBufferSourceNode; gain: GainNode }>();
  private settings: AudioSettings = { music: 55, effects: 75, narration: 90, muted: false };
  private listeners = new Set<() => void>();
  unlocked = false;

  /** Must run inside a click so browsers allow sound. Returns false if sound is unavailable. */
  async unlock(): Promise<boolean> {
    try {
      if (!this.context) {
        const Context = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!Context) return false;
        this.context = new Context();
        this.master = this.context.createGain();
        this.master.connect(this.context.destination);
        this.musicBus = this.context.createGain();
        this.duckBus = this.context.createGain();
        this.effectsBus = this.context.createGain();
        this.stingDuckBus = this.context.createGain();
        this.narrationBus = this.context.createGain();
        this.musicBus.connect(this.duckBus).connect(this.master);
        this.effectsBus.connect(this.master);
        this.stingDuckBus.connect(this.effectsBus);
        this.narrationBus.connect(this.master);
        this.applySettings(this.settings);
      }
      if (this.context.state === 'suspended') await this.context.resume();
      this.unlocked = this.context.state === 'running';
      this.emit();
      if (this.unlocked) for (const file of [...Object.values(MUSIC_FILES).map((loop) => loop.file), ...Object.values(STING_FILES)]) void this.load(file);
      return this.unlocked;
    } catch {
      return false;
    }
  }

  onChange(listener: () => void): () => void { this.listeners.add(listener); return () => this.listeners.delete(listener); }
  private emit(): void { this.listeners.forEach((listener) => listener()); }

  applySettings(settings: AudioSettings): void {
    this.settings = settings;
    if (!this.context || !this.master) return;
    const at = this.context.currentTime;
    const curve = (value: number) => Math.pow(Math.max(0, Math.min(100, value)) / 100, 1.6);
    this.master.gain.setTargetAtTime(settings.muted ? 0 : 1, at, 0.05);
    this.musicBus!.gain.setTargetAtTime(curve(settings.music), at, 0.2);
    this.effectsBus!.gain.setTargetAtTime(curve(settings.effects), at, 0.05);
    this.narrationBus!.gain.setTargetAtTime(curve(settings.narration), at, 0.05);
  }

  /** `file` is relative to the game's audio folder, or a server path starting with "/" (live narration). */
  private load(file: string): Promise<AudioBuffer | null> {
    let pending = this.buffers.get(file);
    if (!pending) {
      const live = file.startsWith('/');
      pending = fetch(live ? file : BASE + file)
        .then((response) => (response.ok ? response.arrayBuffer() : Promise.reject(new Error(file))))
        .then((data) => this.context!.decodeAudioData(data))
        .catch(() => {
          // A live line can fail while the narrator service starts up; let a later request try again.
          if (live) this.buffers.delete(file);
          return null;
        });
      this.buffers.set(file, pending);
    }
    return pending;
  }

  /** Fetches and decodes a clip ahead of time. Resolves null if sound is off or the clip cannot load. */
  preload(file: string): Promise<AudioBuffer | null> {
    return this.context ? this.load(file) : Promise.resolve(null);
  }

  /**
   * Switches loops: the old one fades out in well under a second and the new one comes in just after, so two songs
   * barely overlap.
   */
  async music(track: MusicTrack): Promise<void> {
    if (!this.context || track === this.currentTrack) return;
    this.currentTrack = track;
    const context = this.context;
    const old = this.currentSource;
    this.currentSource = null;
    if (old) {
      old.gain.gain.cancelScheduledValues(context.currentTime);
      old.gain.gain.setTargetAtTime(0, context.currentTime, 0.18);
      window.setTimeout(() => { try { old.source.stop(); } catch { /* already stopped */ } }, 1_000);
    }
    if (!track) return;
    const loop = MUSIC_FILES[track];
    const buffer = await this.load(loop.file);
    if (!buffer || this.currentTrack !== track) return;
    const source = context.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    source.loopStart = loop.loopStart;
    source.loopEnd = Math.min(loop.loopEnd, buffer.duration);
    const gain = context.createGain();
    // After another loop, wait for most of its fade-out before coming in.
    const at = context.currentTime + (old ? 0.35 : 0);
    gain.gain.value = 0;
    gain.gain.setValueAtTime(0, at);
    gain.gain.setTargetAtTime(MUSIC_LEVEL[track], at, 0.3);
    source.connect(gain).connect(this.musicBus!);
    source.start(at, loop.loopStart);
    this.currentSource = { source, gain };
  }

  /** Plays a one-shot. Resolves with its length in seconds once it starts, or 0 if it cannot play. */
  async sting(name: Sting, level = 1): Promise<number> {
    if (!this.context) return 0;
    const buffer = await this.load(STING_FILES[name]);
    if (!buffer) return 0;
    const source = this.context.createBufferSource();
    source.buffer = buffer;
    const gain = this.context.createGain();
    gain.gain.value = level;
    source.connect(gain).connect(DUCKED_STINGS.has(name) ? this.stingDuckBus! : this.effectsBus!);
    if (MUSICAL_STINGS.has(name)) {
      const playing = { source, gain };
      this.playingStings.add(playing);
      source.onended = () => { this.playingStings.delete(playing); };
    }
    source.start();
    return buffer.duration;
  }

  /** Fades out the musical stings still playing (the fanfare after a quick skip, the winner after Play again). */
  stopStings(): void {
    if (!this.context) return;
    const now = this.context.currentTime;
    for (const { source, gain } of this.playingStings) {
      gain.gain.setValueAtTime(gain.gain.value, now);
      gain.gain.linearRampToValueAtTime(0, now + 0.35);
      try { source.stop(now + 0.4); } catch { /* already stopped */ }
    }
    this.playingStings.clear();
  }

  /** Plays a narration file and ducks the music under it. Resolves when it ends (or at once if it cannot play). */
  async narrate(file: string): Promise<number> {
    if (!this.context) return 0;
    this.stopNarration();
    const buffer = await this.load(file);
    if (!buffer) return 0;
    const source = this.context.createBufferSource();
    source.buffer = buffer;
    source.connect(this.narrationBus!);
    this.duck();
    source.onended = () => { if (this.narration === source) { this.narration = null; this.unduck(); } };
    source.start();
    this.narration = source;
    return buffer.duration;
  }
  /** Plays a narration clip and resolves when it ends or is stopped; false if it could not play. */
  async speak(file: string): Promise<boolean> {
    if (!this.context) return false;
    const buffer = await this.load(file);
    if (!buffer || !this.context) return false;
    this.stopNarration();
    const source = this.context.createBufferSource();
    source.buffer = buffer;
    source.connect(this.narrationBus!);
    this.duck();
    this.narration = source;
    return new Promise((resolve) => {
      source.onended = () => {
        if (this.narration === source) { this.narration = null; this.unduck(); }
        resolve(true);
      };
      source.start();
    });
  }
  stopNarration(): void {
    if (this.narration) { try { this.narration.stop(); } catch { /* ended */ } this.narration = null; }
    this.unduck();
  }
  private duck(): void {
    const at = this.context!.currentTime;
    this.duckBus!.gain.setTargetAtTime(DUCKED, at, 0.15);
    this.stingDuckBus!.gain.setTargetAtTime(STING_DUCKED, at, 0.15);
  }
  private unduck(): void {
    if (!this.context || !this.duckBus) return;
    this.duckBus.gain.setTargetAtTime(1, this.context.currentTime, 0.4);
    this.stingDuckBus!.gain.setTargetAtTime(1, this.context.currentTime, 0.4);
  }
  async durationOf(file: string): Promise<number> {
    if (!this.context) return 0;
    return (await this.load(file))?.duration ?? 0;
  }
}

export const dealAudio = new DealAudio();
