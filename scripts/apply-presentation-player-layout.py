from pathlib import Path

path = Path('src/components/HostAppV3.tsx')
text = path.read_text()
old = """  useEffect(() => {\n    if (room?.phase !== 'board') setPresentationMode(false);\n  }, [room?.phase]);\n\n"""
if old not in text:
    raise SystemExit('presentation reset block not found')
text = text.replace(old, '', 1)
path.write_text(text)
