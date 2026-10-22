// Starts the narrator voice (scripts/deal-or-dud/voice/voice_server.py) with the game server and stops it on exit.
// Runs only in the Node room server. Set up once per computer with `npm run voice:setup`; without that, or when
// DEAL_VOICE_URL points at another computer, nothing is started and the hosts use recorded lines.
import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { VOICE_SERVICE_URL } from './voiceRoute';

/** Per-computer home for the narrator's Python environment and rendered lines (outside the repo; several GB). */
export const NARRATOR_HOME = process.env.DEAL_VOICE_HOME ?? join(homedir(), '.blue-stage', 'narrator');
export const NARRATOR_PYTHON = join(NARRATOR_HOME, 'venv', process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python');
export const NARRATOR_SCRIPT = fileURLToPath(new URL('../../../scripts/deal-or-dud/voice/voice_server.py', import.meta.url));

export async function narratorHealthy(url = VOICE_SERVICE_URL): Promise<boolean> {
  try { return (await fetch(`${url}/health`, { signal: AbortSignal.timeout(1_500) })).ok; } catch { return false; }
}

export function startVoiceService(log: (line: string) => void): { stop(): void } {
  let child: ChildProcess | null = null;
  let stopped = false;
  const recent: string[] = [];
  void (async () => {
    const url = new URL(VOICE_SERVICE_URL);
    if (!['127.0.0.1', 'localhost'].includes(url.hostname)) { log(`Narrator voice: using ${VOICE_SERVICE_URL}`); return; }
    if (await narratorHealthy()) { log('Narrator voice is already running.'); return; }
    if (!existsSync(NARRATOR_PYTHON)) { log('Narrator voice is not set up on this computer (run: npm run voice:setup). The hosts will use recorded lines.'); return; }
    if (stopped) return;
    log('Starting the narrator voice. The first start downloads the voice model and takes a few minutes; after that about 30 seconds.');
    child = spawn(NARRATOR_PYTHON, [NARRATOR_SCRIPT], {
      cwd: dirname(NARRATOR_SCRIPT),
      env: { ...process.env, VOICE_PORT: url.port || '80', VOICE_CACHE: join(NARRATOR_HOME, 'cache'), PYTHONIOENCODING: 'utf-8' },
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true
    });
    const relay = (data: Buffer) => {
      for (const line of data.toString().split(/\r?\n/).map((item) => item.trim()).filter(Boolean)) {
        recent.push(line);
        if (recent.length > 20) recent.shift();
        if (/Narrator ready|^Using |speak failed/.test(line)) log(`[narrator] ${line}`);
      }
    };
    child.stdout?.on('data', relay);
    child.stderr?.on('data', relay);
    child.on('exit', (code) => {
      child = null;
      if (!stopped) log(`Narrator voice stopped (exit ${code}). The hosts will use recorded lines. Last output:\n  ${recent.slice(-6).join('\n  ')}`);
    });
  })();
  return {
    stop() {
      stopped = true;
      const pid = child?.pid;
      if (!pid) return;
      // On Windows the venv python.exe is a launcher with the real interpreter as its child, so end the whole tree.
      if (process.platform === 'win32') spawnSync('taskkill', ['/pid', String(pid), '/T', '/F'], { windowsHide: true });
      else child?.kill('SIGTERM');
    }
  };
}
