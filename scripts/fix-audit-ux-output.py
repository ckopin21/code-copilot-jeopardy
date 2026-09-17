from pathlib import Path

host = Path('src/components/HostAppV3.tsx')
text = host.read_text()
old = "  const boardResults: BoardResultMap = Object.fromEntries(historyEntries.map((entry) => [entry.questionId, entry.attempts]));"
new = "  const boardResults: BoardResultMap = Object.fromEntries(historyEntries.map((entry) => [entry.questionId, entry.attempts.map((attempt) => ({ ...attempt, delta: attempt.correct ? entry.value : -entry.value }))]));"
if old not in text:
    raise SystemExit('boardResults fallback line not found')
host.write_text(text.replace(old, new, 1))

app = Path('src/App.tsx')
text = app.read_text()
old = "import { menuUrl, resetInstance } from './lib/resetInstance';"
new = "import { resetInstance } from './lib/resetInstance';"
if old not in text:
    raise SystemExit('App resetInstance import not found')
text = text.replace(old, new, 1)
app.write_text(text.rstrip() + '\n')
