import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { DealEngine } from '../../src/games/deal-or-dud/engine/DealEngine';
import { sanitizeDealSnapshot } from '../../src/games/deal-or-dud/engine/sanitize';
import { FIXED_LINES, HOST_VOICES, JOIN_GREETINGS, LIVE_LINES, MAX_LIVE_TEXT, fixedLineFile, speakable, type FixedLineId } from '../../src/games/deal-or-dud/audio/narrationLines';
import { dueWarning, lobbyPrefetch, planNarration, spokenName, type NarrationPlan, type Utterance } from '../../src/games/deal-or-dud/audio/narrationPlan';
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

  it('keeps a long pitch line under the live limit', () => {
    const line = LIVE_LINES.pitch('Bartholomew Jr.', 'The Extremely Serious Company Of Snacks', 'Haunted self-heating waterproof luxury socks for divorced dads, pirates and llamas');
    expect(line.text.length).toBeLessThanOrEqual(MAX_LIVE_TEXT);
    expect(line.text).toMatch(/^Please welcome Bartholomew Jr\., founder of The Extremely Serious Company Of Snacks! Haunted .+ llamas\.$/);
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

  it('welcomes everyone to the build, then opens each round on stage with the peek reminder', () => {
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
    expect(spoken(plan)).toEqual(['round-1', `Please welcome Ava, founder of ${premise.businessName}! ${premise.headline}.`, 'peeks']);
  });

  it('prepares every pitch intro on the server as products lock, next round first', async () => {
    engine.startGame(code, host);
    expect(linesToPrepare(engine.snapshot(code))).toEqual([]);
    engine.lockPremiseRequest(code, ids[2]);
    engine.lockPremiseRequest(code, ids[1]);
    const full = engine.snapshot(code);
    const lines = linesToPrepare(full).map((line) => line.text);
    expect(lines).toEqual([1, 2].map((index) => `Please welcome ${full.players[index].name}, founder of ${full.upcoming[index].premise!.businessName.replace(/[.!?]+$/, '')}! ${full.upcoming[index].premise!.headline}.`));
    // The TV says exactly the line the server prepared, so it plays from the narrator's cache.
    engine.lockPremiseRequest(code, ids[0]);
    engine.lockPremiseRequest(code, ids[3]);
    const asked: string[] = [];
    const fake = (async (url: string) => { asked.push(decodeURIComponent(url)); return new Response('ok'); }) as unknown as typeof fetch;
    prepareVoices(engine.snapshot(code), fake);
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(asked).toHaveLength(3);
    expect(asked[0]).toContain(`${full.players[1].name}, founder of`);
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
    expect(spoken(planNarration(before, after))).toEqual(['round-1', 'pitch', 'peeks']);
  });

  it('speaks the pronunciation but captions the typed name', () => {
    engine.setSayAs(code, host, ids[0], 'Ay-vuh');
    engine.startGame(code, host);
    const before = tv();
    buildAll();
    const item = planNarration(before, tv())!.items[1];
    expect(item).toEqual({ live: expect.objectContaining({ text: expect.stringMatching(/^Please welcome Ay-vuh, founder of/), caption: expect.stringMatching(/^Please welcome Ava, founder of/) }) });
  });

  it('refuses pronunciations from anyone but the host', () => {
    expect(() => engine.setSayAs(code, 'not-the-host', ids[0], 'x')).toThrow();
    expect(() => engine.setSayAs(code, host, 'nobody', 'x')).toThrow();
  });

  it('announces the verdict, the deal, and the leader', () => {
    engine.startGame(code, host);
    buildAll();
    advance(180_000);
    engine.lockOffer(code, ids[1], 300);
    engine.lockOffer(code, ids[2], 100);
    let before = tv();
    engine.lockOffer(code, ids[3], 0);
    let after = tv();
    expect(spoken(planNarration(before, after))).toEqual(['offers-reveal']);
    before = after;
    advance(5_000);
    after = tv();
    const result = after.round!.result!;
    const reveal = spoken(planNarration(before, after));
    expect(reveal[0]).toBe(result.verdict === 'good' ? 'verdict-good' : 'verdict-bad');
    expect(reveal[1]).toBe(result.verdict === 'good' ? 'Ben just struck gold!' : 'Ouch. Ben just bought a dud.');
    before = after;
    advance(10_000);
    after = tv();
    expect(after.phase).toBe('break');
    const leader = [...after.players].sort((a, b) => b.score - a.score)[0];
    expect(spoken(planNarration(before, after))).toEqual([`${leader.name} takes the lead!`]);
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
    engine.updateSettings(code, host, { timers: { prep: 55, stage: 90, offers: 30, tiebreaker: 15 } });
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
