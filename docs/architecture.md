# Architecture

## Platform and games

The repository is a small **game platform** with one game, Blue Stage Trivia, plugged into it. The split exists so new games can be added without touching trivia, and trivia can change without breaking anything else.

| Layer | Folder | Owns |
| --- | --- | --- |
| Platform (server) | `server/` | HTTP + Socket.IO listener, Host/player/Presentation identity, reconnects, request de-duplication, heartbeats, per-role broadcasts, room files on disk |
| Platform (browser) | `src/platform/` | Socket client and reconnect lifecycle, saved Host credentials, secure tokens, room-save recovery, audio engine, accessibility, avatars and player join, QR scanner, fullscreen |
| Game registry | `src/games/registry.ts`, `server/games.ts` | Which games exist and how to load them |
| A game | `src/games/<id>/` | Its rules engine, state types, content, screens, styles, and its server module |

Rule of thumb: **platform code never imports from `src/games/`**. A game may import from `src/platform/` freely. The contract between them is `src/platform/rooms/types.ts` (`RoomEngine` and `ServerGame`). See [adding-a-game.md](adding-a-game.md).

## Runtime and state ownership

Everything runs from the user's laptop for multiplayer. `server/index.ts` serves the built React/Vite application and Socket.IO on one LAN port. `server/roomServer.ts` owns socket sessions and forwards each request to the engine of the game that owns the room. The Host browser, phones, and remote Presentation browser render server snapshots and send actions; a Host tab is never the game server.

```text
                      Laptop (Node, port 3000)
                 ┌────────────────────────────────┐
                 │ server/index.ts  HTTP + routes │
                 │ server/roomServer.ts  sockets  │
                 │   └─ trivia: TriviaEngine      │
                 │   └─ (future games' engines)   │
                 │ .data/<game>.json  saved rooms │
                 └──────────────┬─────────────────┘
                                │ local Wi-Fi / LAN
                    ┌───────────┼────────────┐
                    │           │            │
               Host browser  Player phones  Presentation
```

`npm start` builds and starts the production app on `0.0.0.0:3000`; `npm run dev` runs the same server with Vite middleware. The server advertises a runtime-discovered numeric LAN address through `/api/network`. `/api/qr` is a platform route; `/api/packs` is contributed by trivia through its `httpRoutes`. GitHub Pages may host a static preview, but it cannot run this authority and is not a multiplayer endpoint.

## Main entry points

Platform:

- `server/index.ts` — LAN listener, production static files or development Vite middleware, network/QR endpoints plus game routes, shutdown
- `server/roomServer.ts` — room socket ownership, platform actions (reconnect, pause/remove seat, display link, controller test), game action dispatch, request journal, timer and heartbeat maintenance, role-specific broadcasts
- `server/games.ts` — the list of games the server hosts
- `server/storage.ts` — atomic file-backed implementation of the engines' `Storage` contract
- `src/main.tsx`, `src/platform/bootstrap.ts`, `src/App.tsx` — browser start-up, shared side effects (audio defaults, accessibility, reconnect lifecycle), and picking the game from `?game=` (default `trivia`)
- `src/platform/net/socket.ts` — Socket.IO client adapter (`emitAck`, `socket.on/off`, identity replay after reconnect)
- `src/platform/net/clientLifecycle.ts` — page and connectivity lifecycle recovery
- `src/platform/rooms/types.ts` — the platform/game contract

Blue Stage Trivia (`src/games/trivia/`):

- `server.ts` — registers trivia with the room server: engine factory, snapshot sanitizer, host/player actions, `room:score` events, `/api/packs`
- `engine/TriviaEngine.ts` — the one authoritative rule and state-transition implementation, instantiated on the server
- `engine/snapshotSecurity.ts` — role-specific snapshot privacy
- `rules/` — comeback scoring and Final wager rules shared by the engine and the UI
- `index.tsx`, `TriviaApp.tsx`, `components/` — menu, Host, phone, in-page board, and remote Presentation screens
- `types.ts`, `config.ts`, `gameModes.ts`, `grading.ts`, `packSchema.ts`, `packs/` — state contracts, settings, modes, answer matching, content validation, and question content
- `styles/` — trivia's stylesheets, loaded in order by `styles/index.ts`
- `dev/` — the Host-only DEV test bench

## State and persistence

`RoomState` and `RoomSnapshot` in `src/games/trivia/types.ts` cover player IDs and seats, scores/streaks, board and used clues, question and answer phases, wagers, timers, Final participation/review, and game completion. Only the server changes these fields. Each game's engine saves its rooms, credentials, question state, and timer deadlines to its own file under `.data/` (trivia keeps the original `.data/rooms.json`) using a versioned primary/backup payload. On process restart it restores valid nonexpired rooms, marks old sockets disconnected, and reconciles timer deadlines. If saving starts failing, the server tells Host screens (`server:persistence`) and the Host control panel shows a recovery warning. Data files are local to the laptop and excluded from Git.

Room codes are unique across all games, so a phone can join with the code alone and the server finds the right game.

The Host browser stores its room code and Host token per game (trivia: `blue-stage-host-room`); each trivia phone stores its player ID, reconnect token, and room code under `blue-stage-player`. Those are reconnect credentials, not copies of authoritative game state. A Host refresh can reclaim a room while the Node server runs. Refreshing a phone or Presentation reconnects to the same room and receives a fresh snapshot. If the process restarts, clients reconnect to the restored room when its persisted record remains valid. New Game resets competition state while keeping the room, seats, player profiles, and credentials.

Host question history remains browser-local under `blue-stage-history-<roomCode>` for the history interface. It does not control the live board or scoring.

## Intent protocol and privacy

Every client action uses `game:request` with a request ID and named event. The server validates the bound Host, player, or Presentation role, handles platform events itself, and passes game events to the owning game's `hostActions`/`playerActions`. Request ID journals coalesce concurrent duplicates and replay completed acknowledgements; stale question/game context is rejected. Read-only requests (health checks, heartbeats) never trigger a broadcast. After a state change the game's `onStateChange` hook runs (trivia emits `room:score` for score animations), then each socket receives `room:state` filtered by the game's `sanitize`, so a display cannot obtain Host or another player's private data by knowing a room code.

The Host token authorizes Host actions, and the current Host socket owns the role. A newer authenticated Host takeover displaces the old socket. Player reconnect tokens bind a stable player ID to the current socket; replacing a socket revokes its predecessor's mutation authority without deleting the seat. A remote Presentation URL carries a separate capability. That socket is read-only, and rotating the link revokes its capability and disconnects old displays.

Before reveal, trivia's player/Presentation snapshots exclude accepted answers and explanations, other typed responses, and unrevealed Final answers. The Final question itself remains hidden until its question phase. Review reveals only the current and previously resolved Final players. The engine remains the source of truth even when a UI delays rendering a score number for animation.

## Trivia game flow and presentation

- Classic spoken question: select clue → buzz → reveal → Host grading → board.
- Typed/Free Response: optional reading delay → simultaneous answers → reveal/review → one confirmed authoritative scoring step → board.
- Daily Double: select owner → wager → question → reveal → Host grading.
- Final: category → wagers → answer collection/lock → Host review → recap.

The engine snapshots Final participants from connected players when Final starts. A disconnect does not block remaining participants; a late joiner can spectate but cannot enter that Final roster. An in-page fullscreen board remains part of the Host UI. A separate `?mode=presentation` browser connects to the server with its read-only capability and receives synchronized snapshots and score events. Both follow the same server state.

## Styling and verification

Each game loads its own styles when it opens, so one game's CSS never reaches another's first paint. Trivia's sheets are imported in a fixed order by `src/games/trivia/styles/index.ts`; later sheets intentionally override earlier ones, and several tests assert parts of that order. `styles/ui-layout-contract.css` defines shared live player-card lanes, avatar/status spacing, and flow-based modifier placement. Changes to player cards and the board should preserve those constraints and be checked in Chromium and WebKit.

Engine tests cover rules and privacy; Socket.IO integration tests cover real server dispatch, reconnect, retries, stale sockets, independent rooms, Presentation, and two games running side by side; browser tests cover rendered user flows. Playwright WebKit is lifecycle evidence, not a physical iPhone test.
