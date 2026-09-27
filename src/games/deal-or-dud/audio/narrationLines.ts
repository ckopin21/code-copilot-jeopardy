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
  'round-4': ['Round four!'],
  'round-5': ['Round five!'],
  'round-6': ['Round six!'],
  'round-7': ['Round seven!'],
  'round-8': ['Round eight!'],
  'round-9': ['Round nine!'],
  'round-10': ['Round ten!'],
  'round-11': ['Round eleven!'],
  'round-final': ['Final round!'],
  'hot-seat': ['Our next entrepreneur is in the hot seat!'],
  build: ['Everybody, build a business on your phone!', 'Time to build something ridiculous. Everyone, grab your phones!'],
  'build-10': ['Ten seconds! Lock in that product.'],
  'next-pass': [
    "That's everyone! But the tank isn't closed yet. Time to build something even worse!",
    'Give it up for those pitches! Now, everybody, build a brand new business.',
    'The sharks are still hungry. Grab your phones and invent a new product!'
  ],
  'last-pass': ["Last time around! Build your final masterpiece, and make it count."],
  pitch: ['Please welcome our next entrepreneur!'],
  'pitch-go': ['The floor is yours. Sell it!', 'Your pitch starts now!'],
  'questions-open': ['Questions open!', 'Sharks, questions are open!'],
  out: ['That shark is out!'],
  'all-out': ['All three sharks are out!'],
  'stage-60': ['One minute left on stage.'],
  'stage-30': ['Thirty seconds left!'],
  'stage-10': ['Ten seconds! Wrap it up.'],
  bids: ['Sharks, lock in your offers!', 'Time to put your money where your mouth is. Lock in those bids!'],
  'bids-10': ['Ten seconds to lock in!'],
  'offers-reveal': ["Let's see those offers."],
  'no-offers': ['Not a single offer!'],
  'raised-1': ['One hundred thousand dollars raised!'],
  'raised-2': ['Two hundred thousand dollars raised!'],
  'raised-3': ['Three hundred thousand dollars raised!'],
  'raised-4': ['Four hundred thousand dollars raised!'],
  'raised-5': ['Five hundred thousand dollars raised!'],
  'raised-6': ['Six hundred thousand dollars raised!'],
  'raised-7': ['Seven hundred thousand dollars raised!'],
  'raised-8': ['Eight hundred thousand dollars raised!'],
  'raised-9': ['Nine hundred thousand dollars raised!'],
  'raised-10': ['One million dollars raised!'],
  'raised-11': ['One point one million dollars raised!'],
  'raised-12': ['One point two million dollars raised!'],
  'raised-13': ['One point three million dollars raised!'],
  'raised-14': ['One point four million dollars raised!'],
  'raised-15': ['One point five million dollars raised!'],
  'deal-in': ['We have a deal!'],
  'both-in': ['Two sharks want in!'],
  'all-in': ['All three sharks want in!'],
  scores: ["Let's check the scoreboard."],
  'neck-and-neck': ["It's neck and neck at the top!"],
  final: ["That's the game! Here are the final scores."],
  vote: ['Time to vote! Grab your phones.', 'Before the final scores, it is time to vote!'],
  'votes-in': ['The votes are in!'],
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

/**
 * Stage intros: just the presenter, never the product or company (the pitch reveals those). Each round gets a
 * different one (see `introVariant`).
 */
export const PITCH_INTROS: readonly ((name: string) => string)[] = [
  (name) => `Please welcome our next entrepreneur, ${name}!`,
  (name) => `Sharks, get ready. Here comes ${name}!`,
  (name) => `Next up in the tank, it's ${name}!`,
  (name) => `Hold on to your wallets. It's ${name}!`,
  (name) => `Give it up for ${name}!`,
  (name) => `Our next brave founder is ${name}!`,
  (name) => `Step right up, ${name}!`,
  (name) => `Here comes trouble. Welcome, ${name}!`,
  (name) => `Sharks, meet your next victim. It's ${name}!`,
  (name) => `Big dreams, bigger ideas. Welcome, ${name}!`
];

/** Live lines. A null name means the line cannot be built, so the caller plays the fallback. */
export const LIVE_LINES = {
  joined: (name: string, variant = 0): LiveLine => {
    const index = ((variant % JOIN_GREETINGS.length) + JOIN_GREETINGS.length) % JOIN_GREETINGS.length;
    return { text: JOIN_GREETINGS[index](name), voice: index % 2 ? 'adam' : 'george', fallback: null };
  },
  /** Only the host's ▶ pronunciation test uses this now. */
  hotSeat: (name: string): LiveLine => ({ text: `${name}, you're in the hot seat!`, voice: 'adam', fallback: 'hot-seat' }),
  pitch: (name: string, variant = 0): LiveLine => {
    const index = ((variant % PITCH_INTROS.length) + PITCH_INTROS.length) % PITCH_INTROS.length;
    return { text: PITCH_INTROS[index](name), voice: index % 2 ? 'george' : 'adam', fallback: 'pitch' };
  },
  out: (name: string): LiveLine => ({ text: `${name} is out!`, voice: 'george', fallback: 'out' }),
  dealIn: (name: string): LiveLine => ({ text: `${name} is in!`, voice: 'adam', fallback: 'deal-in' }),
  bothIn: (first: string, second: string): LiveLine => ({ text: `${first} and ${second} both want in!`, voice: 'adam', fallback: 'both-in' }),
  leader: (name: string): LiveLine => ({ text: `${name} takes the lead!`, voice: 'george', fallback: 'scores' }),
  stillLeads: (name: string): LiveLine => ({ text: `${name} is still on top!`, voice: 'george', fallback: 'scores' }),
  winner: (name: string): LiveLine => ({ text: `${name}! Congratulations!`, voice: 'adam', fallback: 'winner' })
} as const;

export type LiveLineKind = keyof typeof LIVE_LINES;

/** Lines worth rendering in the lobby for each player so they play without a wait later. */
export const PER_PLAYER_LINES: readonly Exclude<LiveLineKind, 'pitch' | 'joined' | 'hotSeat' | 'bothIn'>[] = ['leader', 'stillLeads', 'out', 'dealIn', 'winner'];

/** "Nine hundred thousand dollars raised!" for a total in $K; null for $0 (the hosts say "Not a single offer!"). */
export function raisedLine(total: number): FixedLineId | null {
  const steps = Math.round(total / 100);
  return steps >= 1 && steps <= 15 ? `raised-${steps}` as FixedLineId : null;
}

export function liveLineUrl(line: LiveLine): string {
  return `/api/deal-or-dud/voice?voice=${line.voice}&text=${encodeURIComponent(line.text)}`;
}
