from pathlib import Path

path = Path('src/components/HostAppV3.tsx')
text = path.read_text()
old = '<BoardPresentation room={room} onBack={() => setPresentationMode(false)} onSelect={selectBoardQuestion} onReview={(questionId) => setReviewId(questionId)} results={boardResults} />'
new = '<BoardPresentation room={room} onBack={() => setPresentationMode(false)} onSelect={selectBoardQuestion} onReview={(questionId) => setReviewId(questionId)} results={boardResults} scoreOverrides={scoreOverrides} />'
if text.count(old) != 1:
    raise SystemExit(f'expected one BoardPresentation call, found {text.count(old)}')
path.write_text(text.replace(old, new, 1))
