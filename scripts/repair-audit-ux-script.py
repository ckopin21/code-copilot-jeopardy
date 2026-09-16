from pathlib import Path

path = Path('scripts/apply-audit-ux-hardening.py')
text = path.read_text()

# Repair START-MAC quoting in the generated patch script.
old = '''replace_once(
    'START-MAC.command',
    """echo "Installing locked dependencies..."
npm ci --no-audit --no-fund || exit 1

echo "Building game..."""",
    """echo "Checking dependencies..."
if ! npm ls --depth=0 >/dev/null 2>&1; then
  echo "Installing locked dependencies..."
  npm ci --no-audit --no-fund || exit 1
fi

echo "Building game..."""",
)'''
new = '''replace_once(
    'START-MAC.command',
    \'\'\'echo "Installing locked dependencies..."
npm ci --no-audit --no-fund || exit 1

echo "Building game..."\'\'\',
    \'\'\'echo "Checking dependencies..."
if ! npm ls --depth=0 >/dev/null 2>&1; then
  echo "Installing locked dependencies..."
  npm ci --no-audit --no-fund || exit 1
fi

echo "Building game..."\'\'\',
)'''
if old not in text:
    raise SystemExit('START-MAC patch block not found')
text = text.replace(old, new, 1)

# The generic scoring snippet appears in both spoken and text grading. Anchor the
# spoken replacement to the following resolvedPlayerId assignment so each path is patched once.
old = '''replace_once(
    'src/lib/browserGameEngine.ts',
    """    this.addScore(player, correct ? points : -points, room.state.settings);
    if (correct) player.stats.correct += 1; else player.stats.incorrect += 1;""",
    """    const scoreDelta = this.addScore(player, correct ? points : -points, room.state.settings);
    this.recordBoardResult(room, player, correct, scoreDelta);
    if (correct) player.stats.correct += 1; else player.stats.incorrect += 1;""",
)'''
new = '''replace_once(
    'src/lib/browserGameEngine.ts',
    """    this.addScore(player, correct ? points : -points, room.state.settings);
    if (correct) player.stats.correct += 1; else player.stats.incorrect += 1;
    this.applyStreak(player, correct, room.state.settings);
    current.resolvedPlayerId = player.id;""",
    """    const scoreDelta = this.addScore(player, correct ? points : -points, room.state.settings);
    this.recordBoardResult(room, player, correct, scoreDelta);
    if (correct) player.stats.correct += 1; else player.stats.incorrect += 1;
    this.applyStreak(player, correct, room.state.settings);
    current.resolvedPlayerId = player.id;""",
)'''
if old not in text:
    raise SystemExit('ambiguous spoken score patch block not found')
text = text.replace(old, new, 1)

path.write_text(text)
