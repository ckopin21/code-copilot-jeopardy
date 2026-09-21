import type { ReactNode } from 'react';

type PlayerStatusStackProps = {
  streak: ReactNode;
  turn: ReactNode;
  fallback?: ReactNode;
};

/** The sole status lane used by a live player card. */
export function PlayerStatusStack({ streak, turn, fallback = <span className="status-pill neutral">READY</span> }: PlayerStatusStackProps) {
  const hasStatus = Boolean(streak || turn);
  return <div className="player-status-stack" data-status-count={(streak ? 1 : 0) + (turn ? 1 : 0)}>
    {streak}
    {turn}
    {!hasStatus && fallback}
  </div>;
}
