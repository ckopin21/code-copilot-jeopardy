from pathlib import Path

path = Path('src/components/HostAppV3.tsx')
text = path.read_text()
old = "  const boardResults: BoardResultMap = Object.fromEntries(historyEntries.map((entry) => [entry.questionId, entry.attempts]));"
new = "  const boardResults: BoardResultMap = Object.fromEntries(historyEntries.map((entry) => [entry.questionId, entry.attempts.map((attempt) => ({ ...attempt, delta: attempt.correct ? entry.value : -entry.value }))]));"
if old not in text:
    raise SystemExit('boardResults fallback line not found')
path.write_text(text.replace(old, new, 1))
