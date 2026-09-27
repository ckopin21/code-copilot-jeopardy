// Everything the two hosts say during a game (the tutorial script lives in tutorialScript.ts).
//
// Fixed lines are recorded ahead of time into public/deal-or-dud/audio/voice/ by
// scripts/deal-or-dud/render-narration.ts, once per variant and host voice, so they play even without the
// live narrator. Live lines contain player or business names and are spoken on demand by the narrator
// service through /api/deal-or-dud/voice; each has a fixed-line fallback for when that service is off.

export type HostVoice = 'adam' | 'george';
export const HOST_VOICES: readonly HostVoice[] = ['adam', 'george'];

export const FIXED_LINES = {
  welcome: ['Ladies and gentlemen, welcome to Deal or Dud!', 'Welcome to Deal or Dud, where the products are ridiculous and the money is make believe!'],
  'round-1': ['Round one!'],
  'round-2': ['Round two!'],
  'round-3': ['Round three!'],
  'round-4': ['Final round!'],
  'hot-seat': ['Our next entrepreneur is in the hot seat!'],
  build: ['Everybody, build a business on your phone!', 'Time to build something ridiculous. Everyone, grab your phones!'],
  'build-10': ['Ten seconds! Lock in that product.'],
  pitch: ['Please welcome our next entrepreneur!'],
  peeks: ['Sharks, you each get one peek.', 'Sharks, you each get one secret peek. Use it wisely!'],
  'stage-60': ['One minute left on stage.'],
  'stage-30': ['Thirty seconds left!'],
  'stage-10': ['Ten seconds! Wrap it up.'],
  bids: ['Sharks, lock in your offers!', 'Time to put your money where your mouth is. Lock in those bids!'],
  'bids-10': ['Ten seconds to lock in!'],
  'offers-reveal': ["Let's see those offers."],
  'no-offers': ['Not a single offer!'],
  tie: ["It's a tie! Time to pick a partner."],
  'verdict-good': ['It was a real deal!', "It's legit! A genuinely good business.", 'The scorecard checks out. Good business!'],
  'verdict-bad': ["It's a dud!", 'Total dud!', "The scorecard doesn't lie. It's a dud!"],
  'deal-good': ['That shark just struck gold!'],
  'deal-bad': ['Ouch. That shark just bought a dud.'],
  'missed-good': ['The sharks let a winner get away!'],
  'dodged-bad': ['Smart sharks. Nobody got burned.'],
  scores: ["Let's check the scoreboard."],
  'neck-and-neck': ["It's neck and neck at the top!"],
  final: ["That's the game! Here are the final scores."],
  tiebreaker: ['We have a tie for first! Time for a tiebreaker.'],
  'tiebreaker-10': ['Ten seconds! Lock in your guess.'],
  'winner-is': ['And the winner of Deal or Dud is...'],
  winner: ['Congratulations!']
} as const satisfies Record<string, readonly string[]>;

export type FixedLineId = keyof typeof FIXED_LINES;

/** Published path of one recorded variant of a fixed line. */
export function fixedLineFile(id: FixedLineId, variant: number, voice: HostVoice): string {
  return `voice/${id}-${variant + 1}-${voice}.mp3`;
}

/** A line with names in it, the host who says it, and what to play when it cannot be spoken live (null: say nothing). */
export interface LiveLine {
  text: string;
  voice: HostVoice;
  fallback: FixedLineId | null;
  /** Caption when it differs from what is spoken (a pronunciation spelled out for the voice). */
  caption?: string;
}

export const MAX_LIVE_TEXT = 220;

/** Makes a typed name safe to speak: drops emoji and symbols, keeps letters, digits and light punctuation. */
export function speakable(value: string): string {
  return value.normalize('NFKC').replace(/[^\p{L}\p{N}\s'’.,!?&()-]/gu, ' ').replace(/\s+/g, ' ').trim();
}

function sentence(value: string): string {
  const text = value.trim();
  return /[.!?]$/.test(text) ? text : `${text}.`;
}

/** Lobby greetings. Each seat gets a different one (see `greetingVariant`), so four players hear four lines. */
export const JOIN_GREETINGS: readonly ((name: string) => string)[] = [
  (name) => `${name} is in the building!`,
  (name) => `Here comes ${name}!`,
  (name) => `Look who just walked in. It's ${name}!`,
  (name) => `Welcome to the studio, ${name}!`,
  (name) => `${name} has arrived, checkbook in hand!`,
  (name) => `Make some noise for ${name}!`,
  (name) => `${name} is here, and ready to make a deal!`,
  (name) => `Everybody say hello to ${name}!`
];

/** Live lines. A null name means the line cannot be built, so the caller plays the fallback. */
export const LIVE_LINES = {
  joined: (name: string, variant = 0): LiveLine => {
    const index = ((variant % JOIN_GREETINGS.length) + JOIN_GREETINGS.length) % JOIN_GREETINGS.length;
    return { text: JOIN_GREETINGS[index](name), voice: index % 2 ? 'adam' : 'george', fallback: null };
  },
  /** Only the host's ▶ pronunciation test uses this now. */
  hotSeat: (name: string): LiveLine => ({ text: `${name}, you're in the hot seat!`, voice: 'adam', fallback: 'hot-seat' }),
  pitch: (name: string, business: string, headline: string): LiveLine => ({
    text: `Please welcome ${name}, founder of ${business.trim().replace(/[.!?]+$/, '')}! ${sentence(headline)}`,
    voice: 'adam', fallback: 'pitch'
  }),
  pickPartner: (name: string): LiveLine => ({ text: `It's a tie! ${name}, pick your partner.`, voice: 'george', fallback: 'tie' }),
  dealGood: (name: string): LiveLine => ({ text: `${name} just struck gold!`, voice: 'george', fallback: 'deal-good' }),
  dealBad: (name: string): LiveLine => ({ text: `Ouch. ${name} just bought a dud.`, voice: 'george', fallback: 'deal-bad' }),
  leader: (name: string): LiveLine => ({ text: `${name} takes the lead!`, voice: 'george', fallback: 'scores' }),
  stillLeads: (name: string): LiveLine => ({ text: `${name} is still on top!`, voice: 'george', fallback: 'scores' }),
  winner: (name: string): LiveLine => ({ text: `${name}! Congratulations!`, voice: 'adam', fallback: 'winner' })
} as const;

export type LiveLineKind = keyof typeof LIVE_LINES;

/** Lines worth rendering in the lobby for each player so they play without a wait later. */
export const PER_PLAYER_LINES: readonly Exclude<LiveLineKind, 'pitch' | 'joined' | 'hotSeat'>[] = ['leader', 'stillLeads', 'dealGood', 'dealBad', 'pickPartner', 'winner'];

export function liveLineUrl(line: LiveLine): string {
  return `/api/deal-or-dud/voice?voice=${line.voice}&text=${encodeURIComponent(line.text)}`;
}
