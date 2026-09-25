import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import QRCode from 'qrcode';
import { createServer as createViteServer, type ViteDevServer } from 'vite';
import { createRoomServer, type RoomServer } from './roomServer';

const mimeTypes: Record<string, string> = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.wav': 'audio/wav',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2'
};

function sendJson(response: ServerResponse, value: unknown, status = 200): void {
  response.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  response.end(JSON.stringify(value));
}

export interface LocalGameServer {
  httpServer: ReturnType<typeof createServer>;
  game: RoomServer;
  port: number;
  close(): Promise<void>;
}

export async function startLocalGameServer(options: { port?: number; host?: string; baseUrl?: string; distDir?: string; dev?: boolean } = {}): Promise<LocalGameServer> {
  const port = options.port ?? Number(process.env.PORT ?? 3000);
  const host = options.host ?? process.env.HOST ?? '0.0.0.0';
  const distDir = resolve(options.distDir ?? 'dist-client');
  if (!options.dev && !existsSync(resolve(distDir, 'index.html'))) throw new Error(`Production application is missing from ${distDir}. Run npm run build first.`);
  let vite: ViteDevServer | null = null;
  const httpServer = createServer((request, response) => { void serveRequest(request, response); });
  const game = createRoomServer({ httpServer, baseUrl: options.baseUrl ?? process.env.BLUE_STAGE_BASE_URL });
  if (options.dev) {
    vite = await createViteServer({
      appType: 'spa',
      server: { middlewareMode: true, host, hmr: { server: httpServer } }
    });
  }

  async function serveRequest(request: IncomingMessage, response: ServerResponse): Promise<void> {
    try {
      const url = new URL(request.url ?? '/', 'http://localhost');
      if (request.method !== 'GET' && request.method !== 'HEAD') { sendJson(response, { error: 'Method not allowed' }, 405); return; }
      if (url.pathname === '/api/health') { sendJson(response, { ok: true }); return; }
      if (url.pathname === '/api/network') {
        const baseUrl = game.baseUrl();
        sendJson(response, { baseUrl, hostUrl: `${baseUrl}/?mode=host`, transport: 'socket.io', p2p: false });
        return;
      }
      const gameRoute = game.httpRoutes.get(url.pathname);
      if (gameRoute) { sendJson(response, gameRoute()); return; }
      if (url.pathname === '/api/qr') {
        const value = url.searchParams.get('value') ?? '';
        if (!value || value.length > 2048) { sendJson(response, { error: 'A valid URL is required' }, 400); return; }
        const dataUrl = await QRCode.toDataURL(value, { margin: 1, width: 320 });
        sendJson(response, { dataUrl });
        return;
      }
      if (url.pathname.startsWith('/api/')) { sendJson(response, { error: 'Not found' }, 404); return; }
      if (vite) {
        vite.middlewares(request, response, () => sendJson(response, { error: 'Not found' }, 404));
        return;
      }
      let pathname: string;
      try { pathname = decodeURIComponent(url.pathname); } catch { sendJson(response, { error: 'Invalid path' }, 400); return; }
      const file = resolve(distDir, `.${pathname}`);
      if (file !== distDir && !file.startsWith(`${distDir}${sep}`)) { sendJson(response, { error: 'Invalid path' }, 400); return; }
      const candidate = existsSync(file) && statSync(file).isFile() ? file : resolve(distDir, 'index.html');
      const extension = candidate.slice(candidate.lastIndexOf('.'));
      response.writeHead(200, {
        'content-type': mimeTypes[extension] ?? 'application/octet-stream',
        'cache-control': candidate.endsWith('index.html') ? 'no-store' : 'public, max-age=3600'
      });
      createReadStream(candidate).pipe(response);
    } catch {
      if (!response.headersSent) sendJson(response, { error: 'Server error' }, 500);
      else response.end();
    }
  }

  await new Promise<void>((done, reject) => {
    httpServer.once('error', reject);
    httpServer.listen(port, host, () => { httpServer.off('error', reject); done(); });
  });
  const address = httpServer.address();
  const actualPort = address && typeof address !== 'string' ? address.port : port;
  return {
    httpServer, game, port: actualPort,
    async close() { await vite?.close(); await game.close(); }
  };
}

const launchedFromCli = process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (launchedFromCli) {
  startLocalGameServer({ dev: process.argv.includes('--dev') }).then(({ game, close }) => {
    process.stdout.write(`Blue Stage Trivia is running.\nHost: ${game.baseUrl()}/?mode=host\nJoin and Presentation links appear in Host after room creation.\n`);
    let stopping = false;
    const stop = () => {
      if (stopping) return;
      stopping = true;
      void close().then(() => process.exit(0));
    };
    process.on('SIGINT', stop);
    process.on('SIGTERM', stop);
  }).catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : 'Could not start Blue Stage Trivia'}\n`);
    process.exitCode = 1;
  });
}
