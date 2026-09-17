import type { BoardQuestion, BoardQuestionResult } from '../shared/types';

function unique(labels: string[]): string[] {
  return [...new Set(labels.filter(Boolean))];
}

export function questionModifierLabels(question: BoardQuestion): string[] {
  if (question.modifiers?.length) return unique(question.modifiers);

  const labels: string[] = [];
  if (question.dailyDouble) labels.push('DAILY DOUBLE');

  if (!question.dailyDouble && question.playedValue && question.value > 0) {
    const ratio = question.playedValue / question.value;
    if (ratio === 2 || ratio === 3) labels.push(`${ratio}× POINTS`);
  }

  return unique(labels);
}

export function resultModifierLabels(question: BoardQuestion, result: BoardQuestionResult): string[] {
  if (result.modifiers?.length) return unique(result.modifiers);
  if (!result.correct || question.dailyDouble) return [];

  const normalValue = question.playedValue ?? question.value;
  const awarded = Math.max(0, result.delta);
  if (normalValue <= 0 || awarded <= normalValue) return [];

  const ratio = awarded / normalValue;
  if (ratio === 2 || ratio === 3) return [`${ratio}× COMEBACK`];
  return [`BONUS +${(awarded - normalValue).toLocaleString()}`];
}
