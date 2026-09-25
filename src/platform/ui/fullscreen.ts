import { useSyncExternalStore } from 'react';

type WebkitDocument = Document & {
  webkitFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => Promise<void> | void;
};
type WebkitElement = HTMLElement & { webkitRequestFullscreen?: () => Promise<void> | void };

export function fullscreenActive(): boolean {
  return Boolean(document.fullscreenElement ?? (document as WebkitDocument).webkitFullscreenElement);
}

export function fullscreenSupported(): boolean {
  const root = document.documentElement as WebkitElement;
  return Boolean(document.fullscreenEnabled || root.requestFullscreen || root.webkitRequestFullscreen);
}

/** Toggles fullscreen for the whole page. Browser policy may refuse; the UI stays usable either way. */
export async function toggleFullscreen(): Promise<void> {
  const root = document.documentElement as WebkitElement;
  try {
    if (fullscreenActive()) {
      if (document.exitFullscreen) await document.exitFullscreen();
      else await (document as WebkitDocument).webkitExitFullscreen?.();
    } else if (root.requestFullscreen) {
      await root.requestFullscreen();
    } else {
      await root.webkitRequestFullscreen?.();
    }
  } catch {
    // Rejected by browser policy.
  }
}

function subscribe(onChange: () => void): () => void {
  document.addEventListener('fullscreenchange', onChange);
  document.addEventListener('webkitfullscreenchange', onChange);
  return () => {
    document.removeEventListener('fullscreenchange', onChange);
    document.removeEventListener('webkitfullscreenchange', onChange);
  };
}

export function useFullscreenActive(): boolean {
  return useSyncExternalStore(subscribe, fullscreenActive, () => false);
}
