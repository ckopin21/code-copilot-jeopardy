import { SCORE_EFFECTS, type PlayerScoreEffect } from '../shared/playerCustomization';
import { readAccessibility } from './accessibility';

type ScoreImpactOptions = {
  scoreTarget: HTMLElement;
  effect: PlayerScoreEffect;
  delta: number;
  reducedMotion?: boolean;
};

const activeCleanups = new WeakMap<HTMLElement, () => void>();
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

function removeExistingLayers(scoreTarget: HTMLElement) {
  for (const child of Array.from(scoreTarget.children)) {
    if (child instanceof HTMLElement && child.classList.contains('score-impact-layer')) child.remove();
  }
}

export function triggerScoreImpactEffect({ scoreTarget, effect, delta, reducedMotion }: ScoreImpactOptions): () => void {
  activeCleanups.get(scoreTarget)?.();
  removeExistingLayers(scoreTarget);

  const normalizedEffect = normalizeScoreEffect(effect);
  const polarity = delta < 0 ? 'negative' : 'positive';
  const shouldReduceMotion = (reducedMotion ?? readAccessibility().reduceMotion)
    || window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const layer = document.createElement('span');
  layer.className = `score-impact-layer score-impact-layer-${normalizedEffect}`;
  layer.dataset.scoreEffect = normalizedEffect;
  layer.dataset.polarity = polarity;
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
  scoreTarget.style.setProperty('--score-impact-color', polarity === 'positive' ? '#76e0a8' : '#ff8a96');
  scoreTarget.appendChild(layer);
  void scoreTarget.offsetWidth;
  scoreTarget.classList.add(
    'score-impact-active',
    `score-impact-${normalizedEffect}`,
    `score-impact-${polarity}`
  );
  if (shouldReduceMotion) scoreTarget.classList.add('score-impact-reduced');

  let timer = window.setTimeout(cleanup, shouldReduceMotion ? 220 : 900);
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
    if (activeCleanups.get(scoreTarget) === cleanup) activeCleanups.delete(scoreTarget);
  }

  activeCleanups.set(scoreTarget, cleanup);
  return cleanup;
}
