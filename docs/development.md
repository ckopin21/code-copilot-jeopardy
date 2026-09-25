# Development guide

## Repository map

```text
server/                       platform: runs on the laptop
  index.ts                    HTTP/static/Vite server, LAN + game routes, startup
  roomServer.ts               Socket.IO sessions, identity, dispatch, journal, broadcasts
  games.ts                    games the server hosts
  storage.ts                  atomic file-backed room storage
src/
  main.tsx, App.tsx           browser entry; picks the game from ?game=
  platform/                   shared by every game (never imports src/games)
    bootstrap.ts              start-up side effects (audio defaults, accessibility)
    net/                      socket client, reconnect lifecycle
    rooms/                    platform/game contract (types.ts), tokens, save recovery
    session/                  saved Host credentials, reset, active game
    players/                  avatars, customization, join schema, score effects
    audio/                    cue/music engine and policies
    ui/                       accessibility, dialogs, QR scanner, fullscreen
  games/
    registry.ts               games the browser can open
    trivia/                   Blue Stage Trivia
      index.tsx, TriviaApp.tsx  entry, menu, Host/phone/Presentation routing
      server.ts               server registration (actions, sanitizer, score events)
      engine/                 TriviaEngine and snapshot privacy
      rules/                  comeback and Final wager rules
      components/ ui/ dev/    screens, UI helpers, DEV test bench
      packs/                  question packs and generated registry
      styles/                 stylesheets, ordered by styles/index.ts
scripts/
  generate-pack-registry.mjs  automatic pack registration/check
tests/
  platform/ server/ trivia/   unit and integration tests (server/fixtures has a minimal example game)
e2e/                          rendered Chromium and WebKit regressions
docs/                         maintained technical and gameplay documentation
```

## Install and run

Node.js 22+ is required on the laptop. `npm ci` installs the committed lockfile. For real gameplay, `npm start` builds the app and starts the authoritative HTTP/Socket.IO server on port 3000 (`npm run serve` starts an already-built app without rebuilding). For development, `npm run dev` starts the same server with Vite middleware and hot reload. Both bind to `0.0.0.0` by default and print a LAN Host URL. The Join QR uses the server's runtime-discovered LAN address; set `BLUE_STAGE_BASE_URL` if another adapter is preferred. `PORT` and `HOST` can change the listener.

```bash
npm ci
npm start
```

The server serves `/api/network`, `/api/qr`, and routes contributed by games (trivia adds `/api/packs`). Room data is saved locally under `.data/` (trivia: `.data/rooms.json`) and excluded from Git. Keep the server running throughout a game. The Host browser may reload without deleting the server room. `START-WINDOWS.bat` and `START-MAC.command` offer launcher flows. Windows Firewall must permit Node.js on the Private network for phone access; guest-network isolation or a VPN can still block local traffic.

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

Pack registration is generated from source files in `src/games/trivia/packs/`; do not hand-edit `src/games/trivia/packs/generatedRegistry.ts`. `packs:check` detects registry drift and `questions:check` runs content safeguards. See [question-packs.md](question-packs.md) for the canonical authoring workflow. Typecheck covers the browser configuration; `typecheck:server` covers the server, all of `src/`, and the unit tests; build produces `dist-client` for the Node server. Install Playwright browsers once with `npx playwright install chromium webkit` (CI uses `--with-deps`).

Run browser tests against the local integrated server. Chromium and WebKit validate rendered and simulated lifecycle behavior. They do not prove physical iPhone Safari, Android, camera, haptics, or every Wi-Fi configuration; use the [real-device test matrix](real-device-test-matrix.md) for that evidence. The old opt-in public PeerJS reservation smoke was transport-specific and has been retired; its join/reload/recovery behavior belongs in local Socket.IO tests and WebKit browser coverage.

## Where a change belongs

| You are changing… | Edit | Don't touch |
| --- | --- | --- |
| A trivia rule, score, phase, or setting | `src/games/trivia/engine/`, `rules/`, `types.ts`, `config.ts`, then the trivia screens | `server/`, `src/platform/` |
| A new trivia Host/player action | the engine method, then an entry in `src/games/trivia/server.ts` `hostActions`/`playerActions`, then the screen that sends it | `server/roomServer.ts` |
| What a phone or TV may see | `src/games/trivia/engine/snapshotSecurity.ts` | |
| Questions | `src/games/trivia/packs/` (see [question-packs.md](question-packs.md)) | the generated registry |
| Trivia looks | `src/games/trivia/styles/` (add new sheets at the end of `styles/index.ts`) | platform files |
| Reconnects, identity, seats, heartbeats | `server/roomServer.ts`, `src/platform/net/` | any game |
| Something every game should get | `src/platform/` | — keep it free of game imports |
| A whole new game | see [adding-a-game.md](adding-a-game.md) | trivia |

## Safely changing gameplay

For a trivia action, inspect the shared state in `src/games/trivia/types.ts`, transition in `src/games/trivia/engine/TriviaEngine.ts`, role filtering in `src/games/trivia/engine/snapshotSecurity.ts`, action wiring in `src/games/trivia/server.ts`, the client request adapter in `src/platform/net/socket.ts`, the relevant Host/player/Presentation UI, tests, and [gameplay.md](gameplay.md). There is one rule engine; the server owns its instance. Do not create client-side score authority, a second rule implementation, or rules that only run in the Host tab.

Important regression areas include independent rooms, duplicate request acknowledgements, stale Host/player socket rejection, mass disconnect recovery, reserved seats and late joins, Host and Presentation reloads, Free Response, Daily Double, Final privacy, rematch/new game, and score effects after authoritative updates. Drive real `game:request` messages through `createRoomServer(...)` for server integration tests instead of mocking a replacement protocol.

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

`src/platform/audio/audio.ts` owns generated cues/music and background tracks. `src/platform/audio/musicVolumePolicy.ts` maps the visible Music slider to its lower gain range. Do not add competing Host/Presentation audio systems.

## Renaming the repository or product

Names are kept in a few deliberate places. To rename the repo or app, update: `package.json` `name`, the GitHub Pages URL in `README.md`, `<title>` in `index.html`, the start-up message in `server/index.ts`, launcher window titles in `START-WINDOWS.bat`, and each game's `title` in `src/games/registry.ts`. Do **not** change browser storage keys (`blue-stage-…`), game ids, or `.data/` file names — they are how saved rooms and reconnect seats are found, and changing them silently loses them. GitHub Pages uses a relative base path, so a new repo name needs no build change.

## Documentation checklist

Update the closest owner document when behavior changes: [gameplay.md](gameplay.md) for rules, [networking.md](networking.md) for LAN/reconnect, [architecture.md](architecture.md) for state/storage and the platform/game split, [adding-a-game.md](adding-a-game.md) for the game contract, [question-packs.md](question-packs.md) for authoring, this file for commands/CI, and [../README.md](../README.md) for user-facing setup.
