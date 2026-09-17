type WebkitDocument = Document & {
  webkitFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => Promise<void> | void;
};

type WebkitElement = HTMLElement & {
  webkitRequestFullscreen?: () => Promise<void> | void;
};

function fullscreenActive(): boolean {
  const webkitDocument = document as WebkitDocument;
  return Boolean(document.fullscreenElement ?? webkitDocument.webkitFullscreenElement);
}

function fullscreenSupported(): boolean {
  const root = document.documentElement as WebkitElement;
  return Boolean(document.fullscreenEnabled || root.requestFullscreen || root.webkitRequestFullscreen);
}

async function toggleFullscreen(): Promise<void> {
  const webkitDocument = document as WebkitDocument;
  const root = document.documentElement as WebkitElement;
  try {
    if (fullscreenActive()) {
      if (document.exitFullscreen) await document.exitFullscreen();
      else await webkitDocument.webkitExitFullscreen?.();
    } else if (root.requestFullscreen) {
      await root.requestFullscreen();
    } else {
      await root.webkitRequestFullscreen?.();
    }
  } catch {
    // Browser policy can reject fullscreen requests. Keep the host UI usable either way.
  }
}

function syncButton(button: HTMLButtonElement): void {
  const active = fullscreenActive();
  button.disabled = !fullscreenSupported();
  button.textContent = active ? '⛶ Exit Fullscreen' : '⛶ Fullscreen';
  button.setAttribute('aria-label', active ? 'Exit fullscreen' : 'Enter fullscreen');
}

function ensureHostFullscreenButton(): void {
  const topbar = document.querySelector<HTMLElement>('.showcase-host .showcase-topbar');
  if (!topbar) return;

  let button = topbar.querySelector<HTMLButtonElement>('.host-fullscreen-button');
  if (!button) {
    button = document.createElement('button');
    button.type = 'button';
    button.className = 'nav-button host-fullscreen-button';
    button.addEventListener('click', () => void toggleFullscreen());

    const audioButton = topbar.querySelector('.audio-toggle-button');
    if (audioButton) topbar.insertBefore(button, audioButton);
    else topbar.appendChild(button);
  }

  syncButton(button);
}

function syncFullscreenUi(): void {
  const button = document.querySelector<HTMLButtonElement>('.host-fullscreen-button');
  if (button) syncButton(button);
}

if (typeof document !== 'undefined') {
  const observer = new MutationObserver(() => ensureHostFullscreenButton());
  const start = () => {
    ensureHostFullscreenButton();
    observer.observe(document.body, { childList: true, subtree: true });
  };

  if (document.body) start();
  else document.addEventListener('DOMContentLoaded', start, { once: true });

  document.addEventListener('fullscreenchange', syncFullscreenUi);
  document.addEventListener('webkitfullscreenchange', syncFullscreenUi as EventListener);
}
