import type { BoardQuestionResult, BoardState } from '../shared/types';
import { questionModifierLabels, resultModifierLabels } from '../lib/boardResultPresentation';

export type BoardResult = BoardQuestionResult;
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
        const displayedValue = question.used ? question.playedValue ?? question.value : question.value * multiplier;
        const questionResults = question.results?.length ? question.results : results[question.questionId] ?? [];
        const questionModifiers = questionModifierLabels(question);
        const correctResultCount = questionResults.filter((result) => result.correct).length;
        const wrongResultCount = questionResults.length - correctResultCount;
        const resultAria = questionResults.length
          ? `, ${correctResultCount} correct, ${wrongResultCount} incorrect`
          : '';
        return <button
          type="button"
          key={question.questionId}
          data-question-id={question.questionId}
          className={`question-tile ${question.used ? 'used reviewable' : ''} ${questionResults.length ? 'has-result' : ''}`}
          disabled={disabled || (question.used ? !onReview : !onSelect)}
          onClick={() => question.used ? onReview?.(question.questionId) : onSelect?.(question.questionId)}
          aria-label={`${category} for ${displayedValue} points${multiplier > 1 && !question.used ? `, ${multiplier} times modifier active` : ''}${question.used ? `, used${resultAria}, click to review` : ''}`}
          title={canReview ? 'Review answered question' : undefined}
        >
          {question.used ? questionResults.length ? <div className="used-tile-result">
            <div className="used-tile-topline">
              <small className="used-tile-value">{question.playedValue ?? question.value}</small>
              {questionModifiers.length > 0 && <div className="used-question-modifiers">{questionModifiers.map((label) => <span key={label}>{label}</span>)}</div>}
            </div>
            <div className="used-result-list">{questionResults.length > 2
              ? <span className="used-result-summary">
                <b className="correct">{correctResultCount} ✓</b>
                <b className="wrong">{wrongResultCount} ✕</b>
                <small>{questionResults.length} responses</small>
              </span>
              : questionResults.map((result) => {
                const modifiers = resultModifierLabels(question, result);
                return <span className={`used-result-chip ${result.correct ? 'correct' : 'wrong'}`} key={result.playerId}>
                  <b>{result.playerAvatar} {result.playerName}</b>
                  <em>{result.correct ? `+${Math.max(0, result.delta).toLocaleString()}` : result.delta.toLocaleString()}</em>
                  {modifiers.length > 0 && <span className="used-result-modifiers">{modifiers.map((label) => <i key={label}>{label}</i>)}</span>}
                </span>;
              })}</div>
          </div> : <span className="used-check used-check-empty">X</span> : displayedValue}
        </button>;
      }))}
    </div>
  );
}
