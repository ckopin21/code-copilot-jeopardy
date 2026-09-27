// The narrated tutorial. Narration audio is rendered from these lines by scripts/deal-or-dud/render-narration.ts,
// so edit the text here and re-run that script. `seconds` is the fallback when audio cannot play.

export type TutorialFocus = 'studio' | 'build' | 'phone-scorecard' | 'categories' | 'peek' | 'offers' | 'reveal';

export interface TutorialStep {
  id: string;
  focus: TutorialFocus;
  title: string;
  line: string;
  seconds: number;
}

export const TUTORIAL_STEPS: readonly TutorialStep[] = [
  { id: 'tut-1', focus: 'studio', title: 'Four players, four rounds', seconds: 6,
    line: 'Welcome to Deal or Dud! Everyone pitches one business. The other three players are the sharks.' },
  { id: 'tut-2', focus: 'build', title: 'Build it together', seconds: 6.5,
    line: 'First, everyone builds a product at the same time. Pick a product, a twist, and who it is for.' },
  { id: 'tut-3', focus: 'phone-scorecard', title: 'Your secret', seconds: 7,
    line: 'On your turn, you go on stage. Your phone secretly shows if your business is good or bad, and its scorecard.' },
  { id: 'tut-4', focus: 'categories', title: 'Four checks', seconds: 7,
    line: 'The scorecard has four checks. Does it work? Do people want it? Does it make money? Any trouble?' },
  { id: 'tut-5', focus: 'peek', title: 'One peek each', seconds: 6.5,
    line: 'Sharks, you each get one secret peek at one check. Share it, keep it, or bluff!' },
  { id: 'tut-6', focus: 'offers', title: 'Place your bids', seconds: 6.5,
    line: 'Then every shark locks in a bid, from zero to five hundred thousand. The biggest bid gets the deal.' },
  { id: 'tut-7', focus: 'reveal', title: 'The truth', seconds: 8,
    line: 'Then the truth comes out. A good deal wins big, a bad one costs you, and passing on a dud pays too. Let\'s make a deal!' }
];

export const TUTORIAL_TOTAL_SECONDS = TUTORIAL_STEPS.reduce((sum, step) => sum + step.seconds, 0);
