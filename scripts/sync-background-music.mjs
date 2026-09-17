import { Buffer } from 'node:buffer';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'public', 'music');

const tracks = [
  {
    id: 'kulakovka',
    page: 'https://pixabay.com/music/funk-upbeat-music-281095/',
    file: 'kulakovka-upbeat-music-281095.mp3',
    contentId: '281095'
  },
  {
    id: 'tatamusic',
    page: 'https://pixabay.com/music/upbeat-upbeat-upbeat-music-377668/',
    file: 'tatamusic-upbeat-upbeat-music-377668.mp3',
    contentId: '377668'
  },
  {
    id: 'mountain',
    page: 'https://pixabay.com/music/old-school-hip-hop-upbeat-upbeat-music-567445/',
    file: 'the_mountain-upbeat-upbeat-music-567445.mp3',
    contentId: '567445'
  },
  {
    id: 'sonican',
    page: 'https://pixabay.com/music/electronic-tech-quiz-news-loop-274362/',
    file: 'sonican-tech-quiz-news-loop-274362.mp3',
    contentId: '274362'
  }
];

const headers = {
  'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/140 Safari/537.36',
  accept: 'audio/mpeg,audio/*;q=0.9,*/*;q=0.8',
  'accept-language': 'en-US,en;q=0.9'
};

async function validExistingFile(path) {
  try {
    return (await stat(path)).size > 100_000;
  } catch {
    return false;
  }
}

async function downloadTrack(track) {
  const downloadUrl = `https://pixabay.com/music/download/id-${track.contentId}.mp3`;
  const response = await globalThis.fetch(downloadUrl, {
    headers: { ...headers, referer: track.page },
    redirect: 'follow'
  });
  if (!response.ok) throw new Error(`Could not download ${track.id}: ${response.status}`);

  const bytes = Buffer.from(await response.arrayBuffer());
  const contentType = response.headers.get('content-type') ?? '';
  const prefix = bytes.subarray(0, 64).toString('utf8').toLowerCase();
  const looksHtml = prefix.includes('<html') || prefix.includes('<!doctype');
  if (bytes.length < 100_000 || looksHtml || (!contentType.includes('audio') && !contentType.includes('octet-stream'))) {
    throw new Error(`Downloaded content for ${track.id} is not a valid audio file (${contentType || 'unknown type'}, ${bytes.length} bytes)`);
  }
  return bytes;
}

async function syncTrack(track) {
  const target = join(outDir, track.file);
  if (await validExistingFile(target)) {
    globalThis.console.log(`music: ${track.id} already present`);
    return;
  }

  const bytes = await downloadTrack(track);
  await writeFile(target, bytes);
  globalThis.console.log(`music: downloaded ${track.id} (${Math.round(bytes.length / 1024)} KiB)`);
}

await mkdir(outDir, { recursive: true });
await Promise.all(tracks.map(syncTrack));

const notice = `Background music sources\n\nThese tracks are fetched at build/dev time from Pixabay and are used under the Pixabay Content License.\n\n${tracks.map((track) => `- ${track.file}: ${track.page}`).join('\n')}\n`;
const noticePath = join(outDir, 'SOURCES.txt');
let currentNotice = '';
try { currentNotice = await readFile(noticePath, 'utf8'); } catch { /* first sync */ }
if (currentNotice !== notice) await writeFile(noticePath, notice, 'utf8');
