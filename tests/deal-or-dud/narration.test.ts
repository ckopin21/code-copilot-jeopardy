import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { DealEngine } from '../../src/games/deal-or-dud/engine/DealEngine';
import { sanitizeDealSnapshot } from '../../src/games/deal-or-dud/engine/sanitize';
import { FIXED_LINES, HOST_VOICES, JOIN_GREETINGS, LIVE_LINES, MAX_LIVE_TEXT, PITCH_INTROS, fixedLineFile, raisedLine, speakable, type FixedLineId } from '../../src/games/deal-or-dud/audio/narrationLines';
import { dueWarning, lobbyPrefetch, pitchLine, planNarration, revealTotalPlan, spokenName, type NarrationPlan, type Utterance } from '../../src/games/deal-or-dud/audio/narrationPlan';
import { voiceRoute } from '../../src/games/deal-or-dud/voiceRoute';
import { linesToPrepare, prepareVoices } from '../../src/games/deal-or-dud/voicePrep';
import type { DealSnapshot } from '../../src/games/deal-or-dud/types';

class MemoryStorage implements Storage {
  private map = new Map<string, string>();
  get length() { return this.map.size; }
  clear() { this.map.clear(); }
  getItem(key: string) { return this.map.get(key) ?? null; }
  key(index: number) { return [...this.map.keys()][index] ?? null; }
  removeItem(key: string) { this.map.delete(key); }
  setItem(key: string, value: string) { this.map.set(key, value); }
}
function seeded(seed: number) {
  return () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
}
const JOIN = { roomCode: 'X', name: 'P', avatar: '🙂', accent: '#123456' };

/** Readable form of a plan: fixed line ids, and live lines as their text. */
function spoken(plan: NarrationPlan | null): string[] {
  return (plan?.items ?? []).map((item: Utterance) => ('fixed' in item ? item.fixed : item.live.text));
}

describe('narration lines', () => {
  it('has a recording of every fixed line variant in both voices', () => {
    for (const [id, variants] of Object.entries(FIXED_LINES) as [FixedLineId, readonly string[]][]) {
      for (const variant of variants.keys()) {
        for (const voice of HOST_VOICES) {
          expect(existsSync(resolve('public/deal-or-dud/audio', fixedLineFile(id, variant, voice))), `${id} ${variant} ${voice}`).toBe(true);
        }
      }
    }
  });

  it('only speaks letters, digits and light punctuation', () => {
    expect(speakable('  Ava 🦈✨ ')).toBe('Ava');
    expect(speakable('<b>Zo{e}</b>')).toBe('b Zo e b');
    expect(speakable('🦈🦈')).toBe('');
    expect(speakable("Mc'Donald-Smith & Co.")).toBe("Mc'Donald-Smith & Co.");
  });

  it('introduces the presenter by name only, with a different line each round', () => {
    const lines = PITCH_INTROS.map((_, variant) => LIVE_LINES.pitch('Bartholomew Jr.', variant).text);
    expect(new Set(lines).size).toBe(PITCH_INTROS.length);
    for (const text of lines) {
      expect(text).toContain('Bartholomew Jr.');
      expect(text.length).toBeLessThanOrEqual(MAX_LIVE_TEXT);
    }
  });
});

describe('narration plan', () => {
  let now = 1_000_000;
  let engine: DealEngine;
  let code: string;
  let host: string;
  let ids: string[];
  const tv = (): DealSnapshot => sanitizeDealSnapshot(engine.snapshot(code), 'host');
  const advance = (ms: number) => { now += ms; engine.tick(now); };
  const buildAll = () => { for (const id of ids) engine.lockPremiseRequest(code, id); };

  beforeEach(() => {
    now = 1_000_000;
    engine = new DealEngine(new MemoryStorage(), { rng: seeded(42), now: () => now });
    const credentials = engine.createRoom('http://lan:3000');
    code = credentials.roomCode;
    host = credentials.hostToken;
    ids = [];
    for (const name of ['Ava', 'Ben', 'Cy', 'Di']) {
      const joined = engine.joinPlayer(code, { ...JOIN, roomCode: code, name });
      engine.setLook(code, joined.playerId, { presetId: 'tycoon-shark' });
      ids.push(joined.playerId);
    }
    engine.updateSettings(code, host, { tutorial: false });
  });

  it('welcomes everyone to the build, then opens each round on stage and hands the presenter the floor', () => {
    let before = tv();
    engine.startGame(code, host);
    let after = tv();
    expect(spoken(planNarration(before, after))).toEqual(['welcome', 'build']);
    before = after;
    buildAll();
    after = tv();
    const premise = after.round!.premise!;
    const plan = planNarration(before, after)!;
    expect(plan.interrupt).toBe(true);
    expect(plan.delayMs).toBeGreaterThan(0);
    const intro = spoken(plan)[1];
    expect(spoken(plan)).toEqual(['round-1', intro, 'pitch-go']);
    // Just the presenter: never the product or the company.
    expect(intro).toContain('Ava');
    expect(intro).not.toContain(premise.headline);
    expect(intro.toLowerCase()).not.toContain(premise.headline.toLowerCase());
  });

  it('prepares every pitch intro on the server as products lock, next round first', async () => {
    engine.startGame(code, host);
    expect(linesToPrepare(engine.snapshot(code))).toEqual([]);
    engine.lockPremiseRequest(code, ids[2]);
    engine.lockPremiseRequest(code, ids[1]);
    const full = engine.snapshot(code);
    const lines = linesToPrepare(full).map((line) => line.text);
    expect(lines).toEqual([1, 2].map((index) => pitchLine(full, full.upcoming[index])!.text));
    // Rounds 2 and 3 get different intros, each naming its presenter.
    expect(lines[0]).toContain(full.players[1].name);
    expect(lines[1]).toContain(full.players[2].name);
    expect(lines[0].replace(full.players[1].name, '')).not.toBe(lines[1].replace(full.players[2].name, ''));
    // The TV says exactly the line the server prepared, so it plays from the narrator's cache.
    engine.lockPremiseRequest(code, ids[0]);
    engine.lockPremiseRequest(code, ids[3]);
    const asked: string[] = [];
    const fake = (async (url: string) => { asked.push(decodeURIComponent(url)); return new Response('ok'); }) as unknown as typeof fetch;
    prepareVoices(engine.snapshot(code), fake);
    await new Promise((resolve) => setTimeout(resolve, 20));
    // On stage: "X and Y both want in!" for each pair of this round's sharks, then the next pitch intros.
    expect(asked.slice(0, 3).map((url) => url.replace(/^.*text=/, ''))).toEqual(['Ben and Cy both want in!', 'Ben and Di both want in!', 'Cy and Di both want in!']);
    expect(asked).toHaveLength(6);
    expect(asked[3]).toContain(full.players[1].name);
  });

  it('uses the host pronunciation and falls back when a name cannot be spoken', () => {
    engine.setSayAs(code, host, ids[0], '  Ay   vah ');
    expect(engine.snapshot(code).players[0].sayAs).toBe('Ay vah');
    expect(spokenName(tv(), ids[0])).toBe('Ay vah');
    engine.setSayAs(code, host, ids[0], '');
    expect(engine.snapshot(code).players[0].sayAs).toBeUndefined();
    // An emoji-only name has nothing to say, so the recorded "our next entrepreneur" line plays instead.
    engine.startGame(code, host);
    const before = tv();
    buildAll();
    const after = tv();
    after.players[0].name = '🦈';
    expect(spokenName(after, ids[0])).toBeNull();
    expect(spoken(planNarration(before, after))).toEqual(['round-1', 'pitch', 'pitch-go']);
  });

  it('speaks the pronunciation but captions the typed name', () => {
    engine.setSayAs(code, host, ids[0], 'Ay-vuh');
    engine.startGame(code, host);
    const before = tv();
    buildAll();
    const item = planNarration(before, tv())!.items[1];
    expect(item).toEqual({ live: expect.objectContaining({ text: expect.stringContaining('Ay-vuh'), caption: expect.stringContaining('Ava') }) });
  });

  it('refuses pronunciations from anyone but the host', () => {
    expect(() => engine.setSayAs(code, 'not-the-host', ids[0], 'x')).toThrow();
    expect(() => engine.setSayAs(code, host, 'nobody', 'x')).toThrow();
  });

  it('says "Questions open!" and who is out on stage', () => {
    engine.startGame(code, host);
    buildAll();
    let before = tv();
    advance(60_000);
    let after = tv();
    expect(spoken(planNarration(before, after))).toEqual(['questions-open']);
    before = after;
    engine.goOut(code, ids[2]);
    after = tv();
    const plan = planNarration(before, after)!;
    expect(spoken(plan)).toEqual(['Cy is out!']);
    expect(plan.interrupt).toBe(false);
    // Everyone else bails too: straight to the reveal.
    engine.goOut(code, ids[1]);
    before = tv();
    engine.goOut(code, ids[3]);
    expect(spoken(planNarration(before, tv()))).toEqual(['all-out']);
    expect(spoken(revealTotalPlan(tv()))).toEqual(['no-offers']);
  });

  it('opens the reveal, then announces the total, who is in, and the leader', () => {
    engine.startGame(code, host);
    buildAll();
    advance(180_000);
    engine.lockOffer(code, ids[1], 300);
    engine.lockOffer(code, ids[2], 400);
    let before = tv();
    engine.lockOffer(code, ids[3], 0);
    let after = tv();
    expect(spoken(planNarration(before, after))).toEqual(['offers-reveal']);
    expect(spoken(revealTotalPlan(after))).toEqual(['raised-7', 'Cy is in!']);
    before = after;
    advance(10_000);
    after = tv();
    expect(after.phase).toBe('break');
    const leader = [...after.players].sort((a, b) => b.score - a.score)[0];
    expect(spoken(planNarration(before, after))).toEqual([`${leader.name} takes the lead!`]);
  });

  it('names both sharks on a tie at the top, and has a total line for every possible total', () => {
    engine.startGame(code, host);
    buildAll();
    advance(180_000);
    engine.lockOffer(code, ids[1], 500);
    engine.lockOffer(code, ids[2], 500);
    engine.lockOffer(code, ids[3], 500);
    expect(spoken(revealTotalPlan(tv()))).toEqual(['raised-15', 'all-in']);
    for (let total = 100; total <= 1500; total += 100) expect(FIXED_LINES[raisedLine(total)!]).toBeTruthy();
    expect(raisedLine(0)).toBeNull();
    expect(LIVE_LINES.bothIn('Ava', 'Ben').text).toBe('Ava and Ben both want in!');
  });

  it('makes a moment of each new pass before everyone builds again', () => {
    engine.updateSettings(code, host, { pitches: 3 });
    engine.startGame(code, host);
    const passes: string[][] = [];
    for (let pass = 0; pass < 3; pass += 1) {
      for (const id of ids) engine.lockPremiseRequest(code, id);
      for (let round = 0; round < 4; round += 1) {
        engine.continue(code, host);
        engine.continue(code, host);
        for (const id of engine.snapshot(code).round!.sharkIds) engine.lockOffer(code, id, 0);
        engine.continue(code, host);
        if (pass === 2 && round === 3) break;
        const before = tv();
        engine.continue(code, host);
        if (round === 3) passes.push(spoken(planNarration(before, tv())));
      }
    }
    expect(passes).toEqual([['next-pass'], ['last-pass']]);
  });

  it('says nothing while paused and nothing on an unchanged phase outside the lobby', () => {
    engine.startGame(code, host);
    const before = tv();
    engine.pause(code, host);
    expect(planNarration(before, tv())).toBeNull();
    engine.resume(code, host);
    expect(planNarration(before, tv())).toBeNull();
  });

  it('greets players who finish joining in the lobby', () => {
    const fresh = new DealEngine(new MemoryStorage(), { rng: seeded(7), now: () => now });
    const room = fresh.createRoom('http://lan:3000');
    const joined = fresh.joinPlayer(room.roomCode, { ...JOIN, roomCode: room.roomCode, name: 'Zed' });
    const before = fresh.snapshot(room.roomCode);
    fresh.setLook(room.roomCode, joined.playerId, { presetId: 'tycoon-shark' });
    const plan = planNarration(before, fresh.snapshot(room.roomCode))!;
    const greetings = JOIN_GREETINGS.map((greet) => greet('Zed'));
    expect(spoken(plan)).toHaveLength(1);
    expect(greetings).toContain(spoken(plan)[0]);
    expect(plan.interrupt).toBe(false);
    expect(lobbyPrefetch(fresh.snapshot(room.roomCode)).map((line) => line.text)).toContain('Zed takes the lead!');
  });

  it('greets each of the four players with a different line', () => {
    const fresh = new DealEngine(new MemoryStorage(), { rng: seeded(7), now: () => now });
    const room = fresh.createRoom('http://lan:3000');
    const heard: string[] = [];
    for (const name of ['Ava', 'Ben', 'Cleo', 'Dev']) {
      const joined = fresh.joinPlayer(room.roomCode, { ...JOIN, roomCode: room.roomCode, name });
      const before = fresh.snapshot(room.roomCode);
      fresh.setLook(room.roomCode, joined.playerId, { presetId: 'tycoon-shark' });
      heard.push(spoken(planNarration(before, fresh.snapshot(room.roomCode))!)[0].replace(name, 'NAME'));
    }
    expect(new Set(heard).size).toBe(4);
  });

  it('warns once near the end of a clock, only inside the window', () => {
    engine.startGame(code, host);
    buildAll();
    const room = tv();
    expect(room.phase).toBe('stage');
    expect(dueWarning(room, 90_000)).toBeNull();
    expect(dueWarning(room, 59_000)?.line).toBe('stage-60');
    expect(dueWarning(room, 45_000)).toBeNull();
    expect(dueWarning(room, 29_000)?.line).toBe('stage-30');
    expect(dueWarning(room, 20_000)).toBeNull();
    expect(dueWarning(room, 9_500)?.line).toBe('stage-10');
    expect(dueWarning(room, 29_000)?.key).not.toBe(dueWarning(room, 9_500)?.key);
    engine.pause(code, host);
    expect(dueWarning(tv(), 9_500)).toBeNull();
  });

  it('skips the one-minute warning on a short stage clock', () => {
    engine.updateSettings(code, host, { timers: { stage: 90 } as never });
    engine.startGame(code, host);
    buildAll();
    expect(dueWarning(tv(), 59_000)).toBeNull();
    expect(dueWarning(tv(), 29_000)?.line).toBe('stage-30');
  });
});

describe('voice route', () => {
  const query = (voice: string, text: string) => new URLSearchParams({ voice, text });
  const wav = new Uint8Array([82, 73, 70, 70]);

  it('rejects unknown voices and unsafe or oversized text without calling the service', async () => {
    const fail = (() => { throw new Error('should not be called'); }) as unknown as typeof fetch;
    expect((await voiceRoute(query('bob', 'Hi'), fail)).status).toBe(400);
    expect((await voiceRoute(query('adam', ''), fail)).status).toBe(400);
    expect((await voiceRoute(query('adam', 'x'.repeat(MAX_LIVE_TEXT + 1)), fail)).status).toBe(400);
    expect((await voiceRoute(query('adam', '<script>'), fail)).status).toBe(400);
  });

  it('returns the service audio, and 503 when the service is off', async () => {
    let asked = '';
    const ok = (async (url: string) => { asked = url; return new Response(wav); }) as unknown as typeof fetch;
    const result = await voiceRoute(query('george', "Ava, you're in the hot seat!"), ok);
    expect(result.status).toBe(200);
    expect(result.contentType).toBe('audio/wav');
    expect([...result.body]).toEqual([...wav]);
    expect(asked).toMatch(/\/speak\?voice=george&text=Ava%2C/);
    const down = (async () => { throw new TypeError('connect ECONNREFUSED'); }) as unknown as typeof fetch;
    expect((await voiceRoute(query('adam', 'Hello'), down)).status).toBe(503);
  });
});
