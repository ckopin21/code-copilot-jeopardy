import type { CurrentQuestionState, Player } from '../types';

/** Host and TV line showing who has first chance on a live buzzer clue and who is waiting in line. */
export function BuzzPriorityStatus({ current, players }: { current: CurrentQuestionState; players: Player[] }) {
  if (current.responseMode === 'text' || current.dailyDouble || !current.buzzOpen || current.buzzWinnerId || current.answerRevealed) return null;
  const byId = (playerId: string | null | undefined) => (playerId ? players.find((player) => player.id === playerId) ?? null : null);
  const holder = byId(current.priorityPlayerId);
  const passer = byId(current.priorityPassedBy);
  if (!holder && !passer) return null;
  const line = (current.buzzQueue ?? []).map(byId).filter((player): player is Player => Boolean(player));
  return <div className="buzz-priority-status" role="status" style={holder ? { '--accent': holder.accent } as React.CSSProperties : undefined}>
    {holder ? <strong>{holder.name} has first chance</strong> : <strong>{passer!.name} passed · first buzz answers</strong>}
    {holder && <span>{line.length ? `In line: ${line.map((player) => player.name).join(', ')}` : 'Others can buzz in to be next in line'}</span>}
  </div>;
}
