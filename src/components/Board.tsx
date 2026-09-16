import type { BoardState } from '../shared/types';

export function Board({ board, disabled = false, onSelect }: { board: BoardState; disabled?: boolean; onSelect?: (id: string) => void }) {
  const rows = Math.max(...board.categories.map((category) => board.questions.filter((question) => question.category === category).length));
  return (
    <div className="board" style={{ '--cols': board.categories.length } as React.CSSProperties}>
      {board.categories.map((category) => <div className="category-tile" key={category}>{category}</div>)}
      {Array.from({ length: rows }).flatMap((_, row) => board.categories.map((category) => {
        const question = board.questions.filter((item) => item.category === category)[row];
        if (!question) return <div className="question-tile empty" key={`${category}-${row}`} />;
        return <button type="button" key={question.questionId} className={`question-tile ${question.used ? 'used' : ''}`} disabled={disabled || question.used || !onSelect} onClick={() => onSelect?.(question.questionId)} aria-label={`${category} for ${question.value} points${question.used ? ', used' : ''}`}>{question.used ? '' : question.value}</button>;
      }))}
    </div>
  );
}
