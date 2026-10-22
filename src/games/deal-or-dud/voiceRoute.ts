// Server side of live narration: /api/deal-or-dud/voice forwards one line to the narrator service on this
// computer (scripts/deal-or-dud/voice/voice_server.py, started by voiceService.ts) and returns its WAV. Node only.
// When the service is not running the route answers 503 and the TV plays the recorded fallback line.
import type { FileRouteResult } from '../../platform/rooms/types';
import { HOST_VOICES, MAX_LIVE_TEXT, type HostVoice } from './audio/narrationLines';

export const VOICE_SERVICE_URL = (process.env.DEAL_VOICE_URL ?? 'http://127.0.0.1:5123').replace(/\/$/, '');
/** Lines queue on one GPU; past this many waiting, answer at once so the TV falls back instead of stalling. */
const MAX_IN_FLIGHT = 12;
const TIMEOUT_MS = 20_000;

let inFlight = 0;
const encoder = new TextEncoder();

function json(status: number, value: unknown): FileRouteResult {
  return { status, contentType: 'application/json; charset=utf-8', body: encoder.encode(JSON.stringify(value)) };
}

export async function voiceRoute(query: URLSearchParams, fetchImpl: typeof fetch = fetch): Promise<FileRouteResult> {
  const voice = query.get('voice') ?? '';
  const text = (query.get('text') ?? '').replace(/\s+/g, ' ').trim();
  if (!HOST_VOICES.includes(voice as HostVoice)) return json(400, { error: 'Unknown voice' });
  // Control characters are already collapsed above; this keeps the service to short, printable lines.
  if (!text || text.length > MAX_LIVE_TEXT || /[<>{}\\]/.test(text)) return json(400, { error: 'Unsupported line' });
  if (inFlight >= MAX_IN_FLIGHT) return json(503, { error: 'Narrator busy' });
  inFlight += 1;
  try {
    const response = await fetchImpl(`${VOICE_SERVICE_URL}/speak?voice=${voice}&text=${encodeURIComponent(text)}`, { signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (!response.ok) return json(502, { error: 'Narrator failed' });
    // The same line always sounds the same, so browsers may keep it for a day.
    return { status: 200, contentType: 'audio/wav', body: new Uint8Array(await response.arrayBuffer()), cacheSeconds: 86_400 };
  } catch {
    return json(503, { error: 'Narrator is not running' });
  } finally {
    inFlight -= 1;
  }
}
