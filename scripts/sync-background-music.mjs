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
  accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'accept-language': 'en-US,en;q=0.9'
};

function decodeHtmlUrls(html) {
  return html
    .replaceAll('\\u002F', '/')
    .replaceAll('\\/', '/')
    .replaceAll('&amp;', '&')
    .replaceAll('&#x26;', '&');
}

function findAudioUrl(html, contentId) {
  const normalized = decodeHtmlUrls(html);
  const contentUrl = normalized.match(/"contentUrl"\s*:\s*"([^"]+\.mp3[^"]*)"/i)?.[1];
  if (contentUrl) return contentUrl.replaceAll('\\u002F', '/').replaceAll('\\/', '/');

  const matches = [...normalized.matchAll(/https:\/\/cdn\.pixabay\.com\/(?:download\/)?audio\/[^\s"'<>]+/g)]
    .map((match) => match[0].replace(/[),;]+$/, ''));
  const mp3s = matches.filter((url) => /\.mp3(?:\?|$)/i.test(url));
  return mp3s.find((url) => url.includes(contentId)) ?? mp3s[0] ?? null;
}

async function loadTrackPage(track) {
  const direct = await globalThis.fetch(track.page, { headers, redirect: 'follow' }).catch(() => null);
  if (direct?.ok) return direct.text();

  // Pixabay can reject datacenter IPs. Jina Reader renders the public page and returns the
  // page HTML, including the JSON-LD AudioObject contentUrl, without requiring credentials.
  const proxyUrl = `https://r.jina.ai/${track.page}`;
  const proxied = await globalThis.fetch(proxyUrl, {
    headers: { 'x-respond-with': 'html', 'x-timeout': '45' },
    redirect: 'follow'
  });
  if (!proxied.ok) throw new Error(`Could not load ${track.page}: direct ${direct?.status ?? 'network error'}, proxy ${proxied.status}`);
  return proxied.text();
}

async function validExistingFile(path) {
  try {
    return (await stat(path)).size > 100_000;
  } catch {
    return false;
  }
}

async function syncTrack(track) {
  const target = join(outDir, track.file);
  if (await validExistingFile(target)) {
    globalThis.console.log(`music: ${track.id} already present`);
    return;
  }

  const html = await loadTrackPage(track);
  const audioUrl = findAudioUrl(html, track.contentId);
  if (!audioUrl) throw new Error(`Could not locate the MP3 URL for ${track.id}`);

  const audioResponse = await globalThis.fetch(audioUrl, {
    headers: { ...headers, referer: track.page },
    redirect: 'follow'
  });
  if (!audioResponse.ok) throw new Error(`Could not download ${track.id}: ${audioResponse.status}`);
  const bytes = Buffer.from(await audioResponse.arrayBuffer());
  const contentType = audioResponse.headers.get('content-type') ?? '';
  if (bytes.length < 100_000 || (!contentType.includes('audio') && bytes.subarray(0, 32).toString('utf8').includes('<html'))) {
    throw new Error(`Downloaded content for ${track.id} is not a valid audio file`);
  }
  await writeFile(target, bytes);
  globalThis.console.log(`music: downloaded ${track.id} (${Math.round(bytes.length / 1024)} KiB)`);
}

await mkdir(outDir, { recursive: true });
await Promise.all(tracks.map(syncTrack));

// Keep source/licensing provenance alongside the generated assets without checking binaries into git.
const notice = `Background music sources\n\nThese tracks are fetched at build/dev time from Pixabay and are used under the Pixabay Content License.\n\n${tracks.map((track) => `- ${track.file}: ${track.page}`).join('\n')}\n`;
const noticePath = join(outDir, 'SOURCES.txt');
let currentNotice = '';
try { currentNotice = await readFile(noticePath, 'utf8'); } catch { /* first sync */ }
if (currentNotice !== notice) await writeFile(noticePath, notice, 'utf8');
