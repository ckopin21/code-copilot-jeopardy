import { SCORE_EFFECTS, type PlayerScoreEffect } from '../shared/playerCustomization';
import { readAccessibility } from './accessibility';

type ScoreImpactOptions = {
  scoreTarget: HTMLElement;
  effect: PlayerScoreEffect;
  delta: number;
  reducedMotion?: boolean;
};

const keyedCleanups = new Map<string, () => void>();
const anonymousCleanups = new WeakMap<HTMLElement, () => void>();
const sparkVectors = [
  [-30, -22], [-7, -34], [22, -28], [34, -4],
  [28, 24], [4, 34], [-24, 27], [-36, 5]
] as const;

export function normalizeScoreEffect(value: unknown): PlayerScoreEffect {
  return typeof value === 'string' && SCORE_EFFECTS.some((effect) => effect.id === value)
    ? value as PlayerScoreEffect
    : 'pulse';
}

export function scoreEffectFromTarget(scoreTarget: HTMLElement, playerSurface?: HTMLElement | null): PlayerScoreEffect {
  const value = playerSurface?.dataset.scoreEffect
    ?? scoreTarget.closest<HTMLElement>('[data-score-effect]')?.dataset.scoreEffect;
  return normalizeScoreEffect(value);
}

function effectKey(scoreTarget: HTMLElement): string | null {
  return scoreTarget.dataset.playerScore ?? null;
}

function previousCleanup(scoreTarget: HTMLElement): (() => void) | undefined {
  const key = effectKey(scoreTarget);
  return key ? keyedCleanups.get(key) : anonymousCleanups.get(scoreTarget);
}

function rememberCleanup(scoreTarget: HTMLElement, cleanup: () => void) {
  const key = effectKey(scoreTarget);
  if (key) keyedCleanups.set(key, cleanup);
  else anonymousCleanups.set(scoreTarget, cleanup);
}

function forgetCleanup(scoreTarget: HTMLElement, cleanup: () => void) {
  const key = effectKey(scoreTarget);
  if (key) {
    if (keyedCleanups.get(key) === cleanup) keyedCleanups.delete(key);
  } else if (anonymousCleanups.get(scoreTarget) === cleanup) {
    anonymousCleanups.delete(scoreTarget);
  }
}

function mountLayer(scoreTarget: HTMLElement, layer: HTMLElement) {
  const targetRect = scoreTarget.getBoundingClientRect();
  const centerX = targetRect.left + targetRect.width / 2;
  const centerY = targetRect.top + targetRect.height / 2;
  const containedRoot = scoreTarget.closest<HTMLElement>('[data-score-impact-root]');

  if (containedRoot) {
    const rootRect = containedRoot.getBoundingClientRect();
    layer.style.position = 'absolute';
    layer.style.left = `${centerX - rootRect.left}px`;
    layer.style.top = `${centerY - rootRect.top}px`;
    containedRoot.appendChild(layer);
    return;
  }

  layer.style.position = 'fixed';
  layer.style.left = `${centerX}px`;
  layer.style.top = `${centerY}px`;
  const overlayRoot = document.fullscreenElement instanceof HTMLElement
    ? document.fullscreenElement
    : document.querySelector<HTMLElement>('[data-fullscreen-overlay-root="true"]') ?? document.body;
  overlayRoot.appendChild(layer);
}

export function triggerScoreImpactEffect({ scoreTarget, effect, delta, reducedMotion }: ScoreImpactOptions): () => void {
  previousCleanup(scoreTarget)?.();

  const normalizedEffect = normalizeScoreEffect(effect);
  const polarity = delta < 0 ? 'negative' : 'positive';
  const shouldReduceMotion = (reducedMotion ?? readAccessibility().reduceMotion)
    || window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const impactColor = polarity === 'positive' ? '#76e0a8' : '#ff8a96';

  const layer = document.createElement('span');
  layer.className = `score-impact-layer score-impact-layer-${normalizedEffect}`;
  layer.dataset.scoreEffect = normalizedEffect;
  layer.dataset.polarity = polarity;
  const key = effectKey(scoreTarget);
  if (key) layer.dataset.scoreTarget = key;
  layer.style.setProperty('--score-impact-color', impactColor);
  layer.style.color = impactColor;
  layer.setAttribute('aria-hidden', 'true');

  if (normalizedEffect === 'pulse') {
    layer.appendChild(document.createElement('i'));
  } else if (normalizedEffect === 'spark') {
    sparkVectors.forEach(([x, y], index) => {
      const particle = document.createElement('i');
      particle.style.setProperty('--spark-x', `${x}px`);
      particle.style.setProperty('--spark-y', `${y}px`);
      particle.style.setProperty('--spark-delay', `${index * 16}ms`);
      layer.appendChild(particle);
    });
  } else {
    layer.append(document.createElement('i'), document.createElement('i'));
  }

  scoreTarget.classList.remove(
    'score-impact-active',
    'score-impact-pulse',
    'score-impact-spark',
    'score-impact-wave',
    'score-impact-positive',
    'score-impact-negative',
    'score-impact-reduced'
  );
  scoreTarget.classList.add('score-impact-host');
  scoreTarget.style.setProperty('--score-impact-color', impactColor);
  mountLayer(scoreTarget, layer);
  void scoreTarget.offsetWidth;
  scoreTarget.classList.add(
    'score-impact-active',
    `score-impact-${normalizedEffect}`,
    `score-impact-${polarity}`
  );
  if (shouldReduceMotion) scoreTarget.classList.add('score-impact-reduced');

  const timer = window.setTimeout(cleanup, shouldReduceMotion ? 220 : 900);
  function cleanup() {
    window.clearTimeout(timer);
    layer.remove();
    scoreTarget.classList.remove(
      'score-impact-active',
      'score-impact-pulse',
      'score-impact-spark',
      'score-impact-wave',
      'score-impact-positive',
      'score-impact-negative',
      'score-impact-reduced'
    );
    scoreTarget.style.removeProperty('--score-impact-color');
    forgetCleanup(scoreTarget, cleanup);
  }

  rememberCleanup(scoreTarget, cleanup);
  return cleanup;
}
