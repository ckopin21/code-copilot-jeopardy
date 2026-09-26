// The narrated tutorial. Narration audio is rendered from these lines by scripts/deal-or-dud/render-narration.ts,
// so edit the text here and re-run that script. `seconds` is the fallback when audio cannot play.

export type TutorialFocus = 'studio' | 'presenter' | 'phone-dossier' | 'cards' | 'sharks' | 'offers' | 'reveal' | 'scores';

export interface TutorialStep {
  id: string;
  focus: TutorialFocus;
  title: string;
  line: string;
  seconds: number;
}

export const TUTORIAL_STEPS: readonly TutorialStep[] = [
  { id: 'tut-1', focus: 'studio', title: 'Four players, four rounds', seconds: 6.5,
    line: 'Welcome to Deal or Dud! Each round, one player pitches a business. The other three are the sharks.' },
  { id: 'tut-2', focus: 'phone-dossier', title: 'The secret', seconds: 7.5,
    line: 'First, everyone builds a ridiculous product. When it is your turn to pitch, you secretly learn if it is good or bad, with three good facts and three bad ones.' },
  { id: 'tut-3', focus: 'cards', title: 'Three good facts', seconds: 5.5,
    line: 'The three good facts go straight on the screen. Every card on this screen is verified and true.' },
  { id: 'tut-4', focus: 'sharks', title: 'Ask the right questions', seconds: 7,
    line: 'Sharks, grill them! If you ask about something a hidden bad fact covers, the presenter has to tell you.' },
  { id: 'tut-5', focus: 'offers', title: 'Place your bids', seconds: 7,
    line: 'Then every shark secretly locks in a bid, from zero up to five hundred thousand. The biggest bid gets the deal.' },
  { id: 'tut-6', focus: 'reveal', title: 'The truth', seconds: 8,
    line: 'Then the truth comes out. A good investment wins big, a bad one costs points, and bidding zero on a bad one pays too.' },
  { id: 'tut-7', focus: 'scores', title: 'Let\'s make a deal', seconds: 4.5,
    line: 'Everyone pitches once. Highest score wins. Let\'s make a deal!' }
];

export const TUTORIAL_TOTAL_SECONDS = TUTORIAL_STEPS.reduce((sum, step) => sum + step.seconds, 0);
