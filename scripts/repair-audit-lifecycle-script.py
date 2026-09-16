from pathlib import Path

path = Path('scripts/apply-audit-lifecycle-hardening.py')
text = path.read_text()
old = 'replace_once("src/components/HostAppV3.tsx", "id: crypto.randomUUID(),", "id: randomId(\'score-flight\'),")'
new = '''host_path = Path("src/components/HostAppV3.tsx")
host_text = host_path.read_text()
needle = "id: crypto.randomUUID(),"
if host_text.count(needle) != 2:
    raise SystemExit(f"src/components/HostAppV3.tsx: expected 2 randomUUID score ids, found {host_text.count(needle)}")
host_path.write_text(host_text.replace(needle, "id: randomId('score-flight'),"))'''
if old not in text:
    raise SystemExit('score-flight patch marker not found')
path.write_text(text.replace(old, new, 1))
