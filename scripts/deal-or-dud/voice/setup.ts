// One-time setup of the Deal or Dud narrator voice on this computer:  npm run voice:setup
//
// Needs uv (https://docs.astral.sh/uv/): Windows `winget install astral-sh.uv`, Mac `brew install uv`.
// uv fetches Python 3.11 itself. Installs Chatterbox and PyTorch (CUDA build with an NVIDIA GPU; the Apple GPU is
// used automatically on a Mac) into <narrator home>/venv, about 3-5 GB. The voice model (about 3 GB more) downloads
// the first time the game starts the narrator. Undo: delete the narrator home folder printed below.
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { NARRATOR_HOME, NARRATOR_PYTHON } from '../../../src/games/deal-or-dud/voiceService';

function findUv(): string | null {
  const probe = spawnSync(process.platform === 'win32' ? 'where' : 'which', ['uv'], { encoding: 'utf8' });
  const onPath = probe.status === 0 ? probe.stdout.split(/\r?\n/)[0].trim() : '';
  if (onPath) return onPath;
  // winget installs uv here but a shell opened before the install does not have it on PATH yet.
  const candidates = process.platform === 'win32'
    ? (() => {
      const packages = join(process.env.LOCALAPPDATA ?? '', 'Microsoft', 'WinGet', 'Packages');
      return existsSync(packages) ? readdirSync(packages).filter((name) => name.startsWith('astral-sh.uv')).map((name) => join(packages, name, 'uv.exe')) : [];
    })()
    : [join(homedir(), '.local', 'bin', 'uv'), '/opt/homebrew/bin/uv', '/usr/local/bin/uv'];
  return candidates.find((file) => existsSync(file)) ?? null;
}

const uv = findUv();
if (!uv) {
  console.error('uv is needed to set up the narrator voice. Install it, then run this again:');
  console.error(process.platform === 'win32' ? '  winget install astral-sh.uv' : '  brew install uv   (or: curl -LsSf https://astral.sh/uv/install.sh | sh)');
  process.exit(1);
}
const run = (args: string[]) => execFileSync(uv, args, { stdio: 'inherit' });

console.log(`Narrator home: ${NARRATOR_HOME}`);
if (!existsSync(NARRATOR_PYTHON)) run(['venv', '--python', '3.11', join(NARRATOR_HOME, 'venv')]);

const nvidia = process.platform !== 'darwin' && spawnSync('nvidia-smi', ['-L'], { encoding: 'utf8' }).status === 0;
const packages = ['chatterbox-tts', 'setuptools<81']; // perth, Chatterbox's watermarker, still imports pkg_resources
run(['pip', 'install', '--python', NARRATOR_PYTHON, ...packages,
  ...(nvidia ? ['--extra-index-url', 'https://download.pytorch.org/whl/cu124', '--index-strategy', 'unsafe-best-match'] : [])]);

const check = execFileSync(NARRATOR_PYTHON, ['-c',
  'import torch, chatterbox; print("cuda" if torch.cuda.is_available() else "mps" if torch.backends.mps.is_available() else "cpu")'], { encoding: 'utf8' }).trim();
console.log(`\nNarrator voice installed (runs on: ${check}). It starts with the game from now on.`);
if (check === 'cpu') console.log('No supported GPU was found, so new lines will be slow; the hosts fall back to recorded lines when a line is late.');
