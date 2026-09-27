import { beforeEach, describe, expect, it } from 'vitest';
import { DealEngine } from '../../src/games/deal-or-dud/engine/DealEngine';
import { sanitizeDealSnapshot } from '../../src/games/deal-or-dud/engine/sanitize';
import { gameAwards, revealOrder, scoreRound, topBidders, voteWinners } from '../../src/games/deal-or-dud/engine/scoring';
import { buildHeadline, featureById, modifierById, productById } from '../../src/games/deal-or-dud/content/dealer';
import { pitchSeconds, type DealPlayer, type DealSnapshot, type RoundResult } from '../../src/games/deal-or-dud/types';

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
  it('gives the presenter one point per $100K raised', () => {
    const off = { noWalkout: false, ovation: false, pitchVote: false };
    const outcome = scoreRound('p', ['a', 'b', 'c'], { a: 500, b: 500, c: 500 }, [], off);
    expect(outcome.total).toBe(1500);
    expect(outcome.scores[0]).toEqual({ playerId: 'p', delta: 15, reason: 'Raised $1.5M' });
    expect(scoreRound('p', ['a', 'b', 'c'], { a: 0, b: 0, c: 0 }, [], off).scores[0].delta).toBe(0);
    expect(scoreRound('p', ['a', 'b', 'c'], { a: 300, b: 0, c: 100 }, [], off).scores[0].delta).toBe(4);
  });

  it('adds +2 when nobody walks out and +3 for a standing ovation, when they are switched on', () => {
    const both = scoreRound('p', ['a', 'b', 'c'], { a: 300, b: 400, c: 500 });
    expect(both.bonuses).toEqual([{ id: 'noWalkout', points: 2 }, { id: 'ovation', points: 3 }]);
    expect(both.scores[0]).toEqual({ playerId: 'p', delta: 12 + 2 + 3, reason: 'Raised $1.2M · Nobody walked out +2 · Standing ovation +3' });
    // One shark went out: no walkout bonus, and its $0 means no ovation either.
    expect(scoreRound('p', ['a', 'b', 'c'], { a: 0, b: 500, c: 500 }, ['a']).bonuses).toEqual([]);
    // A $200K bid is short of an ovation.
    expect(scoreRound('p', ['a', 'b', 'c'], { a: 200, b: 500, c: 500 }).bonuses.map((bonus) => bonus.id)).toEqual(['noWalkout']);
    expect(scoreRound('p', ['a', 'b', 'c'], { a: 300, b: 300, c: 300 }, [], { ...{ noWalkout: false, ovation: false, pitchVote: false }, ovation: true }).bonuses.map((bonus) => bonus.id)).toEqual(['ovation']);
  });

  it('counts votes: most votes wins, ties share, nobody voting means no winner', () => {
    expect(voteWinners({ a: 1, b: 1, c: 2, d: null })).toEqual([1]);
    expect(voteWinners({ a: 1, b: 2, c: null, d: null })).toEqual([1, 2]);
    expect(voteWinners({ a: null, b: null })).toEqual([]);
  });

  it('gives the sharks nothing, whatever they bid', () => {
    const outcome = scoreRound('p', ['a', 'b', 'c'], { a: 100, b: 300, c: 500 }, [], { noWalkout: false, ovation: false, pitchVote: false });
    expect(outcome.scores).toEqual([{ playerId: 'p', delta: 9, reason: 'Raised $900K' }]);
  });

  it('flips lowest first and names the top bidders', () => {
    expect(revealOrder(['a', 'b', 'c'], { a: 400, b: 0, c: 200 })).toEqual(['b', 'c', 'a']);
    expect(topBidders({ a: 400, b: 400, c: 100 })).toEqual(['a', 'b']);
    expect(topBidders({ a: 0, b: 0, c: 0 })).toEqual([]);
  });

  it('hands out the end awards, sharing ties and skipping ones nobody earned', () => {
    const players = ['p', 'a', 'b', 'c'].map((id) => ({ id, name: id.toUpperCase() })) as DealPlayer[];
    const round = (presenterId: string, headline: string, offers: Record<string, 0 | 100 | 200 | 300 | 400 | 500>): RoundResult => {
      const sharkIds = Object.keys(offers);
      const outcome = scoreRound(presenterId, sharkIds, offers);
      return { presenterId, headline, offers, ...outcome };
    };
    const history = [
      round('p', 'Flakely', { a: 500, b: 400, c: 300 }),
      round('a', 'Sockify', { p: 100, b: 0, c: 200 })
    ];
    const awards = gameAwards(history, players);
    expect(awards.find((award) => award.id === 'silver-tongue')).toMatchObject({ playerIds: ['p'], detail: 'Raised $1.2M in one pitch' });
    expect(awards.find((award) => award.id === 'tightwad')).toMatchObject({ playerIds: ['p'] });
    // a bid $500K once; c bid $300K and $200K. They share it.
    expect(awards.find((award) => award.id === 'big-spender')).toMatchObject({ playerIds: ['a', 'c'], detail: '$500K in bids all game' });
    // Nothing raised and everyone bid the same: no awards.
    expect(gameAwards([round('p', 'Nope', { a: 0, b: 0, c: 0 })], players)).toEqual([]);
  });
});

describe('pitch time', () => {
  it('is the first minute on stage, or the first third of a short clock', () => {
    expect(pitchSeconds(180)).toBe(60);
    expect(pitchSeconds(600)).toBe(60);
    expect(pitchSeconds(120)).toBe(40);
    expect(pitchSeconds(60)).toBe(20);
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
  /** Everyone locks their product; the last lock puts round 1 on stage. */
  const buildAll = () => { for (const id of ids) engine.lockPremiseRequest(code, id); };
  /** Round 1 on stage, past pitch time. */
  const toQuestions = () => { buildAll(); advance(60_000); expect(snap().round!.questionsOpen).toBe(true); };

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

  it('plays a full round: pitch time, questions, secret bids, the reveal and the scores', () => {
    engine.startGame(code, host);
    const [presenter, s1, s2, s3] = ids;
    const hands = () => snap().upcoming[0].builder.hands;
    engine.builderPick(code, presenter, 'products', hands().products[0]);
    engine.builderPick(code, presenter, 'modifiers', hands().modifiers[0]);
    engine.builderPick(code, presenter, 'audiences', hands().audiences[0]);
    engine.builderPick(code, presenter, 'features', hands().features[0]);
    const picks = snap().upcoming[0].builder;
    buildAll();
    let state = snap();
    expect(state.phase).toBe('stage');
    expect(state.clock!.totalMs).toBe(180_000);
    expect(state.round!.premise!.headline).toBe(buildHeadline(picks));
    // In reading order, like the headline: twist, product, who, feature.
    expect(state.round!.premise!.emojis).toEqual([modifierById(picks.modifier)!.emoji, productById(picks.product)!.emoji, expect.any(String), featureById(picks.feature)!.emoji]);
    // Pitch time: the sharks' buttons are locked.
    expect(state.round!.questionsOpen).toBe(false);
    expect(() => engine.react(code, s1, '😂')).toThrow(/Pitch time/);
    expect(() => engine.goOut(code, s1)).toThrow(/Pitch time/);
    expect(() => engine.toggleReadyToBid(code, s1)).toThrow(/Pitch time/);
    advance(59_000);
    expect(snap().round!.questionsOpen).toBe(false);
    advance(1_000);
    expect(snap().round!.questionsOpen).toBe(true);

    advance(120_000);
    state = snap();
    expect(state.phase).toBe('offers');
    engine.lockOffer(code, s1, 300);
    engine.chooseOffer(code, s2, 500); engine.lockOffer(code, s2);
    expect(snap().phase).toBe('offers');
    engine.lockOffer(code, s3, 100);
    state = snap();
    // Everyone locked: straight to the reveal.
    expect(state.phase).toBe('reveal');
    expect(state.clock!.totalMs).toBe(10_000);
    const result = state.round!.result!;
    expect(result.total).toBe(900);
    expect(result.revealOrder).toEqual([s3, s1, s2]);
    expect(result.dealSharkIds).toEqual([s2]);
    const score = (id: string) => state.players.find((player) => player.id === id)!.score;
    // Only the presenter scores: $900K raised, and nobody walked out (+2).
    expect([score(presenter), score(s1), score(s2), score(s3)]).toEqual([11, 0, 0, 0]);
    expect(result.bonuses).toEqual([{ id: 'noWalkout', points: 2 }]);
    expect(state.history).toHaveLength(1);
  });

  it('accepts only $0-$500K bids in $100K steps and locks once', () => {
    engine.startGame(code, host);
    const [presenter, s1] = ids;
    buildAll();
    advance(180_000);
    expect(snap().phase).toBe('offers');
    expect(() => engine.chooseOffer(code, s1, 250)).toThrow(/\$100K steps/);
    expect(() => engine.chooseOffer(code, s1, 600)).toThrow();
    expect(() => engine.lockOffer(code, s1)).toThrow(/Choose a bid/);
    engine.lockOffer(code, s1, 200);
    expect(() => engine.lockOffer(code, s1, 400)).toThrow(/locked/);
    expect(() => engine.chooseOffer(code, presenter, 100)).toThrow(/Only sharks/);
  });

  it('counts an unlocked bid as $0 when the bid clock runs out', () => {
    engine.startGame(code, host);
    const [, s1, s2, s3] = ids;
    buildAll();
    advance(180_000);
    engine.lockOffer(code, s1, 500);
    engine.chooseOffer(code, s2, 400);
    advance(45_000);
    const state = snap();
    expect(state.phase).toBe('reveal');
    expect(state.round!.result!.offers).toEqual({ [s1]: 500, [s2]: 0, [s3]: 0 });
    expect(state.round!.result!.total).toBe(500);
  });

  it('floats reactions on the TV, drops a shark tapping too fast, and keeps only the last few', () => {
    engine.startGame(code, host);
    const [presenter, s1, s2] = ids;
    toQuestions();
    engine.react(code, s1, '😂');
    engine.react(code, s1, '🔥');
    engine.react(code, s2, '💀');
    expect(snap().round!.reactions.map((item) => [item.sharkId, item.emoji])).toEqual([[s1, '😂'], [s2, '💀']]);
    expect(() => engine.react(code, s1, '💩')).toThrow(/Unknown reaction/);
    expect(() => engine.react(code, presenter, '😂')).toThrow(/Only sharks/);
    for (let i = 0; i < 20; i += 1) { now += 700; engine.react(code, s2, '🤔'); }
    const reactions = snap().round!.reactions;
    expect(reactions).toHaveLength(12);
    expect(reactions[reactions.length - 1].id).toBe(22);
    // Reactions score nothing.
    expect(snap().players.every((player) => player.score === 0)).toBe(true);
  });

  it("locks an out shark at $0, skips it in the bids, and goes straight to the reveal when all three are out", () => {
    engine.startGame(code, host);
    const [, s1, s2, s3] = ids;
    toQuestions();
    engine.toggleReadyToBid(code, s1);
    engine.goOut(code, s1);
    expect(snap().round!.out.map((item) => item.sharkId)).toEqual([s1]);
    expect(snap().round!.readyToBid).toEqual([]);
    expect(() => engine.toggleReadyToBid(code, s1)).toThrow(/out/);
    // Going out twice is harmless.
    engine.goOut(code, s1);
    expect(snap().round!.out).toHaveLength(1);
    // The two still in are ready: bids open, with the out shark already locked at $0.
    engine.toggleReadyToBid(code, s2);
    engine.toggleReadyToBid(code, s3);
    const offers = snap();
    expect(offers.phase).toBe('offers');
    expect(offers.round!.offers[s1]).toBe(0);
    expect(offers.round!.lockedOffers).toEqual([s1]);
    expect(() => engine.lockOffer(code, s1, 500)).toThrow(/locked/);
    // Everyone sees that the out shark bid $0 (it was said out loud), but not the others' bids.
    engine.chooseOffer(code, s2, 400);
    const tv = sanitizeDealSnapshot(snap(), 'presentation');
    expect(tv.round!.offers).toEqual({ [s1]: 0, [s2]: null, [s3]: null });
  });

  it('skips the bids when every shark is out', () => {
    engine.startGame(code, host);
    const [presenter, s1, s2, s3] = ids;
    toQuestions();
    engine.goOut(code, s1);
    engine.goOut(code, s2);
    expect(snap().phase).toBe('stage');
    engine.goOut(code, s3);
    const state = snap();
    expect(state.phase).toBe('reveal');
    expect(state.round!.result!.total).toBe(0);
    expect(state.round!.result!.dealSharkIds).toEqual([]);
    expect(state.players.map((player) => player.score)).toEqual([0, 0, 0, 0]);
    expect(state.players.find((player) => player.id === presenter)!.score).toBe(0);
  });

  it('opens bidding early once every shark still in is ready, and a shark can take it back', () => {
    engine.startGame(code, host);
    const [presenter, s1, s2, s3] = ids;
    toQuestions();
    engine.toggleReadyToBid(code, s1);
    engine.toggleReadyToBid(code, s2);
    engine.toggleReadyToBid(code, s2);
    expect(snap().round!.readyToBid).toEqual([s1]);
    expect(() => engine.toggleReadyToBid(code, presenter)).toThrow(/Only sharks/);
    engine.toggleReadyToBid(code, s2);
    expect(snap().phase).toBe('stage');
    // The last shark bails instead: the other two were ready, so bidding opens.
    engine.goOut(code, s3);
    expect(snap().phase).toBe('offers');
  });

  it('lets the host skip pitch time, then the questions', () => {
    engine.startGame(code, host);
    buildAll();
    expect(snap().round!.questionsOpen).toBe(false);
    engine.continue(code, host);
    expect(snap().phase).toBe('stage');
    expect(snap().round!.questionsOpen).toBe(true);
    engine.continue(code, host);
    expect(snap().phase).toBe('offers');
  });

  it('keeps pitch time to a third of a short stage clock, and holds it while paused', () => {
    engine.updateSettings(code, host, { timerPreset: 'quick' });
    engine.startGame(code, host);
    buildAll();
    advance(20_000);
    engine.pause(code, host);
    advance(60_000);
    expect(snap().round!.questionsOpen).toBe(false);
    engine.resume(code, host);
    advance(19_000);
    expect(snap().round!.questionsOpen).toBe(false);
    advance(1_000);
    expect(snap().round!.questionsOpen).toBe(true);
  });

  it('keeps the reveal and the between-rounds scores short', () => {
    engine.startGame(code, host);
    buildAll();
    engine.continue(code, host);
    engine.continue(code, host);
    for (const id of ids.slice(1)) engine.lockOffer(code, id, 0);
    expect(snap().phase).toBe('reveal');
    expect(snap().clock!.totalMs).toBe(10_000);
    engine.continue(code, host);
    expect(snap().phase).toBe('break');
    expect(snap().clock!.totalMs).toBe(5_000);
  });

  it('keeps bids secret until the reveal, then shows them to everyone', () => {
    engine.startGame(code, host);
    const [presenter, s1, s2, s3] = ids;
    buildAll();
    advance(180_000);
    engine.chooseOffer(code, s1, 500);
    engine.lockOffer(code, s2, 200);
    expect(sanitizeDealSnapshot(snap(), 'player', s2).round!.offers[s1]).toBeNull();
    expect(sanitizeDealSnapshot(snap(), 'player', s1).round!.offers[s1]).toBe(500);
    expect(sanitizeDealSnapshot(snap(), 'player', presenter).round!.offers[s1]).toBeNull();
    const tv = sanitizeDealSnapshot(snap(), 'host');
    expect(tv.round!.offers[s2]).toBeNull();
    expect(tv.round!.lockedOffers).toEqual([s2]);
    engine.lockOffer(code, s1);
    engine.lockOffer(code, s3, 0);
    const reveal = sanitizeDealSnapshot(snap(), 'presentation');
    expect(reveal.phase).toBe('reveal');
    expect(reveal.round!.offers).toEqual({ [s1]: 500, [s2]: 200, [s3]: 0 });
    expect(reveal.round!.result!.total).toBe(700);
  });

  it('lets a player skip optional steps, pick the word before the who, and never skip the product', () => {
    engine.startGame(code, host);
    const me = ids[1];
    const mine = () => snap().upcoming[1].builder;
    engine.builderPick(code, me, 'products', mine().hands.products[0]);
    engine.builderSkip(code, me, 'modifiers');
    expect(() => engine.builderSkip(code, me, 'products')).toThrow(/needs a product/);
    engine.builderConnector(code, me, 'made-from');
    expect(() => engine.builderConnector(code, me, 'eaten-by')).toThrow(/Unknown connector/);
    engine.builderPick(code, me, 'audiences', mine().hands.audiences[0]);
    engine.builderPick(code, me, 'features', mine().hands.features[0]);
    engine.builderSkip(code, me, 'features');
    expect(mine().feature).toBeNull();
    engine.lockPremiseRequest(code, me);
    const premise = snap().upcoming[1].premise!;
    // Skipped steps stay out: no twist, no feature, and nothing filled in for them at the lock.
    expect(mine().modifier).toBeNull();
    expect(premise.headline).toBe(buildHeadline(mine()));
    expect(premise.headline).toContain(' made from ');
    expect(premise.headline).not.toContain(',');
    expect(premise.emojis).toHaveLength(2);
  });

  it('never lets a player write their own product (only the optional steps)', () => {
    engine.startGame(code, host);
    expect(() => engine.builderCustom(code, ids[0], 'products', 'flying hot tubs')).toThrow(/product card/);
    engine.builderCustom(code, ids[0], 'features', 'with a tiny hat');
    expect(snap().upcoming[0].builder.custom).toEqual({ features: 'with a tiny hat' });
  });

  it('deals the builder in reading order, six cards a step, with twists and products that fit each other', () => {
    engine.startGame(code, host);
    const me = ids[1];
    const mine = () => snap().upcoming[1].builder;
    for (const column of ['modifiers', 'products', 'audiences', 'features'] as const) expect(mine().hands[column]).toHaveLength(6);
    expect(() => engine.builderPick(code, me, 'products', 'not-a-card')).toThrow(/not in your hand/);
    // The twist comes first; the product cards are then only ones it fits.
    const twist = mine().hands.modifiers.find((id) => modifierById(id)!.forms.length < 8) ?? mine().hands.modifiers[0];
    engine.builderPick(code, me, 'modifiers', twist);
    expect(mine().modifier).toBe(twist);
    expect(mine().hands.products.every((id) => modifierById(twist)!.forms.includes(productById(id)!.form))).toBe(true);
    const product = mine().hands.products[2];
    engine.builderPick(code, me, 'products', product);
    expect(mine().product).toBe(product);
    // 🔀 deals new cards and keeps the pick.
    const before = mine().hands.products;
    engine.builderReroll(code, me, 'products');
    expect(mine().hands.products).toHaveLength(6);
    expect(mine().hands.products.some((id) => before.includes(id))).toBe(false);
    expect(mine().product).toBe(product);
    engine.builderPick(code, me, 'audiences', mine().hands.audiences[3]);
    // Another player's hands never share a product with this one.
    const others = snap().upcoming.filter((round) => round.presenterId !== me).flatMap((round) => round.builder.hands.products);
    expect(others.some((id) => mine().hands.products.includes(id) || id === product)).toBe(false);
    engine.lockPremiseRequest(code, me);
    expect(snap().upcoming[1].premise!.headline).toBe(buildHeadline(mine()));
  });

  it('lets a player write their own twist, who or feature', () => {
    engine.startGame(code, host);
    const me = ids[2];
    const mine = () => snap().upcoming[2].builder;
    engine.builderPick(code, me, 'products', mine().hands.products[0]);
    engine.builderCustom(code, me, 'modifiers', '   extremely   haunted  ');
    expect(mine().custom).toEqual({ modifiers: 'extremely haunted' });
    expect(mine().modifier).toBeNull();
    engine.builderCustom(code, me, 'audiences', 'x'.repeat(60));
    expect(mine().custom!.audiences).toHaveLength(40);
    engine.builderCustom(code, me, 'audiences', '');
    expect(mine().custom!.audiences).toBeUndefined();
    engine.lockPremiseRequest(code, me);
    const premise = snap().upcoming[2].premise!;
    expect(premise.headline).toMatch(/^Extremely haunted .+ for /);
    // The who and feature were left open, so the lock filled them with cards; the written twist shows a pencil.
    expect(premise.emojis[0]).toBe('✏️');
    expect(sanitizeDealSnapshot(snap(), 'player', ids[0]).upcoming[2].builder.custom).toEqual({});
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
    advance(200_000);
    expect(snap().phase).toBe('stage');
    engine.setPlayerConnected(code, presenter, true);
    expect(snap().paused).toBe(false);
    expect(snap().clock!.endsAt).toBe(endsAt + 200_000);
  });

  it('auto-locks every product when the build clock runs out, filling empty picks, and starts round 1', () => {
    engine.startGame(code, host);
    expect(snap().clock!.totalMs).toBe(90_000);
    engine.lockPremiseRequest(code, ids[2]);
    advance(90_000);
    expect(snap().phase).toBe('stage');
    expect(snap().round!.presenterId).toBe(ids[0]);
    // Nothing was picked, so every part of the headline came from the dealt cards.
    const picks = snap().round!.builder;
    expect([picks.product, picks.modifier, picks.audience, picks.feature].every(Boolean)).toBe(true);
    expect(snap().round!.premise!.headline).toMatch(/ for /);
    expect(snap().upcoming.map((round) => round.presenterId)).toEqual(ids.slice(1));
    expect(snap().upcoming.every((round) => round.premise && round.premise.emojis.length === 4)).toBe(true);
  });

  it('builds everyone at once, each phone privately, and pitches them back to back', () => {
    engine.startGame(code, host);
    const [a, b, c, d] = ids;
    const bHand = snap().upcoming[1].builder.hands.products;
    engine.builderPick(code, b, 'products', bHand[1]);
    expect(() => engine.lockPremiseRequest(code, 'nobody')).toThrow();
    engine.lockPremiseRequest(code, b);
    expect(() => engine.builderPick(code, b, 'products', bHand[0])).toThrow(/already locked/);
    // A phone sees only its own product before its pitch; the TV only who has locked.
    const full = snap();
    const bView = sanitizeDealSnapshot(full, 'player', b);
    expect(bView.upcoming[1].premise!.headline).toBe(full.upcoming[1].premise!.headline);
    expect(bView.upcoming[0].builder.hands.products).toEqual([]);
    const tv = sanitizeDealSnapshot(full, 'host');
    expect(tv.upcoming.map((round) => Boolean(round.lockedAt))).toEqual([false, true, false, false]);
    expect(tv.upcoming.every((round) => round.premise === null)).toBe(true);
    expect(JSON.stringify(sanitizeDealSnapshot(full, 'player', a))).not.toContain(full.upcoming[1].premise!.headline);
    // The last lock starts round 1 without waiting for the clock.
    engine.lockPremiseRequest(code, a);
    engine.lockPremiseRequest(code, c);
    expect(snap().phase).toBe('build');
    engine.lockPremiseRequest(code, d);
    expect(snap().phase).toBe('stage');
    expect(snap().round!.presenterId).toBe(a);
    // Round 1 on stage: its product is public now, B's is still only on B's phone.
    expect(sanitizeDealSnapshot(snap(), 'player', c).round!.premise).not.toBeNull();
    expect(JSON.stringify(sanitizeDealSnapshot(snap(), 'player', c))).not.toContain(full.upcoming[1].premise!.headline);
  });

  it('lets the host lock everyone in early', () => {
    engine.startGame(code, host);
    engine.continue(code, host);
    expect(snap().phase).toBe('stage');
    expect(snap().upcoming).toHaveLength(3);
  });

  it('rotates presenters and finishes four rounds with a winner or a tiebreaker', () => {
    engine.startGame(code, host);
    const presenters: string[] = [];
    buildAll();
    for (let round = 0; round < 4; round += 1) {
      presenters.push(snap().round!.presenterId);
      for (let step = 0; step < 40 && ['stage', 'offers', 'reveal', 'break'].includes(snap().phase) && snap().roundIndex === round; step += 1) advance(30_000);
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

  it('plays two pitches per player: a fresh build after round 4, then rounds 5 to 8', () => {
    engine.updateSettings(code, host, { pitches: 2 });
    expect(snap().settings.pitches).toBe(2);
    engine.updateSettings(code, host, { pitches: 9 });
    expect(snap().settings.pitches).toBe(3);
    engine.updateSettings(code, host, { pitches: 2 });
    engine.startGame(code, host);
    expect(() => engine.updateSettings(code, host, { pitches: 1 })).toThrow(/between games/);
    const presenters: string[] = [];
    const headlines: string[] = [];
    buildAll();
    for (let round = 0; round < 8; round += 1) {
      if (round === 4) {
        // After everyone has pitched once: the scores, then everyone builds a new product.
        expect(snap().phase).toBe('build');
        expect(snap().upcoming.map((item) => item.index)).toEqual([4, 5, 6, 7]);
        buildAll();
      }
      expect(snap().phase).toBe('stage');
      expect(snap().round!.index).toBe(round);
      presenters.push(snap().round!.presenterId);
      headlines.push(snap().round!.premise!.headline);
      engine.continue(code, host);
      engine.continue(code, host);
      for (const id of snap().round!.sharkIds) engine.lockOffer(code, id, 100);
      engine.continue(code, host);
      if (round < 7) { expect(snap().phase).toBe('break'); engine.continue(code, host); }
    }
    // The end-of-game votes come before the final scores.
    expect(snap().phase).toBe('vote');
    expect(presenters).toEqual([...ids, ...ids]);
    expect(new Set(headlines).size).toBe(8);
    expect(snap().history).toHaveLength(8);
    // $300K raised and nobody out, twice each: (3 + 2) x 2.
    expect(snap().players.every((player) => player.score === 10)).toBe(true);
  });

  it('ends with a secret vote for the pitch of the night (+5), never your own', () => {
    engine.startGame(code, host);
    buildAll();
    for (let round = 0; round < 4; round += 1) {
      engine.continue(code, host);
      engine.continue(code, host);
      for (const id of snap().round!.sharkIds) engine.lockOffer(code, id, 0);
      engine.continue(code, host);
      if (round < 3) engine.continue(code, host);
    }
    expect(snap().phase).toBe('vote');
    const before = snap().players.map((player) => player.score);
    // Round i was pitched by ids[i].
    expect(() => engine.submitVotes(code, ids[0], 0)).toThrow(/your own/);
    expect(() => engine.submitVotes(code, ids[0], 9)).toThrow(/Pick one/);
    engine.submitVotes(code, ids[0], 1);
    expect(() => engine.submitVotes(code, ids[0], 1)).toThrow(/are in/);
    // Nobody else sees a vote before the count.
    expect(sanitizeDealSnapshot(snap(), 'player', ids[1]).votes!.pitches[ids[0]]).toBeNull();
    expect(sanitizeDealSnapshot(snap(), 'player', ids[0]).votes!.pitches[ids[0]]).toBe(1);
    engine.submitVotes(code, ids[1], 0);
    engine.submitVotes(code, ids[2], 1);
    engine.submitVotes(code, ids[3], 1);
    const state = snap();
    expect(state.phase).toBe('vote-result');
    expect(state.votes!.pitchWinners).toEqual([1]);
    const after = state.players.map((player) => player.score);
    expect(after.map((score, index) => score - before[index])).toEqual([0, 5, 0, 0]);
    engine.continue(code, host);
    expect(['final']).toContain(snap().phase);
  });

  it('skips the vote when it is switched off', () => {
    engine.updateSettings(code, host, { bonuses: { noWalkout: true, ovation: true, pitchVote: false } });
    engine.startGame(code, host);
    buildAll();
    for (let round = 0; round < 4; round += 1) {
      engine.continue(code, host);
      engine.continue(code, host);
      for (const id of snap().round!.sharkIds) engine.lockOffer(code, id, 0);
      engine.continue(code, host);
      if (round < 3) engine.continue(code, host);
    }
    expect(snap().phase).toBe('final');
  });

  it('never repeats a product or headline within a game', () => {
    engine.startGame(code, host);
    const headlines: string[] = [];
    const hands = engine.debugRoom(code).state.upcoming.flatMap((round) => round.builder.hands.products);
    // Everyone starts with six different products.
    expect(new Set(hands).size).toBe(24);
    buildAll();
    for (let round = 0; round < 4; round += 1) {
      headlines.push(snap().round!.premise!.headline);
      for (let step = 0; step < 40 && snap().roundIndex === round && snap().phase !== 'final'; step += 1) advance(30_000);
    }
    expect(new Set(headlines).size).toBe(4);
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

  it('sends a room saved mid-round by an older version back to its lobby, and moves old timers to the stage clock', () => {
    const storage = new MemoryStorage();
    const first = new DealEngine(storage, { rng: seeded(1), now: () => now });
    const custom = first.createRoom('http://lan');
    const preset = first.createRoom('http://lan');
    for (const name of ['A', 'B', 'C', 'D']) {
      const joined = first.joinPlayer(custom.roomCode, { ...JOIN, roomCode: custom.roomCode, name });
      first.setLook(custom.roomCode, joined.playerId, { presetId: 'fancy-cat' });
    }
    first.updateSettings(custom.roomCode, custom.hostToken, { tutorial: false });
    first.startGame(custom.roomCode, custom.hostToken);
    first.continue(custom.roomCode, custom.hostToken);
    // Rewrite the save as the fact-card version would have written it.
    const keys = [...Array(storage.length).keys()].map((i) => storage.key(i)!).filter((item) => storage.getItem(item)!.includes(custom.roomCode));
    for (const key of keys) {
    const saved = JSON.parse(storage.getItem(key)!);
    for (const room of saved.rooms) {
      const state = room.state;
      if (state.code === custom.roomCode) {
        state.phase = 'discussion';
        state.settings.timerPreset = 'custom';
        state.settings.timers = { prep: 50, pitch: 90, discussion: 150, offers: 40, tiebreaker: 25 };
        for (const round of [state.round, ...state.upcoming].filter(Boolean)) { delete round.out; round.dossier = []; round.publicFacts = []; }
      } else {
        state.settings.timers = { prep: 35, pitch: 60, discussion: 120, offers: 30, tiebreaker: 15 };
        state.settings.timerPreset = 'quick';
        state.settings.complexity = 'simple';
      }
    }
    storage.setItem(key, JSON.stringify(saved));
    }
    const second = new DealEngine(storage, { rng: seeded(2), now: () => now });
    const restored = second.snapshot(custom.roomCode);
    expect(restored.phase).toBe('lobby');
    expect(restored.round).toBeNull();
    expect(restored.players).toHaveLength(4);
    // Custom timers keep what still exists; the stage clock and the new truth/scores timers get their defaults.
    expect(restored.settings.timers).toEqual({ prep: 50, stage: 180, offers: 40, reveal: 10, scores: 5, tiebreaker: 25 });
    // A named preset now only means a stage clock.
    const quick = second.snapshot(preset.roomCode).settings;
    expect(quick.timers).toEqual({ prep: 35, stage: 120, offers: 30, reveal: 10, scores: 5, tiebreaker: 15 });
    expect(quick.timerPreset).toBe('quick');
    expect(quick.tone).toBe('crude');
    expect('complexity' in quick).toBe(false);
  });

  it('sends a finished scorecard-era game (no bids to show) back to its lobby', () => {
    const storage = new MemoryStorage();
    const first = new DealEngine(storage, { rng: seeded(1), now: () => now });
    const credentials = first.createRoom('http://lan');
    for (const name of ['A', 'B', 'C', 'D']) {
      const joined = first.joinPlayer(credentials.roomCode, { ...JOIN, roomCode: credentials.roomCode, name });
      first.setLook(credentials.roomCode, joined.playerId, { presetId: 'fancy-cat' });
    }
    const key = [...Array(storage.length).keys()].map((i) => storage.key(i)!).find((item) => storage.getItem(item)!.includes(credentials.roomCode))!;
    const saved = JSON.parse(storage.getItem(key)!);
    for (const room of saved.rooms) {
      room.state.phase = 'gameover';
      room.state.history = [{ verdict: 'good', explanation: '', laterLine: '', scorecard: [], deal: null, offers: {}, scores: [] }];
    }
    storage.setItem(key, JSON.stringify(saved));
    const restored = new DealEngine(storage, { rng: seeded(2), now: () => now }).snapshot(credentials.roomCode);
    expect(restored.phase).toBe('lobby');
    expect(restored.history).toEqual([]);
    expect(restored.players).toHaveLength(4);
  });

  it('rejects bad photos and settings changes mid-game', () => {
    expect(() => engine.setLook(code, ids[0], { photo: 'javascript:alert(1)' })).toThrow();
    engine.startGame(code, host);
    expect(() => engine.updateSettings(code, host, { timerPreset: 'quick' })).toThrow(/between games/);
    engine.updateSettings(code, host, { audio: { music: 10, effects: 20, narration: 30, muted: true } });
    expect(snap().settings.audio.music).toBe(10);
  });

  it('applies timer steps on top of a preset, in order, within limits', () => {
    engine.updateSettings(code, host, { timerPreset: 'quick' });
    // Presets only change the stage clock.
    expect(snap().settings.timers).toEqual({ prep: 90, stage: 120, offers: 45, reveal: 10, scores: 5, tiebreaker: 20 });
    engine.updateSettings(code, host, { timerSteps: { reveal: 5, scores: -10 } });
    expect(snap().settings.timers.reveal).toBe(15);
    expect(snap().settings.timers.scores).toBe(3);
    expect(snap().settings.timerPreset).toBe('quick');
    for (let i = 0; i < 4; i++) engine.updateSettings(code, host, { timerSteps: { stage: -30 } });
    expect(snap().settings.timers.stage).toBe(60);
    expect(snap().settings.timerPreset).toBe('custom');
    engine.updateSettings(code, host, { timerSteps: { stage: 60 } });
    expect(snap().settings.timerPreset).toBe('quick');
    for (let i = 0; i < 30; i++) engine.updateSettings(code, host, { timerSteps: { stage: 30, prep: 5 } });
    expect(snap().settings.timers.stage).toBe(600);
    expect(snap().settings.timers.prep).toBe(180);
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

  it('lets a player leave for good from their phone, passing host controls on', () => {
    expect(snap().vipId).toBe(ids[0]);
    engine.leaveGame(code, ids[0]);
    expect(snap().players.map((player) => player.id)).toEqual(ids.slice(1));
    expect(snap().vipId).toBe(ids[1]);
    const fresh = engine.joinPlayer(code, { ...JOIN, roomCode: code, name: 'Eve' });
    engine.setLook(code, fresh.playerId, { presetId: 'cool-fox' });
    engine.startGame(code, host);
    expect(snap().phase).toBe('build');
  });

  it('sends everyone back to the lobby when a player leaves mid-game', () => {
    engine.startGame(code, host);
    buildAll();
    expect(snap().phase).toBe('stage');
    engine.leaveGame(code, ids[3]);
    expect(snap().phase).toBe('lobby');
    expect(snap().players).toHaveLength(3);
    // Leaving twice (a retried request) is harmless.
    expect(() => engine.leaveGame(code, ids[3])).not.toThrow();
  });

  it('lets the first player start the game from their phone, and nobody else', () => {
    expect(() => engine.vipAction(code, ids[1], 'start', {})).toThrow(/first player/);
    engine.vipAction(code, ids[0], 'start', {});
    expect(snap().phase).not.toBe('lobby');
    expect(() => engine.vipAction(code, ids[0], 'new-game', {})).toThrow();
  });

  it('lets players rename themselves until the game starts', () => {
    engine.setSayAs(code, host, ids[0], 'Ay-vah');
    engine.setName(code, ids[0], '  Ava   Rose ');
    const renamed = snap().players.find((player) => player.id === ids[0])!;
    expect(renamed.name).toBe('Ava Rose');
    expect(renamed.sayAs).toBeUndefined();
    expect(() => engine.setName(code, ids[0], '   ')).toThrow(/name/);
    engine.startGame(code, host);
    expect(() => engine.setName(code, ids[0], 'Late')).toThrow();
  });

  it('slows down seat code guessing', () => {
    const wrong = snap().players.some((player) => player.seatCode === '9999') ? '9998' : '9999';
    for (let i = 0; i < 10; i++) expect(() => engine.joinPlayer(code, { ...JOIN, roomCode: code, name: 'X', seatCode: wrong })).toThrow(/does not match/);
    expect(() => engine.joinPlayer(code, { ...JOIN, roomCode: code, name: 'X', seatCode: wrong })).toThrow(/Too many tries/);
  });
});
