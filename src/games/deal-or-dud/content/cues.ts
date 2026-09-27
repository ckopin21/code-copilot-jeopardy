// Short text pools shown on phones and the TV. Tone defaults to 'clean'.
import type { Tone, Verdict } from '../types';

export interface ToneLine { id: string; text: string; tone?: Tone }

/** Presenter's optional pitch nudges. */
export const PITCH_CUES: readonly ToneLine[] = [
  { id: 'pc-problem', text: 'Start with the problem your product solves.' },
  { id: 'pc-name', text: 'Say the business name like it is already famous.' },
  { id: 'pc-customer', text: 'Describe your happiest customer.' },
  { id: 'pc-strength', text: 'Lead with your best ✅ check.' },
  { id: 'pc-demo', text: 'Act out how someone uses it.' },
  { id: 'pc-dream', text: 'Tell them where the company will be in five years.' },
  { id: 'pc-ask', text: 'Tell the sharks exactly what you want from them.' },
  { id: 'pc-origin', text: 'Share the (made-up) moment you invented it.' },
  { id: 'pc-weak', text: 'Admit one small ❌ before a shark finds it.' },
  { id: 'pc-compare', text: 'Explain why it beats what people use now.' },
  { id: 'pc-slogan', text: 'Invent a slogan on the spot.' },
  { id: 'pc-pause', text: 'Pause dramatically. Let it sink in.' },
  { id: 'pc-gift', text: 'Explain why it makes the perfect gift.' },
  { id: 'pc-testimonial', text: 'Quote a (fictional) customer review.' },
  { id: 'pc-dramatic', text: 'Speak like a movie trailer narrator.', tone: 'silly' },
  { id: 'pc-sweat', text: 'Wipe your forehead. Confidently.', tone: 'silly' },
  { id: 'pc-grandma', text: 'Claim your grandma already invested. Emotionally.', tone: 'silly' },
  { id: 'pc-smell', text: 'Describe what it smells like. In detail.', tone: 'crude' },
  { id: 'pc-burp', text: 'Explain why it will not make anyone burp. Probably.', tone: 'crude' }
];

/** "What happened later" lines. {name} = business name, {short} = product short name. */
export const LATER_LINES: readonly (ToneLine & { verdict: Verdict })[] = [
  { id: 'lg-1', verdict: 'good', text: 'Two years later, {name} opened its fifth location.' },
  { id: 'lg-2', verdict: 'good', text: '{name} was named "Most Surprising Success" by a business magazine.' },
  { id: 'lg-3', verdict: 'good', text: 'The investor bought a boat and named it after {name}.' },
  { id: 'lg-4', verdict: 'good', text: 'A school now takes field trips to the {name} factory.' },
  { id: 'lg-5', verdict: 'good', text: '{name} became the gift everyone gives and nobody expected to love.' },
  { id: 'lg-6', verdict: 'good', text: 'Sales tripled when a grandma posted a review that went viral.' },
  { id: 'lg-7', verdict: 'good', text: '{name} now has a waiting list longer than the lunch line.' },
  { id: 'lg-8', verdict: 'good', text: 'The founder bought matching jackets for the whole team.' },
  { id: 'lg-9', verdict: 'good', text: 'A museum asked to display the very first {short}.' },
  { id: 'lg-10', verdict: 'good', text: '{name} expanded to three countries and one very enthusiastic island.' },
  { id: 'lg-s1', verdict: 'good', tone: 'silly', text: 'The {short} got their own cartoon show. Season two is confirmed.' },
  { id: 'lg-s2', verdict: 'good', tone: 'silly', text: 'A llama became the official mascot of {name}. Profits soared.' },
  { id: 'lg-s3', verdict: 'good', tone: 'silly', text: '{name} stock went up so fast the chart needed a second screen.' },
  { id: 'lg-c1', verdict: 'good', tone: 'crude', text: 'The smell faded, but the profits did not.' },
  { id: 'lb-1', verdict: 'bad', text: 'A year later, {name} sold its last {short} at a yard sale.' },
  { id: 'lb-2', verdict: 'bad', text: 'The office is now a smoothie shop.' },
  { id: 'lb-3', verdict: 'bad', text: '{name} closed, but the founder kept one {short} as a reminder.' },
  { id: 'lb-4', verdict: 'bad', text: 'The warehouse is still full of {short}. Anyone want some?' },
  { id: 'lb-5', verdict: 'bad', text: 'The company website now just says "We tried."' },
  { id: 'lb-6', verdict: 'bad', text: '{name} became a business class example. Of what not to do.' },
  { id: 'lb-7', verdict: 'bad', text: 'The investor now changes the subject whenever {name} comes up.' },
  { id: 'lb-8', verdict: 'bad', text: 'The last {short} was spotted in a lost-and-found bin.' },
  { id: 'lb-9', verdict: 'bad', text: '{name} ran out of money before the second birthday party.' },
  { id: 'lb-10', verdict: 'bad', text: 'The founder now sells lemonade. It is going much better.' },
  { id: 'lb-s1', verdict: 'bad', tone: 'silly', text: 'Archaeologists in the year 3000 will be very confused by {name}.' },
  { id: 'lb-s2', verdict: 'bad', tone: 'silly', text: 'The {short} are now used as doorstops across the nation.' },
  { id: 'lb-s3', verdict: 'bad', tone: 'silly', text: 'The mascot quit and joined a rival company.' },
  { id: 'lb-c1', verdict: 'bad', tone: 'crude', text: 'The warehouse still smells. Nobody knows why.' },
  { id: 'lb-c2', verdict: 'bad', tone: 'crude', text: 'The leftover {short} were donated to a very unlucky gym.' }
];

/** Suffixes for generated business names. */
export const NAME_PATTERNS: readonly ToneLine[] = [
  { id: 'np-ly', text: '{root}ly' },
  { id: 'np-co', text: '{root} & Co.' },
  { id: 'np-lab', text: 'The {root} Lab' },
  { id: 'np-hub', text: '{root}Hub' },
  { id: 'np-works', text: '{root} Works' },
  { id: 'np-ify', text: '{root}ify' },
  { id: 'np-express', text: '{root} Express' },
  { id: 'np-bros', text: '{root} Bros.' },
  { id: 'np-supreme', text: '{root} Supreme' },
  { id: 'np-pal', text: '{root}Pal' },
  { id: 'np-nation', text: '{root} Nation' },
  { id: 'np-duo', text: '{mod}{root}' },
  { id: 'np-duo2', text: '{mod} {root} Co.' },
  { id: 'np-legend', text: 'Legendary {root}', tone: 'silly' },
  { id: 'np-maybe', text: '{root} (Probably Fine)', tone: 'silly' }
];

export interface AvatarPreset { id: string; label: string; emoji: string; prop?: string; bg: string; tone?: Tone }

export const AVATAR_PRESETS: readonly AvatarPreset[] = [
  { id: 'tycoon-shark', label: 'Tycoon Shark', emoji: '🦈', prop: '🎩', bg: '#1f6fb2' },
  { id: 'fancy-cat', label: 'Fancy Cat', emoji: '🐱', prop: '🧐', bg: '#9b59b6' },
  { id: 'budget-owl', label: 'Budget Owl', emoji: '🦉', prop: '👓', bg: '#8e6b3e' },
  { id: 'hype-frog', label: 'Hype Frog', emoji: '🐸', prop: '📣', bg: '#2e9e5b' },
  { id: 'deal-dog', label: 'Deal Dog', emoji: '🐶', prop: '💼', bg: '#c0772d' },
  { id: 'rich-penguin', label: 'Rich Penguin', emoji: '🐧', prop: '💰', bg: '#34495e' },
  { id: 'robot-ceo', label: 'Robot CEO', emoji: '🤖', prop: '📈', bg: '#4a6fa5' },
  { id: 'queen-bee', label: 'Queen Bee', emoji: '🐝', prop: '👑', bg: '#d4a017' },
  { id: 'cool-fox', label: 'Cool Fox', emoji: '🦊', prop: '🕶️', bg: '#d35400' },
  { id: 'wizard-banker', label: 'Wizard Banker', emoji: '🧙', prop: '🪙', bg: '#5b3f8c' },
  { id: 'astro-investor', label: 'Astro Investor', emoji: '👩‍🚀', prop: '🚀', bg: '#1b2a4a' },
  { id: 'chef-boss', label: 'Chef Boss', emoji: '🧑‍🍳', prop: '🍕', bg: '#b03a2e' },
  { id: 'panda-pro', label: 'Panda Pro', emoji: '🐼', prop: '📊', bg: '#2c3e50' },
  { id: 'octo-accountant', label: 'Octo Accountant', emoji: '🐙', prop: '🧮', bg: '#8e44ad' },
  { id: 'lion-closer', label: 'Lion Closer', emoji: '🦁', prop: '🤝', bg: '#b9770e' },
  { id: 'unicorn-founder', label: 'Unicorn Founder', emoji: '🦄', prop: '✨', bg: '#c0398e' },
  { id: 'turtle-saver', label: 'Slow & Steady', emoji: '🐢', prop: '🏦', bg: '#1e8449' },
  { id: 'dino-mogul', label: 'Dino Mogul', emoji: '🦖', prop: '💎', bg: '#117a65' },
  { id: 'llama-drama', label: 'Llama Drama', emoji: '🦙', prop: '🎭', bg: '#a04000', tone: 'silly' },
  { id: 'nervous-hamster', label: 'Nervous Hamster', emoji: '🐹', prop: '💦', bg: '#ca6f1e', tone: 'silly' },
  { id: 'suspicious-raccoon', label: 'Suspicious Raccoon', emoji: '🦝', prop: '🔍', bg: '#566573', tone: 'silly' },
  { id: 'ghost-intern', label: 'Ghost Intern', emoji: '👻', prop: '📋', bg: '#5d6d7e', tone: 'silly' },
  { id: 'clown-cfo', label: 'Clown CFO', emoji: '🤡', prop: '🎈', bg: '#cb4335', tone: 'silly' },
  { id: 'toot-tycoon', label: 'Toot Tycoon', emoji: '💨', prop: '🎩', bg: '#7d6608', tone: 'crude' },
  { id: 'stinky-skunk', label: 'Stinky Skunk', emoji: '🦨', prop: '💼', bg: '#212f3c', tone: 'crude' }
];

export interface ForecastCard { id: string; title: string; clues: readonly string[]; question: string; answer: number; tone?: Tone }

/** Tiebreaker cards: guess the number after one year. Clues make a sensible estimate possible. */
export const FORECAST_CARDS: readonly ForecastCard[] = [
  { id: 'fc-lemonade', title: 'Beachside Lemonade Stand', clues: ['About 40 customers came each summer day.', 'It is open only in summer, about 90 days.', 'Half the customers were regulars.'], question: 'How many cups did it sell in one year?', answer: 3600 },
  { id: 'fc-dogwalk', title: 'Weekend Dog Walkers', clues: ['They walk 12 dogs every weekend.', 'There are about 50 weekends in a year.', 'Every dog gets one walk per weekend.'], question: 'How many dog walks after one year?', answer: 600 },
  { id: 'fc-app', title: 'Study Buddy App', clues: ['It started with 500 users.', 'It gained about 200 new users every month.', 'Almost nobody quit.'], question: 'How many users after one year?', answer: 2900 },
  { id: 'fc-bakery', title: 'Tiny Cupcake Bakery', clues: ['It sells about 60 cupcakes a day.', 'It is open 6 days a week.', 'It closes for 2 weeks in winter.'], question: 'How many cupcakes in one year?', answer: 18000 },
  { id: 'fc-bikes', title: 'Campus Bike Rentals', clues: ['It has 30 bikes.', 'Each bike is rented about 4 times a week.', 'It runs all year.'], question: 'How many rentals in one year?', answer: 6240 },
  { id: 'fc-podcast', title: 'Cat Facts Podcast', clues: ['First episode: 100 listeners.', 'Listeners doubled every 3 months.', 'It kept the same pace all year.'], question: 'How many listeners per episode after one year?', answer: 1600 },
  { id: 'fc-mini-golf', title: 'Glow Mini Golf', clues: ['About 120 players on weekend days.', 'About 30 players on weekdays.', 'Open all year.'], question: 'How many players in one year?', answer: 20000 },
  { id: 'fc-socks', title: 'Mystery Sock Club', clues: ['It started with 50 members.', 'It adds about 25 members a month.', 'Each member gets one pair a month.'], question: 'How many members after one year?', answer: 350 },
  { id: 'fc-karaoke', title: 'Karaoke Truck', clues: ['It does about 3 parties a week.', 'Each party has about 20 singers.', 'It takes a month off in winter.'], question: 'How many singers in one year?', answer: 2900 },
  { id: 'fc-tutor', title: 'Math Tutor Squad', clues: ['8 tutors each help 5 students a week.', 'School runs about 36 weeks.', 'Summer is closed.'], question: 'How many tutoring sessions in one year?', answer: 1440 },
  { id: 'fc-plants', title: 'Desk Plant Delivery', clues: ['It delivers about 15 plants a day.', 'It works 5 days a week.', 'Sales double in December.'], question: 'How many plants in one year?', answer: 4200 },
  { id: 'fc-escape', title: 'Pirate Escape Room', clues: ['It runs 5 games a day.', 'Each game has about 6 players.', 'It is open 300 days a year.'], question: 'How many players in one year?', answer: 9000 },
  { id: 'fc-llama', title: 'Llama Yoga', tone: 'silly', clues: ['Two classes a week.', 'About 15 people per class.', 'The llamas take August off.'], question: 'How many yoga visits in one year?', answer: 1440 },
  { id: 'fc-haunted', title: 'Haunted Hayride', tone: 'silly', clues: ['It runs only in October, 31 nights.', 'About 150 riders a night.', 'Rain cancelled 3 nights.'], question: 'How many riders in one year?', answer: 4200 },
  { id: 'fc-whoopee', title: 'Whoopee Cushion Club', tone: 'crude', clues: ['It started with 80 members.', 'It gains 40 members a month.', 'Nobody has ever quit.'], question: 'How many members after one year?', answer: 560 }
];
