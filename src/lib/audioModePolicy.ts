import { audio } from './audio';

let installed = false;

function playerMode(): boolean {
  return typeof location !== 'undefined' && new URLSearchParams(location.search).get('mode') === 'player';
}

export function installModeAwareAudioPolicy(): void {
  if (installed) return;
  installed = true;

  const unlock = audio.unlock.bind(audio);
  audio.unlock = async () => {
    if (!playerMode()) {
      await unlock();
      return;
    }

    // Participant phones need the WebAudio context for button/buzzer effects,
    // but must never start the selected background-music track.
    const selectedTrack = audio.settings.backgroundTrack;
    audio.settings.backgroundTrack = 'dynamic';
    try {
      await unlock();
    } finally {
      audio.settings.backgroundTrack = selectedTrack;
    }
  };

  if (playerMode()) audio.stop();
}
