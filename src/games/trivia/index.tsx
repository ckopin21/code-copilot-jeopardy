// Client entry for Blue Stage Trivia. Loaded on demand by src/games/registry.ts.
import './styles';
import { TriviaApp } from './TriviaApp';
import { DevModeOverlay } from './dev/DevModeOverlay';

export default function TriviaGame() {
  return <><TriviaApp/><DevModeOverlay/></>;
}
