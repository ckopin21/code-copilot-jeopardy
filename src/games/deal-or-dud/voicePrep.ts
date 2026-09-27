// Renders live lines ahead of time from the server's full view of the game, so the TV finds them ready.
// Names are prepared in the lobby, and each pitch intro as soon as its product locks during the build: that is
// what keeps slower computers (a MacBook Air) on time. Rendering only fills the narrator's cache; nothing is sent
// to any screen, so a product stays secret until its pitch.
import type { DealSnapshot } from './types';
import { LIVE_LINES, type LiveLine } from './audio/narrationLines';
import { lobbyPrefetch, pitchLine, spokenName } from './audio/narrationPlan';
import { VOICE_SERVICE_URL } from './voiceRoute';

const prepared = new Set<string>();
let queue: Promise<void> = Promise.resolve();
let downUntil = 0;

/** Lines worth rendering now for this state, most urgent first. */
export function linesToPrepare(room: DealSnapshot): LiveLine[] {
  if (room.phase === 'lobby') return lobbyPrefetch(room);
  // Pitch intros for every product that is locked but not yet pitched, next round first.
  const intros = [...room.upcoming].sort((a, b) => a.index - b.index)
    .map((round) => pitchLine(room, round))
    .filter((line): line is LiveLine => Boolean(line));
  return [...tieLines(room), ...intros];
}

/** On stage: "Ava and Ben both want in!" for every pair of this round's sharks, in case two tie at the top. */
function tieLines(room: DealSnapshot): LiveLine[] {
  const sharks = room.round && ['stage', 'offers'].includes(room.phase) ? room.round.sharkIds : [];
  const lines: LiveLine[] = [];
  sharks.forEach((first, index) => sharks.slice(index + 1).forEach((second) => {
    const names = [spokenName(room, first), spokenName(room, second)];
    if (names[0] && names[1]) lines.push(LIVE_LINES.bothIn(names[0], names[1]));
  }));
  return lines;
}

export function prepareVoices(room: DealSnapshot, fetchImpl: typeof fetch = fetch): void {
  if (Date.now() < downUntil) return;
  if (prepared.size > 500) prepared.clear();
  for (const line of linesToPrepare(room)) {
    const key = `${line.voice}|${line.text}`;
    if (prepared.has(key)) continue;
    prepared.add(key);
    queue = queue.then(async () => {
      try {
        const response = await fetchImpl(`${VOICE_SERVICE_URL}/speak?voice=${line.voice}&text=${encodeURIComponent(line.text)}`, { signal: AbortSignal.timeout(60_000) });
        await response.arrayBuffer();
        if (!response.ok) prepared.delete(key);
      } catch {
        // Not running (or still loading): try again on a later change, and stop asking for a while.
        prepared.delete(key);
        downUntil = Date.now() + 15_000;
      }
    });
  }
}
