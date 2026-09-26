// Composes and renders Deal or Dud's original music and stings. Everything here is synthesized from scratch,
// so the audio is fully owned by this project. Requires ffmpeg (set FFMPEG if it is not on PATH).
//
//   [FFMPEG=<path to ffmpeg>] npx tsx scripts/deal-or-dud/render-music.ts
import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const FFMPEG = process.env.FFMPEG ?? 'ffmpeg';
const SR = 44100;
const TAU = Math.PI * 2;

// ---------- small deterministic noise ----------
let seed = 12345;
const noise = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return (seed / 0x7fffffff) * 2 - 1; };

// ---------- buffer ----------
class Track {
  l: Float32Array; r: Float32Array;
  constructor(public seconds: number) { const n = Math.ceil(seconds * SR); this.l = new Float32Array(n); this.r = new Float32Array(n); }
  get length() { return this.l.length; }
  add(at: number, mono: Float32Array, gain = 1, pan = 0) {
    const start = Math.round(at * SR);
    const gl = gain * Math.cos((pan + 1) * Math.PI / 4), gr = gain * Math.sin((pan + 1) * Math.PI / 4);
    for (let i = 0; i < mono.length; i += 1) {
      const j = start + i; if (j < 0 || j >= this.l.length) continue;
      this.l[j] += mono[i] * gl; this.r[j] += mono[i] * gr;
    }
  }
}

const midi = (note: number) => 440 * Math.pow(2, (note - 69) / 12);
const N: Record<string, number> = { C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, F: 5, 'F#': 6, Gb: 6, G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11 };
const note = (name: string) => { const m = /^([A-G][#b]?)(-?\d)$/.exec(name)!; return 12 * (Number(m[2]) + 1) + N[m[1]]; };

function env(i: number, n: number, a: number, d: number, s: number, r: number): number {
  const t = i / SR, len = n / SR;
  if (t < a) return t / a;
  if (t < a + d) return 1 - (1 - s) * ((t - a) / d);
  if (t < len - r) return s;
  return Math.max(0, s * (len - t) / r);
}
function lowpass(buffer: Float32Array, cutoff: number | ((i: number) => number)): Float32Array {
  let y = 0;
  for (let i = 0; i < buffer.length; i += 1) {
    const fc = typeof cutoff === 'number' ? cutoff : cutoff(i);
    const a = 1 - Math.exp(-TAU * fc / SR);
    y += a * (buffer[i] - y); buffer[i] = y;
  }
  return buffer;
}
function highpass(buffer: Float32Array, cutoff: number): Float32Array {
  const a = Math.exp(-TAU * cutoff / SR); let px = 0, py = 0;
  for (let i = 0; i < buffer.length; i += 1) { const y = a * (py + buffer[i] - px); px = buffer[i]; py = y; buffer[i] = y; }
  return buffer;
}
const saw = (phase: number) => 2 * (phase - Math.floor(phase + 0.5));
const tri = (phase: number) => 1 - 4 * Math.abs(Math.round(phase - 0.25) - (phase - 0.25));

// ---------- instruments ----------
function pad(notes: number[], seconds: number, bright = 1400): Float32Array {
  const n = Math.round(seconds * SR); const out = new Float32Array(n);
  for (const m of notes) for (const detune of [-0.08, 0, 0.09]) {
    const f = midi(m + detune); let phase = Math.random();
    for (let i = 0; i < n; i += 1) { phase += f / SR; out[i] += saw(phase) * 0.12 * env(i, n, 0.6, 0.4, 0.85, 0.9); }
  }
  return lowpass(lowpass(out, bright), bright * 1.3);
}
function pluck(m: number, seconds: number, brightness = 0.5): Float32Array {
  const f = midi(m); const period = Math.max(2, Math.round(SR / f)); const n = Math.round(seconds * SR);
  const ring = new Float32Array(period); for (let i = 0; i < period; i += 1) ring[i] = noise() * 0.6;
  const out = new Float32Array(n); let idx = 0;
  const damping = 0.994 + brightness * 0.004;
  for (let i = 0; i < n; i += 1) {
    const next = (idx + 1) % period;
    const value = ring[idx]; out[i] = value;
    ring[idx] = damping * 0.5 * (ring[idx] + ring[next]); idx = next;
  }
  for (let i = 0; i < n; i += 1) out[i] *= env(i, n, 0.002, 0.05, 1, 0.05);
  return out;
}
function bass(m: number, seconds: number): Float32Array {
  const f = midi(m); const n = Math.round(seconds * SR); const out = new Float32Array(n); let phase = 0;
  for (let i = 0; i < n; i += 1) { phase += f / SR; const s = Math.sin(TAU * phase) + 0.35 * Math.sin(TAU * phase * 2) + 0.2 * tri(phase); out[i] = Math.tanh(s * 1.4) * 0.5 * env(i, n, 0.005, 0.12, 0.7, 0.06); }
  return lowpass(out, 900);
}
function brass(notes: number[], seconds: number, level = 1): Float32Array {
  const n = Math.round(seconds * SR); const out = new Float32Array(n);
  for (const m of notes) for (const detune of [-0.06, 0.05]) {
    const f = midi(m + detune); let phase = Math.random();
    for (let i = 0; i < n; i += 1) { phase += f / SR * (1 + 0.004 * Math.sin(TAU * 5.5 * i / SR) * Math.min(1, i / SR / 0.3)); out[i] += saw(phase) * 0.16 * level * env(i, n, 0.03, 0.15, 0.75, 0.18); }
  }
  return lowpass(out, (i) => 700 + 2600 * Math.exp(-i / SR / 0.35));
}
function bell(m: number, seconds: number): Float32Array {
  const f = midi(m); const n = Math.round(seconds * SR); const out = new Float32Array(n);
  for (let i = 0; i < n; i += 1) { const t = i / SR; const mod = Math.sin(TAU * f * 3.5 * t) * 2.2 * Math.exp(-t * 4); out[i] = Math.sin(TAU * f * t + mod) * Math.exp(-t * 2.4) * 0.4; }
  return out;
}
function kick(level = 1): Float32Array {
  const n = Math.round(0.4 * SR); const out = new Float32Array(n); let phase = 0;
  for (let i = 0; i < n; i += 1) { const t = i / SR; phase += (45 + 110 * Math.exp(-t * 30)) / SR; out[i] = Math.sin(TAU * phase) * Math.exp(-t * 9) * level; }
  return out;
}
function snare(level = 1): Float32Array {
  const n = Math.round(0.25 * SR); const out = new Float32Array(n);
  for (let i = 0; i < n; i += 1) { const t = i / SR; out[i] = (noise() * 0.7 * Math.exp(-t * 18) + Math.sin(TAU * 190 * t) * 0.4 * Math.exp(-t * 25)) * level; }
  return highpass(out, 180);
}
function hat(level = 1, length = 0.06): Float32Array {
  const n = Math.round(length * SR); const out = new Float32Array(n);
  for (let i = 0; i < n; i += 1) out[i] = noise() * Math.exp(-(i / SR) * 60) * level;
  return highpass(highpass(out, 6000), 6000);
}
function timpani(m: number, seconds = 1.6, level = 1): Float32Array {
  const n = Math.round(seconds * SR); const out = new Float32Array(n); const f = midi(m); let phase = 0;
  for (let i = 0; i < n; i += 1) { const t = i / SR; phase += f * (1 + 0.08 * Math.exp(-t * 12)) / SR; out[i] = (Math.sin(TAU * phase) + 0.3 * Math.sin(TAU * phase * 1.5)) * Math.exp(-t * 2.4) * 0.6 * level + noise() * 0.08 * Math.exp(-t * 30) * level; }
  return lowpass(out, 1400);
}
function cymbal(seconds = 2.5, level = 1, swell = false): Float32Array {
  const n = Math.round(seconds * SR); const out = new Float32Array(n);
  for (let i = 0; i < n; i += 1) { const t = i / SR; const shape = swell ? Math.pow(t / seconds, 2.2) : Math.exp(-t * 1.6); out[i] = noise() * shape * 0.35 * level; }
  return highpass(lowpass(out, 11000), 4000);
}
function riser(seconds: number, level = 1): Float32Array {
  const n = Math.round(seconds * SR); const out = new Float32Array(n);
  for (let i = 0; i < n; i += 1) out[i] = noise() * Math.pow(i / n, 2) * 0.4 * level;
  return lowpass(out, (i) => 300 + 6000 * Math.pow(i / n, 2));
}
function woodblock(level = 1, pitch = 1200): Float32Array {
  const n = Math.round(0.12 * SR); const out = new Float32Array(n);
  for (let i = 0; i < n; i += 1) { const t = i / SR; out[i] = Math.sin(TAU * pitch * t) * Math.exp(-t * 55) * level + Math.sin(TAU * pitch * 2.7 * t) * Math.exp(-t * 90) * 0.3 * level; }
  return out;
}
function wah(from: number, to: number, seconds: number, level = 1): Float32Array {
  const n = Math.round(seconds * SR); const out = new Float32Array(n); let phase = 0;
  for (let i = 0; i < n; i += 1) {
    const k = i / n; const m = from + (to - from) * k; phase += midi(m + 0.15 * Math.sin(TAU * 6 * i / SR) * k) / SR;
    out[i] = saw(phase) * 0.35 * level * env(i, n, 0.03, 0.1, 0.8, 0.15);
  }
  return lowpass(out, (i) => 500 + 1300 * (0.5 + 0.5 * Math.sin(TAU * 2.2 * i / SR - 1.5)));
}

// ---------- mix helpers ----------
function reverb(track: Track, wet = 0.22, loop = false): void {
  const combs = [1116, 1188, 1277, 1356].map((d) => Math.round(d * SR / 44100));
  for (const [channel, offset] of [[track.l, 0], [track.r, 23]] as const) {
    const input = Float32Array.from(channel); const acc = new Float32Array(channel.length);
    const passes = loop ? 2 : 1;
    for (const base of combs) {
      const delay = base + offset; const buf = new Float32Array(delay); let idx = 0; let filter = 0;
      for (let pass = 0; pass < passes; pass += 1) {
        for (let i = 0; i < input.length; i += 1) {
          const out = buf[idx]; filter = out * 0.8 + filter * 0.2;
          buf[idx] = input[i] + filter * 0.78; idx = (idx + 1) % delay;
          if (pass === passes - 1) acc[i] += out * 0.25;
        }
      }
    }
    for (const delay of [556, 441]) {
      const buf = new Float32Array(delay); let idx = 0;
      for (let i = 0; i < acc.length; i += 1) { const b = buf[idx]; const y = -acc[i] + b; buf[idx] = acc[i] + b * 0.5; acc[i] = y; idx = (idx + 1) % delay; }
    }
    for (let i = 0; i < channel.length; i += 1) channel[i] = channel[i] * (1 - wet * 0.4) + acc[i] * wet;
  }
}
function finish(track: Track, peak = 0.89): void {
  let max = 0; for (let i = 0; i < track.length; i += 1) max = Math.max(max, Math.abs(track.l[i]), Math.abs(track.r[i]));
  const gain = max > 0 ? peak / max : 1;
  for (let i = 0; i < track.length; i += 1) { track.l[i] = Math.tanh(track.l[i] * gain * 1.05); track.r[i] = Math.tanh(track.r[i] * gain * 1.05); }
}
/** Folds everything past the loop point back onto the start so the loop is seamless. */
function wrapLoop(track: Track, loopSeconds: number): Track {
  const out = new Track(loopSeconds); const n = out.length;
  for (let i = 0; i < track.length; i += 1) { out.l[i % n] += track.l[i]; out.r[i % n] += track.r[i]; }
  return out;
}

function writeWav(path: string, track: Track): void {
  const n = track.length; const data = Buffer.alloc(44 + n * 4);
  data.write('RIFF', 0); data.writeUInt32LE(36 + n * 4, 4); data.write('WAVE', 8); data.write('fmt ', 12);
  data.writeUInt32LE(16, 16); data.writeUInt16LE(1, 20); data.writeUInt16LE(2, 22); data.writeUInt32LE(SR, 24);
  data.writeUInt32LE(SR * 4, 28); data.writeUInt16LE(4, 32); data.writeUInt16LE(16, 34); data.write('data', 36); data.writeUInt32LE(n * 4, 40);
  for (let i = 0; i < n; i += 1) {
    data.writeInt16LE(Math.max(-32767, Math.min(32767, Math.round(track.l[i] * 32767))), 44 + i * 4);
    data.writeInt16LE(Math.max(-32767, Math.min(32767, Math.round(track.r[i] * 32767))), 46 + i * 4);
  }
  writeFileSync(path, data);
}

// ---------- compositions (D minor, with D major for triumphs) ----------
const beat = (bpm: number) => 60 / bpm;
const CHORDS: string[][] = [['D3', 'F3', 'A3'], ['A#2', 'D3', 'F3'], ['F3', 'A3', 'C4'], ['C3', 'E3', 'G3']];
const BASS = ['D2', 'A#1', 'F2', 'C2'];

function lobbyLoop(): Track {
  const bpm = 104, b = beat(bpm), bars = 8, loop = bars * 4 * b;
  const t = new Track(loop + 3);
  for (let bar = 0; bar < bars; bar += 1) {
    const chord = CHORDS[bar % 4].map(note); const at = bar * 4 * b;
    t.add(at, pad(chord.map((m) => m + 12), 4 * b + 0.3, 1600), 0.55);
    const arp = [0, 1, 2, 1, 0, 2, 1, 2];
    arp.forEach((k, step) => t.add(at + step * b / 2, pluck(chord[k] + 24, 0.5, 0.6), 0.32, step % 2 ? 0.35 : -0.35));
    [0, 1.5, 2, 3.5].forEach((beatAt) => t.add(at + beatAt * b, bass(note(BASS[bar % 4]) + (beatAt === 3.5 ? 7 : 0), b * 0.9), 0.55));
    [0, 2].forEach((k) => t.add(at + k * b, kick(0.8), 0.9));
    [1, 3].forEach((k) => t.add(at + k * b, snare(0.55), 0.5, 0.1));
    for (let h = 0; h < 8; h += 1) t.add(at + h * b / 2, hat(h % 2 ? 0.35 : 0.55), 0.35, 0.3);
    if (bar % 2 === 1) t.add(at + 3 * b, bell(chord[2] + 24, 0.8), 0.18, -0.4);
  }
  reverb(t, 0.2, true);
  const out = wrapLoop(t, loop); finish(out, 0.8); return out;
}

function discussionBed(): Track {
  // Deliberately sparse and mid-light so voices sit on top of it.
  const bpm = 88, b = beat(bpm), bars = 8, loop = bars * 4 * b;
  const t = new Track(loop + 4);
  const chords = [['D3', 'F3', 'A3', 'C4'], ['A#2', 'D3', 'F3', 'A3'], ['G2', 'A#2', 'D3', 'F3'], ['A2', 'C#3', 'E3', 'G3']];
  for (let bar = 0; bar < bars; bar += 1) {
    const chord = chords[bar % 4].map(note); const at = bar * 4 * b;
    t.add(at, pad(chord, 4 * b + 0.5, 700), 0.6);
    [0, 3].forEach((step) => t.add(at + step * b, pluck(chord[(bar + step) % 4] + 12, 1.2, 0.2), 0.2, step ? 0.4 : -0.4));
    t.add(at, bass(chord[0] - 12, 2 * b), 0.35);
    t.add(at, kick(0.35), 0.4);
    for (let h = 0; h < 4; h += 1) t.add(at + h * b + b / 2, hat(0.18, 0.04), 0.3, 0.2);
  }
  reverb(t, 0.3, true);
  const out = wrapLoop(t, loop);
  // Carve out the speech band a little.
  for (const channel of [out.l, out.r]) { const low = lowpass(Float32Array.from(channel), 2200); channel.set(low); }
  finish(out, 0.7); return out;
}

function offerPulse(): Track {
  const bpm = 116, b = beat(bpm), bars = 8, loop = bars * 4 * b;
  const t = new Track(loop + 3);
  const chords = [['D3', 'F3', 'A3'], ['D3', 'F3', 'A#3'], ['D3', 'G3', 'A#3'], ['C#3', 'E3', 'A3']];
  for (let bar = 0; bar < bars; bar += 1) {
    const chord = chords[bar % 4].map(note); const at = bar * 4 * b;
    t.add(at, pad(chord.map((m) => m + 12), 4 * b + 0.2, 1100), 0.5);
    for (let e = 0; e < 8; e += 1) t.add(at + e * b / 2, bass(note('D2'), b * 0.4), e % 2 ? 0.35 : 0.5);
    for (let q = 0; q < 4; q += 1) t.add(at + q * b, woodblock(0.35, q === 0 ? 1500 : 1100), 0.5, 0.25);
    t.add(at, kick(0.7), 0.8);
    t.add(at + 2.5 * b, kick(0.5), 0.6);
    if (bar % 4 === 3) t.add(at + 2 * b, riser(2 * b, 0.6), 0.5);
  }
  reverb(t, 0.18, true);
  const out = wrapLoop(t, loop); finish(out, 0.78); return out;
}

function fanfare(): Track {
  const b = beat(120); const t = new Track(6);
  t.add(0, riser(1.2, 0.7), 0.6);
  t.add(0, timpani(note('D2'), 1.2, 0.8), 0.7);
  const hits: [number, string[]][] = [[1.2, ['D3', 'A3', 'D4']], [1.2 + b, ['F3', 'A3', 'D4']], [1.2 + 1.5 * b, ['G3', 'A#3', 'D4']], [1.2 + 2 * b, ['A3', 'C#4', 'E4']]];
  hits.forEach(([at, chord]) => { t.add(at, brass(chord.map(note), b * 0.9), 0.8); t.add(at, timpani(note('A1'), 0.8, 0.5), 0.6); });
  const final = 1.2 + 3 * b;
  t.add(final, brass(['D3', 'F#3', 'A3', 'D4'].map(note), 2.6, 1.1), 0.95);
  t.add(final, timpani(note('D2'), 2.4, 1), 0.9);
  t.add(final, cymbal(2.8, 1), 0.7);
  t.add(final, bell(note('D6'), 2.4), 0.3);
  reverb(t, 0.28); finish(t, 0.92); return t;
}
function pitchIntro(): Track {
  const t = new Track(3.2);
  t.add(0, riser(1.1, 0.7), 0.6);
  t.add(1.1, brass(['D4', 'A4'].map(note), 0.5), 0.7);
  t.add(1.1, kick(0.9), 0.8);
  [0, 0.15, 0.3].forEach((d, i) => t.add(1.3 + d, bell(note(['A5', 'D6', 'F6'][i]), 1.4), 0.22, i - 1));
  reverb(t, 0.3); finish(t, 0.8); return t;
}
function revealGood(): Track {
  const t = new Track(4.2); const b = 0.11;
  ['D4', 'F#4', 'A4', 'D5', 'F#5', 'A5'].forEach((n, i) => t.add(i * b, pluck(note(n), 1, 0.8), 0.45, (i % 2 ? 0.3 : -0.3)));
  t.add(0.7, brass(['D3', 'F#3', 'A3', 'D4', 'F#4'].map(note), 2.8, 1.1), 0.95);
  t.add(0.7, timpani(note('D2'), 2, 1), 0.8);
  t.add(0.7, cymbal(3, 0.9), 0.6);
  t.add(0.7, bell(note('A6'), 2.5), 0.2);
  reverb(t, 0.28); finish(t, 0.9); return t;
}
function revealBad(): Track {
  const t = new Track(4.2);
  const steps: [number, number, number][] = [[0, note('G3'), note('F#3')], [0.5, note('F#3'), note('F3')], [1.0, note('F3'), note('E3')]];
  steps.forEach(([at, from, to]) => t.add(at, wah(from, to, 0.45, 0.9), 0.8));
  t.add(1.5, wah(note('E3'), note('D#3') - 0.6, 1.9, 1), 0.9);
  t.add(1.5, timpani(note('D1'), 2.2, 0.9), 0.8);
  t.add(1.5, pad([note('D3'), note('G#3')], 2.4, 600), 0.4);
  reverb(t, 0.22); finish(t, 0.88); return t;
}
function winner(): Track {
  const b = beat(132); const t = new Track(7);
  t.add(0, riser(0.9, 0.7), 0.5);
  const seq: [number, string[]][] = [[0.9, ['D4', 'F#4', 'A4']], [0.9 + b, ['E4', 'G4', 'B4']], [0.9 + 2 * b, ['F#4', 'A4', 'D5']], [0.9 + 3 * b, ['G4', 'B4', 'D5']]];
  seq.forEach(([at, chord], i) => { t.add(at, brass(chord.map(note), b * 0.95), 0.75); t.add(at, kick(0.8), 0.7); t.add(at, snare(0.4 + i * 0.1), 0.4); });
  const hit = 0.9 + 4 * b;
  t.add(hit, brass(['D3', 'A3', 'D4', 'F#4', 'A4', 'D5'].map(note), 3.4, 1.2), 1);
  t.add(hit, timpani(note('D2'), 3, 1), 0.9);
  t.add(hit, cymbal(3.5, 1), 0.8);
  for (let i = 0; i < 12; i += 1) t.add(hit + 0.3 + i * 0.12, bell(note(['D6', 'F#6', 'A6'][i % 3]), 1), 0.12, (i % 3) - 1);
  reverb(t, 0.3); finish(t, 0.92); return t;
}
function lockSound(): Track {
  const t = new Track(0.5);
  t.add(0, woodblock(0.9, 900), 0.8); t.add(0.05, kick(0.6), 0.6); t.add(0.02, hat(0.5, 0.05), 0.4);
  finish(t, 0.7); return t;
}
function cardSound(): Track {
  const t = new Track(1.2);
  t.add(0, riser(0.28, 0.6), 0.5);
  t.add(0.25, bell(note('E6'), 0.9), 0.35, 0.2);
  t.add(0.32, bell(note('B6'), 0.8), 0.22, -0.2);
  reverb(t, 0.25); finish(t, 0.65); return t;
}
function tickSound(): Track {
  const t = new Track(0.2); t.add(0, woodblock(0.8, 1600), 1); finish(t, 0.5); return t;
}

// ---------- render ----------
const outDir = resolve('public/deal-or-dud/audio');
const tempDir = resolve('.data/music-tmp');
mkdirSync(outDir, { recursive: true }); mkdirSync(tempDir, { recursive: true });
const cues: [string, () => Track, boolean][] = [
  ['lobby-loop', lobbyLoop, true], ['discussion-bed', discussionBed, true], ['offer-pulse', offerPulse, true],
  ['fanfare', fanfare, false], ['pitch-intro', pitchIntro, false],
  ['reveal-good', revealGood, false], ['reveal-bad', revealBad, false], ['winner', winner, false],
  ['lock', lockSound, false], ['card', cardSound, false], ['tick', tickSound, false]
];
for (const [name, compose, isLoop] of cues) {
  const track = compose();
  const wav = join(tempDir, `${name}.wav`);
  writeWav(wav, track);
  // Loops stay WAV: MP3 encoder padding would put a gap at every loop point. Stings are normalized MP3.
  if (isLoop) execFileSync(FFMPEG, ['-y', '-loglevel', 'error', '-i', wav, '-ar', '32000', '-c:a', 'pcm_s16le', join(outDir, `${name}.wav`)]);
  else execFileSync(FFMPEG, ['-y', '-loglevel', 'error', '-i', wav, '-af', 'loudnorm=I=-15:TP=-1.2', '-ar', '44100', '-b:a', '128k', join(outDir, `${name}.mp3`)]);
  console.log(name, track.seconds.toFixed(1), 's');
}
rmSync(tempDir, { recursive: true, force: true });
