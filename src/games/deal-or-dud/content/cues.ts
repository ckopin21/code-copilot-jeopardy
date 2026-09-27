// Short text pools shown on phones and the TV. Tone defaults to 'clean'.
import type { Tone } from '../types';

export interface ToneLine { id: string; text: string; tone?: Tone }

/** Suffixes for generated business names. */
export const NAME_PATTERNS: readonly ToneLine[] = [
  { id: 'np-sons-lawyers', text: '{root} & Sons & Lawyers' },
  { id: 'np-legit', text: 'Totally Legit {root} LLC' },
  { id: 'np-not', text: 'Definitely Not {root}' },
  { id: 'np-tron', text: '{root}-Tron 3000' },
  { id: 'np-energy', text: 'Big {root} Energy' },
  { id: 'np-recalled', text: '{root}ify (Recalled)' },
  { id: 'np-syndicate', text: 'The {root} Syndicate' },
  { id: 'np-no-license', text: '{root} Without a License' },
  { id: 'np-zilla', text: '{root}zilla' },
  { id: 'np-basement', text: "Uncle {root}'s Basement Emporium" },
  { id: 'np-crimes', text: '{root} Crimes Inc.' },
  { id: 'np-google', text: '{root} (Do Not Google)' },
  { id: 'np-doctor', text: 'Dr. {root} (Not a Real Doctor)' },
  { id: 'np-bootleg', text: 'Bootleg {root}' },
  { id: 'np-o-matic', text: '{root}-O-Matic' },
  { id: 'np-unregulated', text: 'Unregulated {root}' },
  { id: 'np-tax-shelter', text: '{root} Tax Shelter' },
  { id: 'np-fire-sale', text: '{root} Warehouse Fire Sale' },
  { id: 'np-dungeon', text: "Lord {root}'s Discount Dungeon" },
  { id: 'np-allegedly', text: '{root} (Allegedly)' },
  { id: 'np-industries', text: '{mod}{root} Industries' },
  { id: 'np-cult', text: 'The {mod} {root} Cult' },
  { id: 'np-duo', text: '{mod}{root}' }
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
