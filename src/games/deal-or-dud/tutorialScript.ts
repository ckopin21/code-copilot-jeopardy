// The narrated tutorial. Narration audio is rendered from these lines by scripts/deal-or-dud/render-narration.ts,
// so edit the text here and re-run that script. `seconds` is the fallback when audio cannot play.

export type TutorialFocus = 'studio' | 'build' | 'pitch' | 'questions' | 'offers' | 'reveal';

export interface TutorialStep {
  id: string;
  focus: TutorialFocus;
  title: string;
  line: string;
  seconds: number;
}

export const TUTORIAL_STEPS: readonly TutorialStep[] = [
  { id: 'tut-1', focus: 'studio', title: 'Four players, four rounds', seconds: 6,
    line: 'Welcome to Deal or Dud! Everyone pitches one ridiculous product. The other three players are the sharks.' },
  { id: 'tut-2', focus: 'build', title: 'Build it together', seconds: 6,
    line: 'First, everyone builds a product at once. Pick a product, a twist, and who it is for.' },
  { id: 'tut-3', focus: 'pitch', title: 'Pitch time', seconds: 5,
    line: 'On your turn, you get one minute to pitch. Sharks, just listen.' },
  { id: 'tut-4', focus: 'questions', title: 'Questions open', seconds: 6,
    line: "Then questions open! Sharks, grill them, send reactions, or say I'm out." },
  { id: 'tut-5', focus: 'offers', title: 'Secret bids', seconds: 5,
    line: 'Next, every shark secretly bids, from zero to five hundred thousand.' },
  { id: 'tut-6', focus: 'reveal', title: 'Raise the most', seconds: 7,
    line: "You score a point for every hundred thousand raised in your pitch. Raise the most money to win. Let's make a deal!" }
];

export const TUTORIAL_TOTAL_SECONDS = TUTORIAL_STEPS.reduce((sum, step) => sum + step.seconds, 0);
