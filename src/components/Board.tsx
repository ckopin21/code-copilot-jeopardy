import type { BoardState } from '../shared/types';

export type BoardResult = {
  playerId: string;
  playerName: string;
  playerAvatar: string;
  correct: boolean;
};
export type BoardResultMap = Record<string, BoardResult[]>;

export function Board({ board, multiplier = 1, disabled = false, onSelect, onReview, results = {} }: { board: BoardState; multiplier?: 1 | 2 | 3; disabled?: boolean; onSelect?: (id: string) => void; onReview?: (id: string) => void; results?: BoardResultMap }) {
  const rows = Math.max(...board.categories.map((category) => board.questions.filter((question) => question.category === category).length));
  return (
    <div className="board" style={{ '--cols': board.categories.length } as React.CSSProperties}>
      {board.categories.map((category) => <div className="category-tile" key={category}>{category}</div>)}
      {Array.from({ length: rows }).flatMap((_, row) => board.categories.map((category) => {
        const question = board.questions.filter((item) => item.category === category)[row];
        if (!question) return <div className="question-tile empty" key={`${category}-${row}`} />;
        const canReview = question.used && Boolean(onReview);
        const displayedValue = question.used ? question.value : question.value * multiplier;
        const questionResults = results[question.questionId] ?? [];
        return <button
          type="button"
          key={question.questionId}
          data-question-id={question.questionId}
          className={`question-tile ${question.used ? 'used reviewable' : ''} ${questionResults.length ? 'has-result' : ''}`}
          disabled={disabled || (question.used ? !onReview : !onSelect)}
          onClick={() => question.used ? onReview?.(question.questionId) : onSelect?.(question.questionId)}
          aria-label={`${category} for ${displayedValue} points${multiplier > 1 && !question.used ? `, ${multiplier} times modifier active` : ''}${question.used ? ', used, click to review' : ''}`}
          title={canReview ? 'Review answered question' : undefined}
        >
          {question.used ? <div className="used-tile-result">
            <small className="used-tile-value">{question.value}</small>
            {questionResults.length ? <div className="used-result-list">{questionResults.map((result) => <span className={`used-result-chip ${result.correct ? 'correct' : 'wrong'}`} key={result.playerId}><b>{result.playerAvatar} {result.playerName}</b><em>{result.correct ? 'CORRECT' : 'INCORRECT'}</em></span>)}</div> : <span className="used-check">✓</span>}
          </div> : displayedValue}
        </button>;
      }))}
    </div>
  );
}
