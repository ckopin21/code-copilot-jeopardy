import { useEffect } from 'react';
import { audio } from '../lib/audio';
import { readAccessibility } from '../lib/accessibility';
import { scoreEffectFromTarget, triggerScoreImpactEffect } from '../lib/scoreEffects';

export type ScoreFlightState = {
  id: string;
  questionId: string;
  playerId: string;
  delta: number;
  correct: boolean;
  comebackBonus?: number;
};

function findByData(attribute: 'questionId' | 'playerScore' | 'playerId', value: string): HTMLElement | null {
  const selector = attribute === 'questionId' ? '[data-question-id]' : attribute === 'playerScore' ? '[data-player-score]' : '[data-player-id]';
  const matches = Array.from(document.querySelectorAll<HTMLElement>(selector)).filter((element) => element.dataset[attribute] === value);
  const visible = matches.filter((element) => {
    const rect = element.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0 && getComputedStyle(element).visibility !== 'hidden';
  });
  return visible.at(-1) ?? matches.at(-1) ?? null;
}

export function ScoreFlight({ flight, onImpact, onComplete }: { flight: ScoreFlightState; onImpact: (flight: ScoreFlightState) => void; onComplete: (id: string) => void }) {
  useEffect(() => {
    let cancelled = false;
    let frame = 0;
    let finishTimer = 0;
    let impactCleanup: (() => void) | null = null;
    let token: HTMLDivElement | null = null;
    let animation: Animation | null = null;

    frame = window.requestAnimationFrame(() => {
      const source = findByData('questionId', flight.questionId)
        ?? document.querySelector<HTMLElement>('.question-stage .question-card-v2, .presentation-question > article, .presentation-shell > section, .phone-question-stage-v2');
      const scoreTarget = findByData('playerScore', flight.playerId);
      const playerCard = findByData('playerId', flight.playerId);
      if (!source || !scoreTarget) {
        onImpact(flight);
        onComplete(flight.id);
        return;
      }

      const start = source.getBoundingClientRect();
      const end = scoreTarget.getBoundingClientRect();
      const startX = start.left + start.width / 2;
      const startY = start.top + start.height / 2;
      const endX = end.left + end.width / 2;
      const endY = end.top + end.height / 2;
      const dx = endX - startX;
      const dy = endY - startY;
      const distance = Math.hypot(dx, dy);
      const arc = Math.max(115, Math.min(280, distance * 0.34));
      const midX = dx * 0.48;
      const midY = dy * 0.42 - arc;
      const approachX = dx * 0.91;
      const approachY = dy * 0.88 - 16;
      const reducedMotion = readAccessibility().reduceMotion || window.matchMedia('(prefers-reduced-motion: reduce)').matches;

      token = document.createElement('div');
      token.className = `score-flight-token ${flight.correct ? 'correct' : 'wrong'}`;
      token.textContent = flight.comebackBonus && flight.comebackBonus > 0
        ? `+${flight.delta.toLocaleString()} · COMEBACK +${flight.comebackBonus.toLocaleString()}`
        : `${flight.delta > 0 ? '+' : ''}${flight.delta.toLocaleString()}`;
      token.style.left = `${startX}px`;
      token.style.top = `${startY}px`;
      const overlayRoot = document.fullscreenElement instanceof HTMLElement
        ? document.fullscreenElement
        : document.querySelector<HTMLElement>('[data-fullscreen-overlay-root="true"]') ?? document.body;
      overlayRoot.appendChild(token);

      const impact = () => {
        if (cancelled) return;
        onImpact(flight);
        audio.cue('score');

        impactCleanup?.();
        impactCleanup = triggerScoreImpactEffect({
          scoreTarget,
          effect: scoreEffectFromTarget(scoreTarget, playerCard),
          delta: flight.delta,
          reducedMotion
        });
        token?.remove();
        token = null;
        finishTimer = window.setTimeout(() => onComplete(flight.id), 240);
      };

      if (reducedMotion) {
        impact();
        return;
      }

      animation = token.animate([
        { transform: 'translate(-50%, -50%) translate(0px, 0px) scale(.62)', opacity: 0, filter: 'blur(2px)', offset: 0 },
        { transform: 'translate(-50%, -50%) translate(0px, -14px) scale(1.18)', opacity: 1, filter: 'blur(0)', offset: 0.12 },
        { transform: `translate(-50%, -50%) translate(${midX}px, ${midY}px) scale(1.1) rotate(${dx >= 0 ? 6 : -6}deg)`, opacity: 1, filter: 'blur(0)', offset: 0.56 },
        { transform: `translate(-50%, -50%) translate(${approachX}px, ${approachY}px) scale(.92) rotate(${dx >= 0 ? 2 : -2}deg)`, opacity: 1, filter: 'blur(.2px)', offset: 0.86 },
        { transform: `translate(-50%, -50%) translate(${dx}px, ${dy}px) scale(.48) rotate(0deg)`, opacity: 1, filter: 'blur(0)', offset: 1 }
      ], {
        duration: Math.max(720, Math.min(1040, 690 + distance * 0.34)),
        easing: 'cubic-bezier(.18,.72,.16,1)',
        fill: 'forwards'
      });
      animation.onfinish = impact;
    });

    return () => {
      cancelled = true;
      window.cancelAnimationFrame(frame);
      window.clearTimeout(finishTimer);
      impactCleanup?.();
      animation?.cancel();
      token?.remove();
    };
  }, [flight, onComplete, onImpact]);

  return null;
}
