// Plays the hosts' lines on the TV one at a time. Fixed lines alternate between the two host voices;
// live lines (with names) come from the narrator service and fall back to a recorded line when it is off or slow.
import { dealAudio } from './dealAudio';
import { FIXED_LINES, fixedLineFile, liveLineUrl, type FixedLineId, type HostVoice, type LiveLine } from './narrationLines';
import type { NarrationPlan, Utterance } from './narrationPlan';

/** How long a live line may take to arrive before the fallback plays instead. */
const LIVE_WAIT_MS = 4_000;
/** After the service fails, use fallbacks without asking for this long. */
const LIVE_RETRY_MS = 30_000;

type Job = NarrationPlan & { generation: number; queuedAt: number };

class Narrator {
  private jobs: Job[] = [];
  private generation = 0;
  private running = false;
  private nextVoice: HostVoice = 'george';
  private liveDownUntil = 0;
  private prefetching: Promise<void> = Promise.resolve();
  private listeners = new Set<() => void>();
  /** What is being said right now, for captions. */
  caption: string | null = null;

  onChange(listener: () => void): () => void { this.listeners.add(listener); return () => this.listeners.delete(listener); }
  private setCaption(text: string | null): void {
    if (this.caption === text) return;
    this.caption = text;
    this.listeners.forEach((listener) => listener());
  }

  say(plan: NarrationPlan): void {
    if (plan.interrupt) this.stop();
    // Start rendering live lines now, so a delay (waiting for a sting) overlaps the render time.
    if (Date.now() >= this.liveDownUntil) {
      for (const item of plan.items) if ('live' in item) void dealAudio.preload(liveLineUrl(item.live));
    }
    this.jobs.push({ ...plan, generation: this.generation, queuedAt: Date.now() });
    void this.run();
  }

  /** Silences the hosts and drops anything queued (pause, phase change, sound off). */
  stop(): void {
    this.generation += 1;
    this.jobs = [];
    dealAudio.stopNarration();
    this.setCaption(null);
  }

  /** Renders live lines in the background, one at a time, so they play without a wait later. */
  prefetch(lines: LiveLine[]): void {
    for (const line of lines) {
      this.prefetching = this.prefetching.then(async () => {
        if (Date.now() < this.liveDownUntil) return;
        if (!(await dealAudio.preload(liveLineUrl(line)))) this.liveDownUntil = Date.now() + LIVE_RETRY_MS;
      });
    }
  }

  private async run(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      while (this.jobs.length) {
        const job = this.jobs.shift()!;
        if (job.generation !== this.generation) continue;
        if (job.staleMs && Date.now() - job.queuedAt > job.staleMs) continue;
        if (job.delayMs) await new Promise((resolve) => window.setTimeout(resolve, job.delayMs));
        for (const item of job.items) {
          if (job.generation !== this.generation) break;
          const clip = await this.resolve(item);
          if (job.generation !== this.generation) break;
          if (!clip) continue;
          this.setCaption(clip.text);
          await dealAudio.speak(clip.file);
        }
        if (job.generation === this.generation) this.setCaption(null);
      }
    } finally {
      this.running = false;
    }
  }

  private fixed(id: FixedLineId, voice?: HostVoice): { file: string; text: string } {
    const variants: readonly string[] = FIXED_LINES[id];
    const variant = Math.floor(Math.random() * variants.length);
    const chosen = voice ?? this.nextVoice;
    this.nextVoice = chosen === 'adam' ? 'george' : 'adam';
    return { file: fixedLineFile(id, variant, chosen), text: variants[variant] };
  }

  private async resolve(item: Utterance): Promise<{ file: string; text: string } | null> {
    if ('fixed' in item) return this.fixed(item.fixed);
    const line = item.live;
    if (Date.now() >= this.liveDownUntil) {
      const url = liveLineUrl(line);
      const timeout = new Promise<'late'>((resolve) => window.setTimeout(() => resolve('late'), LIVE_WAIT_MS));
      const buffer = await Promise.race([dealAudio.preload(url), timeout]);
      if (buffer && buffer !== 'late') {
        this.nextVoice = line.voice === 'adam' ? 'george' : 'adam';
        return { file: url, text: line.caption ?? line.text };
      }
      // Late lines keep loading and are cached for next time; failures pause live requests for a while.
      if (buffer === null) this.liveDownUntil = Date.now() + LIVE_RETRY_MS;
    }
    return line.fallback ? this.fixed(line.fallback, line.voice) : null;
  }
}

export const narrator = new Narrator();
