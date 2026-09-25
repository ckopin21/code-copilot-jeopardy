import type { RoomSnapshot } from '../types';
import { PlayerStrip } from '../components/PlayerStrip';
import { BoardPresentation } from '../components/BoardPresentation';

export type DevVisualLabMode = 'lab' | 'presentation';

export function DevPresentationLab({
  mode,
  scenarioRoom,
  presentationRoom,
  activePlayerId,
  questionId,
  questionValue,
  correctValue,
  comebackActive,
  onExitPresentationMode
}: {
  mode: DevVisualLabMode;
  scenarioRoom: RoomSnapshot;
  presentationRoom: RoomSnapshot;
  activePlayerId: string;
  questionId: string;
  questionValue: number;
  correctValue: number;
  comebackActive: boolean;
  onExitPresentationMode: () => void;
}) {
  if (mode === 'presentation') {
    return <main className="dev-board-presentation" data-dev-production-presentation="true">
      <BoardPresentation
        room={presentationRoom}
        onBack={onExitPresentationMode}
        onSelect={() => {}}
        onReview={() => {}}
      />
    </main>;
  }

  const activePlayer = scenarioRoom.players.find((player) => player.id === activePlayerId) ?? scenarioRoom.players[0] ?? null;

  return <main className="presentation-shell dev-presentation-surface" data-dev-expanded-lab="true">
    <PlayerStrip players={scenarioRoom.players} activeId={activePlayerId} turnId={activePlayerId} turnLabel="ON TURN" />
    <section className="presentation-question">
      <article>
        <div className="question-meta-v2"><span>DEV VISUAL LAB</span><strong>{questionValue.toLocaleString()} POINTS</strong></div>
        <h1>Visual & animation lab</h1>
        <div className="dev-presentation-value" data-question-id={questionId}>
          <small>QUESTION VALUE</small>
          <strong>{questionValue.toLocaleString()}</strong>
          {activePlayer && <span>{comebackActive ? `${questionValue.toLocaleString()} → ${correctValue.toLocaleString()} FOR ${activePlayer.name.toUpperCase()}` : `TESTING ${activePlayer.name.toUpperCase()}`}</span>}
        </div>
      </article>
    </section>
  </main>;
}
