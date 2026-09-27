// The secret scorecard: four fixed checks, each ✅ or ❌ with one short plain line.
// Lines can name the product ({p}) and its customers ({customers}, {Customers}, {bought}); `forms` keeps a line
// off products it can't describe (no crashing apps for cupcakes). Tone works like everywhere else.
import type { CategoryId, ProductForm, Tone } from '../types';

export interface CategoryInfo {
  id: CategoryId;
  /** The question on the tile. */
  label: string;
  /** One word for tight spots. */
  short: string;
  icon: string;
  /** What ✅ and ❌ mean for this check ("Any trouble?" ✅ is "All clear"). */
  okWord: string;
  badWord: string;
  /** Said in the reveal explanation when this check fails. */
  problem: string;
}

export const CATEGORIES: readonly CategoryInfo[] = [
  { id: 'works', label: 'Does it work?', short: 'Works', icon: '🔧', okWord: 'Yes', badWord: 'No', problem: 'it barely works' },
  { id: 'demand', label: 'Do people want it?', short: 'Demand', icon: '🙋', okWord: 'Yes', badWord: 'No', problem: 'hardly anyone wants it' },
  { id: 'money', label: 'Does it make money?', short: 'Money', icon: '💰', okWord: 'Yes', badWord: 'No', problem: 'it loses money' },
  { id: 'trouble', label: 'Any trouble?', short: 'Trouble', icon: '🚨', okWord: 'All clear', badWord: 'Trouble', problem: 'it is in real trouble' }
];

export function categoryInfo(id: CategoryId): CategoryInfo {
  return CATEGORIES.find((item) => item.id === id) ?? CATEGORIES[0];
}

export interface ScoreLine {
  id: string;
  category: CategoryId;
  ok: boolean;
  text: string;
  forms?: readonly ProductForm[];
  tone?: Tone;
}

const DUR: readonly ProductForm[] = ['gadget', 'goods', 'pet', 'rental'];
const PHYS: readonly ProductForm[] = ['food', 'gadget', 'goods', 'pet'];
const LIVE: readonly ProductForm[] = ['service', 'event'];
const BOOKED: readonly ProductForm[] = ['service', 'event', 'rental'];
const NOT_FOOD: readonly ProductForm[] = ['gadget', 'goods', 'pet', 'service', 'rental', 'digital', 'event'];

const line = (id: string, category: CategoryId, ok: boolean, text: string, extra: { forms?: readonly ProductForm[]; tone?: Tone } = {}): ScoreLine => ({ id, category, ok, text, ...extra });

export const SCORE_LINES: readonly ScoreLine[] = [
  // Does it work? ✅
  line('w+works', 'works', true, 'Works exactly like it says'),
  line('w+tests', 'works', true, 'Passed every test, even the silly ones'),
  line('w+500', 'works', true, 'Tested 500 times without a problem'),
  line('w+setup', 'works', true, 'Easy to use in under a minute'),
  line('w+fans', 'works', true, 'Testers could not find a single flaw'),
  line('w+tough', 'works', true, 'Built tough: still fine after a year', { forms: DUR }),
  line('w+crash', 'works', true, 'Never crashes, even on old phones', { forms: ['digital'] }),
  line('w+taste', 'works', true, 'Tastes great, even the next day', { forms: ['food'] }),
  line('w+fresh', 'works', true, 'Stays fresh for weeks', { forms: ['food'] }),
  line('w+schedule', 'works', true, 'Runs smoothly and always on time', { forms: BOOKED }),
  line('w+pets', 'works', true, 'Pets actually use it, no bribes needed', { forms: ['pet'] }),
  line('w+spooky', 'works', true, 'Works so well it is a little spooky', { tone: 'silly' }),
  // Does it work? ❌
  line('w-half', 'works', false, 'Only works about half the time'),
  line('w-manual', 'works', false, 'The instructions are 40 pages long', { forms: ['gadget', 'goods', 'pet', 'rental', 'digital'] }),
  line('w-napkin', 'works', false, 'Still just a drawing on a napkin'),
  line('w-confused', 'works', false, 'Testers could not figure out how to use it'),
  line('w-week', 'works', false, 'Breaks after about a week', { forms: DUR }),
  line('w-repair', 'works', false, 'Needs a repair after almost every use', { forms: DUR }),
  line('w-crashes', 'works', false, 'Crashes every time you open it', { forms: ['digital'] }),
  line('w-stale', 'works', false, 'Goes stale in two days', { forms: ['food'] }),
  line('w-taste', 'works', false, 'Tastes a bit like cardboard', { forms: ['food'] }),
  line('w-late', 'works', false, 'Runs late. Every single time.', { forms: BOOKED }),
  line('w-scared', 'works', false, 'Most pets are scared of it', { forms: ['pet'] }),
  line('w-goose', 'works', false, 'Makes a noise like a sad goose', { tone: 'silly', forms: NOT_FOOD }),
  line('w-smell', 'works', false, 'Smells so bad nobody could test it', { tone: 'crude' }),

  // Do people want it? ✅
  line('d+back', 'demand', true, '{Customers} keep coming back for more'),
  line('d+sold-out', 'demand', true, 'Sold out on the first weekend'),
  line('d+waitlist', 'demand', true, 'A waiting list of 2,000 people'),
  line('d+stars', 'demand', true, 'Five-star reviews keep pouring in'),
  line('d+kids', 'demand', true, 'Kids beg their parents for it'),
  line('d+friends', 'demand', true, 'Everyone who tries it tells a friend'),
  line('d+stores', 'demand', true, 'Stores keep calling to order more', { forms: PHYS }),
  line('d+booked', 'demand', true, 'Booked solid every weekend', { forms: BOOKED }),
  line('d+downloads', 'demand', true, 'Downloaded 50,000 times in a month', { forms: ['digital'] }),
  line('d+chef', 'demand', true, 'A famous chef will not stop talking about it', { forms: ['food'] }),
  line('d+grandmas', 'demand', true, 'Grandmas are fighting over the last one', { tone: 'silly' }),
  // Do people want it? ❌
  line('d-nobody', 'demand', false, 'Almost nobody has {bought} it'),
  line('d-once', 'demand', false, 'Most {customers} try it once and never return'),
  line('d-twelve', 'demand', false, 'Sold 12 in a year, mostly to family'),
  line('d-why', 'demand', false, 'Reviews say "Why does this exist?"'),
  line('d-idea', 'demand', false, 'People like the idea, not the real thing'),
  line('d-returned', 'demand', false, 'Stores sent them back unopened', { forms: PHYS }),
  line('d-empty', 'demand', false, 'Most weekends are still empty', { forms: BOOKED }),
  line('d-deleted', 'demand', false, 'Most users delete it within a day', { forms: ['digital'] }),
  line('d-mom', 'demand', false, 'Even the founder\'s mom said "no thanks"', { tone: 'silly' }),

  // Does it make money? ✅
  line('m+every-sale', 'money', true, 'Earns money on every single sale'),
  line('m+pennies', 'money', true, 'Costs pennies to make, sells for a lot', { forms: PHYS }),
  line('m+pays', 'money', true, 'Already paying for itself'),
  line('m+extra', 'money', true, '{Customers} happily pay extra for it'),
  line('m+monthly', 'money', true, 'Brings in $40,000 a month'),
  line('m+cheap', 'money', true, 'Cheap to run and easy to grow'),
  line('m+users', 'money', true, 'Each new user costs almost nothing', { forms: ['digital'] }),
  line('m+month', 'money', true, 'Each one pays for itself in a month', { forms: ['rental'] }),
  line('m+prices', 'money', true, 'Tickets sell out even at high prices', { forms: LIVE }),
  line('m+vault', 'money', true, 'The founder needed a bigger piggy bank', { tone: 'silly' }),
  // Does it make money? ❌
  line('m-costs', 'money', false, 'Costs more to make than it sells for'),
  line('m-loses', 'money', false, 'Loses money on every sale'),
  line('m-million', 'money', false, 'Needs another $1 million just to survive'),
  line('m-dollar', 'money', false, '{Customers} will not pay more than a dollar'),
  line('m-billboard', 'money', false, 'Spent everything on a giant billboard'),
  line('m-shipping', 'money', false, 'Shipping costs more than the product', { forms: PHYS }),
  line('m-repairs', 'money', false, 'Repairs eat up all the money', { forms: DUR }),
  line('m-staff', 'money', false, 'Staff cost more than the tickets bring in', { forms: LIVE }),
  line('m-free', 'money', false, 'It is free, and nobody pays for extras', { forms: ['digital'] }),
  line('m-logo', 'money', false, 'Most of the money went to a fancy logo', { tone: 'silly' }),

  // Any trouble? ✅ (no trouble)
  line('t+safety', 'trouble', true, 'Passed every safety check'),
  line('t+complaints', 'trouble', true, 'Zero complaints so far'),
  line('t+drama', 'trouble', true, 'No lawsuits, no recalls, no drama'),
  line('t+kids', 'trouble', true, 'Safe for kids and grandmas alike'),
  line('t+patent', 'trouble', true, 'Has a patent, so nobody can copy it'),
  line('t+inspectors', 'trouble', true, 'Health inspectors gave it top marks', { forms: ['food'] }),
  line('t+privacy', 'trouble', true, 'Keeps every user\'s data locked up tight', { forms: ['digital'] }),
  line('t+awesome', 'trouble', true, 'Only complaint so far: "too awesome"', { tone: 'silly' }),
  // Any trouble? ❌
  line('t-sued', 'trouble', false, 'Being sued by a very angry customer'),
  line('t-stole', 'trouble', false, 'A big company says they stole the idea'),
  line('t-reviews', 'trouble', false, 'Hundreds of one-star reviews last month'),
  line('t-news', 'trouble', false, 'A news story called it "a disaster"'),
  line('t-unchecked', 'trouble', false, 'Nobody checked if it is actually safe'),
  line('t-fire', 'trouble', false, 'A whole batch was recalled for overheating', { forms: ['gadget'] }),
  line('t-inspectors', 'trouble', false, 'Health inspectors found a problem', { forms: ['food'] }),
  line('t-stuck', 'trouble', false, 'Pets keep getting stuck in it', { forms: ['pet'] }),
  line('t-ankle', 'trouble', false, 'A guest sprained an ankle last month', { forms: BOOKED }),
  line('t-leak', 'trouble', false, 'Leaked 10,000 users\' passwords', { forms: ['digital'] }),
  line('t-banned', 'trouble', false, 'Banned in three countries for being too loud', { tone: 'silly' }),
  line('t-neighbors', 'trouble', false, 'The neighbors keep complaining about the smell', { tone: 'crude' })
];

/** Optional talking points on shark phones, one small set per check. */
export const CATEGORY_QUESTIONS: readonly { id: string; category: CategoryId; text: string; tone?: Tone }[] = [
  { id: 'qw-show', category: 'works', text: 'Show me how it works.' },
  { id: 'qw-break', category: 'works', text: 'What happens when it breaks?' },
  { id: 'qw-tested', category: 'works', text: 'Has anyone actually tested it?' },
  { id: 'qd-who', category: 'demand', text: 'Who actually buys this?' },
  { id: 'qd-sold', category: 'demand', text: 'How many have you sold?' },
  { id: 'qd-reviews', category: 'demand', text: 'What do the reviews say?' },
  { id: 'qm-cost', category: 'money', text: 'What does each one cost you?' },
  { id: 'qm-charge', category: 'money', text: 'What do you charge for it?' },
  { id: 'qm-spend', category: 'money', text: 'What would you do with my money?' },
  { id: 'qt-safe', category: 'trouble', text: 'Is it safe?' },
  { id: 'qt-complaints', category: 'trouble', text: 'Any complaints or lawsuits?' },
  { id: 'qt-copy', category: 'trouble', text: 'What stops someone copying you?' },
  { id: 'qt-sweat', category: 'trouble', text: 'Why are you sweating?', tone: 'silly' },
  { id: 'qt-smell', category: 'trouble', text: 'Be honest. Does it smell?', tone: 'crude' }
];

const WORDS: Record<ProductForm, { customers: string; bought: string }> = {
  food: { customers: 'customers', bought: 'bought' },
  gadget: { customers: 'customers', bought: 'bought' },
  goods: { customers: 'customers', bought: 'bought' },
  pet: { customers: 'pet owners', bought: 'bought' },
  service: { customers: 'customers', bought: 'booked' },
  rental: { customers: 'renters', bought: 'rented' },
  digital: { customers: 'users', bought: 'downloaded' },
  event: { customers: 'guests', bought: 'booked' }
};

export function fillTokens(text: string, form: ProductForm, short: string): string {
  const words = WORDS[form];
  const capital = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);
  return text
    .replaceAll('{p}', short)
    .replaceAll('{Customers}', capital(words.customers))
    .replaceAll('{customers}', words.customers)
    .replaceAll('{bought}', words.bought);
}
