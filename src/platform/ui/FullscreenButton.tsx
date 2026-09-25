import { fullscreenSupported, toggleFullscreen, useFullscreenActive } from './fullscreen';

/** Top-bar button used by Host screens. */
export function FullscreenButton() {
  const active = useFullscreenActive();
  return <button
    type="button"
    className="nav-button host-fullscreen-button"
    disabled={!fullscreenSupported()}
    aria-label={active ? 'Exit fullscreen' : 'Enter fullscreen'}
    onClick={() => void toggleFullscreen()}
  >{active ? '⛶ Exit Fullscreen' : '⛶ Fullscreen'}</button>;
}
