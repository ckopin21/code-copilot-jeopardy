export interface PlayableMedia {
  play: () => Promise<unknown> | void;
}

export function playMediaSafely(media: PlayableMedia): void {
  try {
    const result = media.play();
    if (result && typeof result.then === 'function') {
      void result.catch(() => {
        // Autoplay, network, and media failures are presentation-only.
      });
    }
  } catch {
    // Some media implementations can throw synchronously; gameplay must continue.
  }
}
