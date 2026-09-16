import type { BoardState } from '../shared/types';

export function Board({ board, multiplier = 1, disabled = false, onSelect, onReview }: { board: BoardState; multiplier?: 1 | 2 | 3; disabled?: boolean; onSelect?: (id: string) => void; onReview?: (id: string) => void }) {
  const rows = Math.max(...board.categories.map((category) => board.questions.filter((question) => question.category === category).length));
  return (
    <div className="board" style={{ '--cols': board.categories.length } as React.CSSProperties}>
      {board.categories.map((category) => <div className="category-tile" key={category}>{category}</div>)}
      {Array.from({ length: rows }).flatMap((_, row) => board.categories.map((category) => {
        const question = board.questions.filter((item) => item.category === category)[row];
        if (!question) return <div className="question-tile empty" key={`${category}-${row}`} />;
        const canReview = question.used && Boolean(onReview);
        const displayedValue = question.used ? question.value : question.value * multiplier;
        return <button
          type="button"
          key={question.questionId}
          className={`question-tile ${question.used ? 'used reviewable' : ''}`}
          disabled={disabled || (question.used ? !onReview : !onSelect)}
          onClick={() => question.used ? onReview?.(question.questionId) : onSelect?.(question.questionId)}
          aria-label={`${category} for ${displayedValue} points${multiplier > 1 && !question.used ? `, ${multiplier} times modifier active` : ''}${question.used ? ', used, click to review' : ''}`}
          title={canReview ? 'Review answered question' : undefined}
        >
          {question.used ? <><span className="used-check">✓</span><small>{question.value}</small></> : displayedValue}
        </button>;
      }))}
    </div>
  );
}
