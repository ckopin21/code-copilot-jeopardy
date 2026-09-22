# Development guide

## Repository map

```text
server/
  index.ts                  HTTP/static/Vite server, LAN routes, startup
  gameServer.ts             Socket.IO sessions, authorization, dispatch, broadcasts
  storage.ts                atomic file-backed room storage
src/
  App.tsx                   top-level Host/player/Presentation routing
  components/               Host, phone, board, Presentation, recap UI
  lib/browserGameEngine.ts  shared authoritative rules and state transitions
  lib/socket.ts             Socket.IO client adapter and application request API
  lib/clientLifecycle.ts    mobile/WebKit page and network recovery
  lib/snapshotSecurity.ts   role-based snapshot privacy
  packs/                    question packs and generated registry
  shared/                   shared state and validation contracts
scripts/
  generate-pack-registry.mjs automatic pack registration/check
tests/                     engine, server, content, and UI-unit regressions
e2e/                       rendered Chromium and WebKit regressions
docs/                      maintained technical and gameplay documentation
```

## Install and run

Node.js 22+ is required on the laptop. `npm ci` installs the committed lockfile. For real gameplay, `npm start` builds the app and starts the authoritative HTTP/Socket.IO server on port 3000. For development, `npm run dev` starts the same server with Vite middleware and hot reload. Both bind to `0.0.0.0` by default and print a LAN Host URL. The Join QR uses the server's runtime-discovered LAN address; set `BLUE_STAGE_BASE_URL` if another adapter is preferred. `PORT` and `HOST` can change the listener.

```bash
npm ci
npm start
```

The server serves `/api/network`, `/api/packs`, and `/api/qr`. Room data is saved locally under `.data/rooms.json` and excluded from Git. Keep the server running throughout a game. The Host browser may reload without deleting the server room. `START-WINDOWS.bat` and `START-MAC.command` offer launcher flows. Windows Firewall must permit Node.js on the Private network for phone access; guest-network isolation or a VPN can still block local traffic.

GitHub Pages cannot run Node or Socket.IO. Its deployment is a static preview/landing surface, not the multiplayer backend. The working multiplayer URL is the one printed by the laptop server.

## Quality commands

```bash
npm run packs:check
npm run questions:check
npm run typecheck
npm run typecheck:server
npm run lint
npm test
npm run build
npm run test:e2e
npm run test:e2e:webkit
```

Pack registration is generated from source files in `src/packs/`; do not hand-edit `src/packs/generatedRegistry.ts`. `packs:check` detects registry drift and `questions:check` runs content safeguards. See [question-packs.md](question-packs.md) for the canonical authoring workflow. Typecheck covers the browser and server TypeScript configurations; build produces `dist-client` for the Node server. Install Playwright browsers once with `npx playwright install chromium webkit` (CI uses `--with-deps`).

Run browser tests against the local integrated server. Chromium and WebKit validate rendered and simulated lifecycle behavior. They do not prove physical iPhone Safari, Android, camera, haptics, or every Wi-Fi configuration; use the [real-device test matrix](real-device-test-matrix.md) for that evidence. The old opt-in public PeerJS reservation smoke was transport-specific and has been retired; its join/reload/recovery behavior belongs in local Socket.IO tests and WebKit browser coverage.

## Safely changing gameplay

For a game action, inspect the shared state in `src/shared/types.ts`, transition in `src/lib/browserGameEngine.ts`, role filtering in `src/lib/snapshotSecurity.ts`, server authorization and dispatch in `server/gameServer.ts`, the client request adapter in `src/lib/socket.ts`, the relevant Host/player/Presentation UI, tests, and [gameplay.md](gameplay.md). There is one rule engine; the server owns its instance. Do not create client-side score authority or a second rule implementation.

Important regression areas include independent rooms, duplicate request acknowledgements, stale Host/player socket rejection, mass disconnect recovery, reserved seats and late joins, Host and Presentation reloads, Free Response, Daily Double, Final privacy, rematch/new game, and score effects after authoritative updates. Drive real `game:request` messages through `createGameServer(...)` for server integration tests instead of mocking a replacement protocol.

## UI and experience rules

- Phones and displays render authoritative snapshots; they never choose scores or phases locally.
- Host controls require the bound Host token. Presentation is read-only and requires its separate capability.
- New Game must broadcast a fresh lobby snapshot while preserving seats, profiles, and credentials.
- Disconnected reserved players must not block active connected players.
- Hidden answers and future Final responses must be filtered before they leave the server.
- The in-page Presentation board uses the normal Host selection callback. A remote Presentation browser only observes the server.
- Score animation may delay a displayed number, but it must not delay committed server state.
- Preserve the shared player-card status/avatar/name/score layout and touch targets; test changes in Chromium and WebKit.
- Motion needs a reduced-motion path. Haptics and audio unlock are progressive enhancements.

`src/lib/audio.ts` owns generated cues/music and background tracks. `src/lib/musicVolumePolicy.ts` maps the visible Music slider to its lower gain range. Do not add competing Host/Presentation audio systems.

## Documentation checklist

Update the closest owner document when behavior changes: [gameplay.md](gameplay.md) for rules, [networking.md](networking.md) for LAN/reconnect, [architecture.md](architecture.md) for state/storage, [question-packs.md](question-packs.md) for authoring, this file for commands/CI, and [../README.md](../README.md) for user-facing setup.
