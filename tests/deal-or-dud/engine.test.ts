import { beforeEach, describe, expect, it } from 'vitest';
import { DealEngine } from '../../src/games/deal-or-dud/engine/DealEngine';
import { sanitizeDealSnapshot } from '../../src/games/deal-or-dud/engine/sanitize';
import { largestOffers, scoreRound } from '../../src/games/deal-or-dud/engine/scoring';
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

describe('scoring', () => {
  it('scales both the presenter and the winning shark with the deal size', () => {
    const offers = { a: 300 as const, b: 0 as const, c: 100 as const };
    const good = scoreRound('good', 'p', offers, { sharkId: 'a', amount: 300 });
    expect(good).toEqual(expect.arrayContaining([
      expect.objectContaining({ playerId: 'p', delta: 5 }),
      expect.objectContaining({ playerId: 'a', delta: 5 }),
      expect.objectContaining({ playerId: 'b', delta: 0 }),
      expect.objectContaining({ playerId: 'c', delta: 0 })
    ]));
    const bad = scoreRound('bad', 'p', { a: 500, b: 0, c: 300 }, { sharkId: 'a', amount: 500 });
    expect(bad).toEqual(expect.arrayContaining([
      expect.objectContaining({ playerId: 'p', delta: 5 }),
      expect.objectContaining({ playerId: 'a', delta: -5 }),
      expect.objectContaining({ playerId: 'b', delta: 1 }),
      expect.objectContaining({ playerId: 'c', delta: 0 })
    ]));
    // $500K on a GOOD business: presenter and shark both +7.
    expect(scoreRound('good', 'p', { a: 500, b: 0, c: 0 }, { sharkId: 'a', amount: 500 }).map((score) => score.delta)).toEqual([7, 7, 0, 0]);
  });

  it('scores no-deal rounds', () => {
    const allOut = { a: 0 as const, b: 0 as const, c: 0 as const };
    expect(scoreRound('bad', 'p', allOut, null).map((s) => s.delta)).toEqual([-2, 1, 1, 1]);
    expect(scoreRound('good', 'p', allOut, null).map((s) => s.delta)).toEqual([1, 0, 0, 0]);
    expect(scoreRound('good', 'p', { a: 100, b: 0, c: 0 }, { sharkId: 'a', amount: 100 }).map((s) => s.delta)).toEqual([3, 3, 0, 0]);
    expect(scoreRound('bad', 'p', { a: 200, b: 0, c: 0 }, { sharkId: 'a', amount: 200 }).map((s) => s.delta)).toEqual([2, -2, 1, 1]);
  });

  it('finds ties at the largest bid and ignores $0 bids', () => {
    expect(largestOffers({ a: 400, b: 400, c: 100 })).toEqual({ amount: 400, sharkIds: ['a', 'b'] });
    expect(largestOffers({ a: 0, b: 0, c: 0 })).toEqual({ amount: null, sharkIds: [] });
  });
});

describe('DealEngine', () => {
  let now = 1_000_000;
  let engine: DealEngine;
  let code: string;
  let host: string;
  let ids: string[];

  const snap = (): DealSnapshot => engine.snapshot(code);
  const advance = (ms: number) => { now += ms; engine.tick(now); };
  /** Everyone locks their product; the last lock starts round 1's pitch. */
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

  it('refuses a fifth player and starts only with four ready players', () => {
    expect(() => engine.joinPlayer(code, { ...JOIN, roomCode: code, name: 'Eve' })).toThrow(/4 players/);
    engine.startGame(code, host);
    expect(snap().phase).toBe('build');
    expect(snap().round).toBeNull();
    expect(snap().upcoming.map((round) => round.presenterId)).toEqual(ids);
  });

  it('plays a full round with a tie choice and scores it', () => {
    engine.startGame(code, host);
    const [presenter, s1, s2, s3] = ids;
    engine.toggleBuilder(code, presenter, 'modifiers', 'luxury');
    engine.toggleBuilder(code, presenter, 'audiences', 'pirates');
    expect(snap().upcoming[0].builder.suppliedProduct).toBeTruthy();
    buildAll();
    let state = snap();
    // Locking goes straight to the pitch, with the three favorable cards already on the TV.
    expect(state.phase).toBe('pitch');
    expect(state.clock!.totalMs).toBe(90_000);
    expect(state.round!.premise!.headline).toMatch(/^Luxury .+ for pirates$/);
    expect(state.round!.dossier).toHaveLength(6);
    const favorable = state.round!.dossier.filter((card) => card.polarity === 'favorable');
    expect(favorable).toHaveLength(3);
    expect(state.round!.publicFacts.map((fact) => fact.id).sort()).toEqual(favorable.map((card) => card.id).sort());

    engine.endPitch(code, presenter);
    expect(snap().phase).toBe('discussion');
    advance(150_000);
    state = snap();
    // Nothing else goes public on its own: bad facts are said out loud.
    expect(state.round!.publicFacts).toHaveLength(3);
    // Questions end straight into bidding; there is no separate last-answer step.
    expect(state.phase).toBe('offers');

    engine.lockOffer(code, s1, 300);
    engine.chooseOffer(code, s2, 300); engine.lockOffer(code, s2);
    engine.lockOffer(code, s3, 0);
    expect(snap().phase).toBe('offers-reveal');
    advance(5_000);
    expect(snap().phase).toBe('partner');
    engine.choosePartner(code, presenter, s2);
    state = snap();
    expect(state.phase).toBe('reveal');
    expect(state.clock!.totalMs).toBe(15_000);
    expect(state.round!.publicFacts).toHaveLength(6);
    const verdict = state.round!.result!.verdict;
    const score = (id: string) => state.players.find((player) => player.id === id)!.score;
    expect(score(presenter)).toBe(verdict === 'good' ? 5 : 3);
    expect(score(s2)).toBe(verdict === 'good' ? 5 : -3);
    expect(score(s1)).toBe(0);
    expect(score(s3)).toBe(verdict === 'good' ? 0 : 1);
  });

  it('accepts only $0-$500K bids in $100K steps and locks once', () => {
    engine.startGame(code, host);
    const [presenter, s1] = ids;
    buildAll();
    advance(45_000); engine.endPitch(code, presenter);
    advance(150_000);
    expect(snap().phase).toBe('offers');
    expect(() => engine.chooseOffer(code, s1, 250)).toThrow(/\$100K steps/);
    expect(() => engine.chooseOffer(code, s1, 600)).toThrow();
    expect(() => engine.lockOffer(code, s1)).toThrow(/Choose a bid/);
    engine.lockOffer(code, s1, 200);
    expect(() => engine.lockOffer(code, s1, 400)).toThrow(/locked/);
    expect(() => engine.chooseOffer(code, presenter, 100)).toThrow(/Only sharks/);
  });

  it('defaults unlocked sharks to $0 and picks randomly among tied sharks on timeout', () => {
    engine.startGame(code, host);
    const [presenter, s1, s2] = ids;
    buildAll();
    advance(45_000); engine.endPitch(code, presenter);
    advance(150_000);
    expect(snap().phase).toBe('offers');
    engine.lockOffer(code, s1, 500);
    engine.lockOffer(code, s2, 500);
    advance(45_000);
    expect(snap().round!.offers[ids[3]]).toBe(0);
    advance(5_000);
    expect(snap().phase).toBe('partner');
    advance(20_000);
    expect(snap().phase).toBe('reveal');
    expect([s1, s2]).toContain(snap().round!.result!.deal!.sharkId);
  });

  it('opens bidding early once all three sharks are ready, and a shark can take it back', () => {
    engine.startGame(code, host);
    const [presenter, s1, s2, s3] = ids;
    buildAll();
    engine.endPitch(code, presenter);
    engine.toggleReadyToBid(code, s1);
    engine.toggleReadyToBid(code, s2);
    engine.toggleReadyToBid(code, s2);
    expect(snap().round!.readyToBid).toEqual([s1]);
    expect(() => engine.toggleReadyToBid(code, presenter)).toThrow(/Only sharks/);
    engine.toggleReadyToBid(code, s2);
    expect(snap().phase).toBe('discussion');
    engine.toggleReadyToBid(code, s3);
    expect(snap().phase).toBe('offers');
  });

  it('lets the host skip the pitch and the questions', () => {
    engine.startGame(code, host);
    buildAll();
    expect(snap().phase).toBe('pitch');
    engine.continue(code, host);
    expect(snap().phase).toBe('discussion');
    engine.continue(code, host);
    expect(snap().phase).toBe('offers');
  });

  it('keeps the between-rounds scores short', () => {
    engine.startGame(code, host);
    buildAll();
    engine.continue(code, host); engine.continue(code, host);
    for (const id of ids.slice(1)) engine.lockOffer(code, id, 0);
    advance(5_000);
    engine.continue(code, host);
    expect(snap().phase).toBe('break');
    expect(snap().clock!.totalMs).toBe(12_000);
  });

  it('lets the presenter show a hidden card on the TV if they choose to', () => {
    engine.startGame(code, host);
    const [presenter, shark] = ids;
    buildAll();
    engine.endPitch(code, presenter);
    const hidden = engine.debugRoom(code).state.round!.dossier.find((card) => card.polarity === 'unfavorable')!;
    expect(() => engine.revealCard(code, shark, hidden.id)).toThrow(/presenter/);
    engine.revealCard(code, presenter, hidden.id);
    expect(snap().round!.publicFacts.find((fact) => fact.id === hidden.id)?.source).toBe('presenter');
  });

  it('hides secrets from the TV and sharks but not from the presenter', () => {
    engine.startGame(code, host);
    const [presenter, shark] = ids;
    buildAll();
    const full = snap();
    for (const view of [sanitizeDealSnapshot(full, 'host'), sanitizeDealSnapshot(full, 'presentation'), sanitizeDealSnapshot(full, 'player', shark)]) {
      expect(view.round!.verdict).toBeNull();
      expect(view.round!.explanation).toBeNull();
      expect(view.round!.dossier).toEqual([]);
      expect(JSON.stringify(view)).not.toContain(full.round!.dossier.find((card) => card.polarity === 'unfavorable')!.text);
    }
    const mine = sanitizeDealSnapshot(full, 'player', presenter);
    expect(mine.round!.verdict).toBe(full.round!.verdict);
    expect(mine.round!.dossier).toHaveLength(6);
  });

  it('hides other sharks offers until everyone locks', () => {
    engine.startGame(code, host);
    const [presenter, s1, s2] = ids;
    buildAll();
    advance(45_000); engine.endPitch(code, presenter);
    advance(150_000);
    engine.chooseOffer(code, s1, 500);
    const other = sanitizeDealSnapshot(snap(), 'player', s2);
    expect(other.round!.offers[s1]).toBeNull();
    const own = sanitizeDealSnapshot(snap(), 'player', s1);
    expect(own.round!.offers[s1]).toBe(500);
    expect(sanitizeDealSnapshot(snap(), 'player', presenter).round!.offers[s1]).toBeNull();
  });

  it('pauses when the presenter disconnects and shifts every deadline on resume', () => {
    engine.startGame(code, host);
    const [presenter] = ids;
    // Nobody presents during the build, so a dropped phone there does not pause anyone.
    engine.setPlayerConnected(code, ids[2], false);
    expect(snap().paused).toBe(false);
    engine.setPlayerConnected(code, ids[2], true);
    buildAll();
    const endsAt = snap().clock!.endsAt!;
    engine.setPlayerConnected(code, presenter, false);
    expect(snap().paused).toBe(true);
    advance(60_000);
    expect(snap().phase).toBe('pitch');
    engine.setPlayerConnected(code, presenter, true);
    expect(snap().paused).toBe(false);
    expect(snap().clock!.endsAt).toBe(endsAt + 60_000);
  });

  it('auto-locks every product when the build clock runs out and starts round 1', () => {
    engine.startGame(code, host);
    engine.lockPremiseRequest(code, ids[2]);
    advance(45_000);
    expect(snap().phase).toBe('pitch');
    expect(snap().round!.presenterId).toBe(ids[0]);
    expect(snap().round!.premise!.headline).toBeTruthy();
    expect(snap().round!.publicFacts).toHaveLength(3);
    expect(snap().upcoming.map((round) => round.presenterId)).toEqual(ids.slice(1));
    expect(snap().upcoming.every((round) => round.premise && round.dossier.length === 6)).toBe(true);
  });

  it('builds everyone at once, each phone privately, and pitches them back to back', () => {
    engine.startGame(code, host);
    const [a, b, c, d] = ids;
    engine.toggleBuilder(code, b, 'modifiers', 'luxury');
    expect(() => engine.lockPremiseRequest(code, 'nobody')).toThrow();
    engine.lockPremiseRequest(code, b);
    expect(() => engine.toggleBuilder(code, b, 'modifiers', 'luxury')).toThrow(/already locked/);
    // The name can still change after locking.
    const names = snap().upcoming[1].nameOptions;
    engine.chooseName(code, b, 2);
    expect(snap().upcoming[1].premise!.businessName).toBe(names[2]);
    // A phone sees only its own product, and no verdict or file before its pitch; the TV only who has locked.
    const full = snap();
    const bView = sanitizeDealSnapshot(full, 'player', b);
    expect(bView.upcoming[1].premise!.headline).toBe(full.upcoming[1].premise!.headline);
    expect(bView.upcoming[1].verdict).toBeNull();
    expect(bView.upcoming[1].dossier).toEqual([]);
    expect(bView.upcoming[0].builder.modifiers).toEqual([]);
    const tv = sanitizeDealSnapshot(full, 'host');
    expect(tv.upcoming.map((round) => Boolean(round.lockedAt))).toEqual([false, true, false, false]);
    expect(tv.upcoming.every((round) => round.premise === null && round.dossier.length === 0 && round.nameOptions.length === 0)).toBe(true);
    expect(JSON.stringify(sanitizeDealSnapshot(full, 'player', a))).not.toContain(full.upcoming[1].premise!.headline);
    // The last lock starts round 1 without waiting for the clock.
    engine.lockPremiseRequest(code, a);
    engine.lockPremiseRequest(code, c);
    expect(snap().phase).toBe('build');
    engine.lockPremiseRequest(code, d);
    expect(snap().phase).toBe('pitch');
    expect(snap().round!.presenterId).toBe(a);
    // B's file shows up on B's phone only when B's round starts.
    expect(sanitizeDealSnapshot(snap(), 'player', b).upcoming[0].dossier).toEqual([]);
  });

  it('lets the host lock everyone in early', () => {
    engine.startGame(code, host);
    engine.continue(code, host);
    expect(snap().phase).toBe('pitch');
    expect(snap().upcoming).toHaveLength(3);
  });

  it('rotates presenters and finishes four rounds with a winner or a tiebreaker', () => {
    engine.startGame(code, host);
    const presenters: string[] = [];
    buildAll();
    for (let round = 0; round < 4; round += 1) {
      presenters.push(snap().round!.presenterId);
      for (let step = 0; step < 40 && ['pitch', 'discussion', 'offers', 'offers-reveal', 'partner', 'reveal', 'break'].includes(snap().phase) && snap().roundIndex === round; step += 1) advance(30_000);
    }
    expect(presenters).toEqual(ids);
    for (let step = 0; step < 20 && snap().phase !== 'gameover'; step += 1) {
      const state = snap();
      if (state.phase === 'forecast') for (const id of state.forecast!.playerIds) engine.submitForecast(code, id, 1000);
      else advance(30_000);
    }
    expect(snap().phase).toBe('gameover');
    expect(snap().winnerIds).toHaveLength(1);
  });

  it('never repeats a headline or dossier within a game', () => {
    engine.startGame(code, host);
    const headlines: string[] = [];
    const variants: string[] = [];
    buildAll();
    for (let round = 0; round < 4; round += 1) {
      headlines.push(snap().round!.premise!.headline);
      variants.push(engine.debugRoom(code).state.round!.profileVariantId!);
      for (let step = 0; step < 40 && snap().roundIndex === round && snap().phase !== 'final'; step += 1) advance(30_000);
    }
    expect(new Set(headlines).size).toBe(4);
    expect(new Set(variants).size).toBe(4);
  });

  it('restores saved rooms paused after a restart', () => {
    const storage = new MemoryStorage();
    const first = new DealEngine(storage, { rng: seeded(1), now: () => now });
    const credentials = first.createRoom('http://lan');
    for (const name of ['A', 'B', 'C', 'D']) {
      const joined = first.joinPlayer(credentials.roomCode, { ...JOIN, roomCode: credentials.roomCode, name });
      first.setLook(credentials.roomCode, joined.playerId, { presetId: 'fancy-cat' });
    }
    first.updateSettings(credentials.roomCode, credentials.hostToken, { tutorial: false });
    first.startGame(credentials.roomCode, credentials.hostToken);
    const second = new DealEngine(storage, { rng: seeded(2), now: () => now });
    const restored = second.snapshot(credentials.roomCode);
    expect(restored.phase).toBe('build');
    expect(restored.paused).toBe(true);
  });

  it('sends a room saved mid-game before the shared build back to its lobby', () => {
    const storage = new MemoryStorage();
    const first = new DealEngine(storage, { rng: seeded(1), now: () => now });
    const credentials = first.createRoom('http://lan');
    for (const name of ['A', 'B', 'C', 'D']) {
      const joined = first.joinPlayer(credentials.roomCode, { ...JOIN, roomCode: credentials.roomCode, name });
      first.setLook(credentials.roomCode, joined.playerId, { presetId: 'fancy-cat' });
    }
    first.updateSettings(credentials.roomCode, credentials.hostToken, { tutorial: false });
    first.startGame(credentials.roomCode, credentials.hostToken);
    first.continue(credentials.roomCode, credentials.hostToken);
    // Rewrite the save as an older version would have written it.
    const key = [...Array(storage.length).keys()].map((i) => storage.key(i)!).find((item) => storage.getItem(item)!.includes(credentials.roomCode))!;
    const saved = JSON.parse(storage.getItem(key)!);
    for (const room of saved.rooms) delete room.state.upcoming;
    storage.setItem(key, JSON.stringify(saved));
    const second = new DealEngine(storage, { rng: seeded(2), now: () => now });
    const restored = second.snapshot(credentials.roomCode);
    expect(restored.phase).toBe('lobby');
    expect(restored.upcoming).toEqual([]);
    expect(restored.players).toHaveLength(4);
  });

  it('rejects bad photos and settings changes mid-game', () => {
    expect(() => engine.setLook(code, ids[0], { photo: 'javascript:alert(1)' })).toThrow();
    engine.startGame(code, host);
    expect(() => engine.updateSettings(code, host, { tone: 'crude' })).toThrow(/between games/);
    engine.updateSettings(code, host, { audio: { music: 10, effects: 20, narration: 30, muted: true } });
    expect(snap().settings.audio.music).toBe(10);
  });

  it('applies timer steps on top of a preset, in order, within limits', () => {
    engine.updateSettings(code, host, { timerPreset: 'quick' });
    for (let i = 0; i < 8; i++) engine.updateSettings(code, host, { timerSteps: { discussion: -10 } });
    expect(snap().settings.timers.discussion).toBe(60);
    expect(snap().settings.timers.prep).toBe(35);
    expect(snap().settings.timerPreset).toBe('custom');
    engine.updateSettings(code, host, { timerSteps: { discussion: 60 } });
    expect(snap().settings.timerPreset).toBe('quick');
  });

  it('gives each player a private seat code that takes the seat back on another phone', () => {
    engine.startGame(code, host);
    const full = snap();
    const codes = full.players.map((player) => player.seatCode);
    expect(new Set(codes).size).toBe(4);
    codes.forEach((seatCode) => expect(seatCode).toMatch(/^\d{4}$/));
    // Nobody else sees a seat code: not the TV, not other phones.
    expect(sanitizeDealSnapshot(full, 'presentation').players.every((player) => player.seatCode === null)).toBe(true);
    const mine = sanitizeDealSnapshot(full, 'player', ids[1]);
    expect(mine.players.filter((player) => player.seatCode !== null).map((player) => player.id)).toEqual([ids[1]]);

    // A started game refuses new players, but a seat code gets the seat back with a fresh token.
    expect(() => engine.joinPlayer(code, { ...JOIN, roomCode: code, name: 'Ben' })).toThrow(/seat code/);
    engine.setPlayerConnected(code, ids[1], false);
    const back = engine.joinPlayer(code, { ...JOIN, roomCode: code, name: 'Anything', seatCode: codes[1]! });
    expect(back.playerId).toBe(ids[1]);
    expect(snap().players.find((player) => player.id === ids[1])!.connected).toBe(true);
    expect(() => engine.joinPlayer(code, { ...JOIN, roomCode: code, name: 'X', seatCode: codes[1] === '0000' ? '0001' : '0000' })).toThrow(/does not match/);
  });

  it('lets the host free an abandoned lobby seat so a new player can take it', () => {
    engine.setPlayerConnected(code, ids[2], false);
    expect(() => engine.startGame(code, host)).toThrow(/connected/);
    engine.removePlayer(code, host, ids[2]);
    expect(snap().players).toHaveLength(3);
    const fresh = engine.joinPlayer(code, { ...JOIN, roomCode: code, name: 'Eve' });
    engine.setLook(code, fresh.playerId, { presetId: 'cool-fox' });
    engine.startGame(code, host);
    expect(snap().phase).toBe('build');
  });

  it('slows down seat code guessing', () => {
    const wrong = snap().players.some((player) => player.seatCode === '9999') ? '9998' : '9999';
    for (let i = 0; i < 10; i++) expect(() => engine.joinPlayer(code, { ...JOIN, roomCode: code, name: 'X', seatCode: wrong })).toThrow(/does not match/);
    expect(() => engine.joinPlayer(code, { ...JOIN, roomCode: code, name: 'X', seatCode: wrong })).toThrow(/Too many tries/);
  });
});
