# Architecture

## Runtime and state ownership

Blue Stage Trivia runs from the user's laptop for multiplayer. `server/index.ts` serves the built React/Vite application and Socket.IO on one LAN port. `server/gameServer.ts` owns the active socket sessions and calls the shared `BrowserGameEngine` in the Node process. The Host browser, phones, and remote Presentation browser render server snapshots and send actions; a Host tab is never the game server.

```text
                      Laptop (Node, port 3000)
                 ┌───────────────────────────────┐
                 │ HTTP app + Socket.IO           │
                 │ server/gameServer.ts           │
                 │ BrowserGameEngine              │
                 │ .data/rooms.json               │
                 └──────────────┬────────────────┘
                                │ local Wi-Fi / LAN
                    ┌───────────┼────────────┐
                    │           │            │
               Host browser  Player phones  Presentation
```

`npm start` builds and starts the production app on `0.0.0.0:3000`; `npm run dev` runs the same server with Vite middleware. The server advertises a runtime-discovered numeric LAN address through `/api/network`. `/api/packs` and `/api/qr` are also real server routes. GitHub Pages may host a static preview, but it cannot run this authority and is not a multiplayer endpoint.

## Main entry points

- `server/index.ts` — LAN listener, production static files or development Vite middleware, network/pack/QR endpoints, shutdown
- `server/gameServer.ts` — room socket ownership, request dispatch, authorization, retries, timer and heartbeat maintenance, role-specific broadcasts
- `server/storage.ts` — atomic file-backed implementation of the engine's Storage contract
- `src/lib/browserGameEngine.ts` — one authoritative game-rule and state-transition implementation, instantiated on the server
- `src/lib/socket.ts` — Socket.IO client adapter retaining the UI's `emitAck` and `socket.on/off` interface
- `src/lib/clientLifecycle.ts` — page and connectivity lifecycle recovery
- `src/lib/snapshotSecurity.ts` — role-specific snapshot privacy
- `src/App.tsx` and `src/components/` — Host, player, in-page board, and remote Presentation interfaces
- `src/shared/` and `src/packs/` — shared state contracts, validation, game modes, and question content

## State and persistence

`RoomState` and `RoomSnapshot` in `src/shared/types.ts` cover player IDs and seats, scores/streaks, board and used clues, question and answer phases, wagers, timers, Final participation/review, and game completion. Only the server changes these fields. The engine records authoritative rooms, credentials, question state, and timer deadlines in `.data/rooms.json` using a versioned primary/backup payload. On process restart it restores valid nonexpired rooms, marks old sockets disconnected, and reconciles timer deadlines. The data file is local to the laptop and excluded from Git.

The Host browser stores its room code and Host token under `blue-stage-host-room`; each phone stores its player ID, reconnect token, and room code under `blue-stage-player`. Those are reconnect credentials, not copies of authoritative game state. A Host refresh can reclaim a room while the Node server runs. Refreshing a phone or Presentation reconnects to the same room and receives a fresh snapshot. If the process restarts, clients reconnect to the restored room when its persisted record remains valid. New Game resets competition state while keeping the room, seats, player profiles, and credentials.

Host question history remains browser-local under `blue-stage-history-<roomCode>` for the history interface. It does not control the live board or scoring.

## Intent protocol and privacy

Every client action uses `game:request` with a request ID and named event. The server validates the bound Host, player, or Presentation role and calls the engine. Request ID journals coalesce concurrent duplicates and replay completed acknowledgements; stale question/game context is rejected. An authoritative score change emits `room:score`, followed by a new `room:state`. Room broadcasts are sent separately per socket through `sanitizeRoomSnapshot`, so a display cannot obtain Host or another player's private data by knowing a room code.

The Host token authorizes Host actions, and the current Host socket owns the role. A newer authenticated Host takeover displaces the old socket. Player reconnect tokens bind a stable player ID to the current socket; replacing a socket revokes its predecessor's mutation authority without deleting the seat. A remote Presentation URL carries a separate capability. That socket is read-only, and rotating the link revokes its capability and disconnects old displays.

Before reveal, player/Presentation snapshots exclude accepted answers and explanations, other typed responses, and unrevealed Final answers. The Final question itself remains hidden until its question phase. Review reveals only the current and previously resolved Final players. The engine remains the source of truth even when a UI delays rendering a score number for animation.

## Game flow and presentation

- Classic spoken question: select clue → buzz → reveal → Host grading → board.
- Typed/Free Response: optional reading delay → simultaneous answers → reveal/review → one confirmed authoritative scoring step → board.
- Daily Double: select owner → wager → question → reveal → Host grading.
- Final: category → wagers → answer collection/lock → Host review → recap.

The engine snapshots Final participants from connected players when Final starts. A disconnect does not block remaining participants; a late joiner can spectate but cannot enter that Final roster. An in-page fullscreen board remains part of the Host UI. A separate `?mode=presentation` browser connects to the server with its read-only capability and receives synchronized snapshots and score events. Both follow the same server state.

## Styling and verification

Styling is layered through stylesheets imported by `src/main.tsx`. `src/ui-layout-contract.css` defines shared live player-card lanes, avatar/status spacing, and flow-based modifier placement. Changes to player cards and the board should preserve those constraints and be checked in Chromium and WebKit. Engine tests cover rules and privacy; Socket.IO integration tests cover actual server dispatch, reconnect, retries, stale sockets, independent rooms, and Presentation; browser tests cover rendered user flows. Playwright WebKit is lifecycle evidence, not a physical iPhone test.
