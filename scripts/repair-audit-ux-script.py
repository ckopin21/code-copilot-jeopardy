from pathlib import Path

path = Path('scripts/apply-audit-ux-hardening.py')
text = path.read_text()
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
path.write_text(text.replace(old, new, 1))
