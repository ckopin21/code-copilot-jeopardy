import type { Cue } from './audio';
import { readAccessibility } from '../ui/accessibility';

const labels: Record<Cue, string> = {
  click: 'Interface click',
  open: 'Buzzers open',
  buzz: 'Player buzzed in',
  locked: 'Response locked',
  correct: 'Correct answer',
  wrong: 'Incorrect answer',
  'daily-double': 'Daily Double',
  fire: 'On Fire streak',
  cold: 'Cold streak',
  phase: 'Round transition',
  reveal: 'Answer revealed',
  category: 'Categories revealed',
  round: 'New round',
  score: 'Score changed',
  winner: 'Winner revealed',
  diagnostic: 'Controller test'
};

let hideTimer: number | null = null;
let node: HTMLDivElement | null = null;

function captionNode(): HTMLDivElement {
  if (node?.isConnected) return node;
  node = document.createElement('div');
  node.setAttribute('role', 'status');
  node.setAttribute('aria-live', 'polite');
  node.setAttribute('aria-atomic', 'true');
  Object.assign(node.style, {
    position: 'fixed',
    left: '50%',
    bottom: 'max(22px, env(safe-area-inset-bottom))',
    transform: 'translateX(-50%)',
    zIndex: '20000',
    maxWidth: 'min(560px, calc(100vw - 28px))',
    padding: '9px 14px',
    border: '2px solid rgba(255,255,255,.82)',
    borderRadius: '999px',
    background: 'rgba(1,12,20,.94)',
    color: '#fff',
    boxShadow: '0 10px 28px rgba(0,0,0,.48)',
    fontFamily: 'system-ui, sans-serif',
    fontSize: '.8rem',
    fontWeight: '800',
    letterSpacing: '.04em',
    textAlign: 'center',
    pointerEvents: 'none',
    opacity: '0',
    transition: 'opacity .16s ease'
  });
  document.body.appendChild(node);
  return node;
}

window.addEventListener('blue-stage:audio-cue', (event) => {
  if (!readAccessibility().soundCaptions) return;
  const cue = (event as CustomEvent<Cue>).detail;
  const label = labels[cue];
  if (!label) return;
  const target = captionNode();
  target.textContent = `♪ ${label}`;
  target.style.opacity = '1';
  if (hideTimer !== null) window.clearTimeout(hideTimer);
  hideTimer = window.setTimeout(() => {
    if (target) target.style.opacity = '0';
    hideTimer = null;
  }, 1450);
});
