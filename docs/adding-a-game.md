# Adding a new game

The repo is a platform that hosts games. Blue Stage Trivia is the first. A new game lives entirely in its own folder plus two one-line registrations, so adding one cannot break trivia.

A complete, tested, minimal game already exists: `tests/server/fixtures/counterGame.ts` (a shared tap counter). `tests/server/multiGame.test.ts` runs it next to trivia. Read those two files first.

## What the platform gives you for free

- A LAN server with Socket.IO, the Join QR, and the `/api/network` address
- Host, player, and read-only Presentation roles, with secret Host tokens, player reconnect tokens, and rotatable display links
- Automatic reconnect after refresh, screen lock, Wi-Fi drops, or a server restart
- Request de-duplication (a retried tap or double-click never applies twice)
- Heartbeats, stale-phone detection, and the Host "Test All Phones" check
- Pause-seat and Remove-player actions, plus room codes unique across every game
- Player join with name, avatar, accent, and effects (`src/platform/players/`)
- Audio engine, accessibility preferences, fullscreen, QR scanner, dialogs (`src/platform/`)

## Steps

Pick an id: lowercase kebab-case, e.g. `word-race`. Never reuse or rename it later, because it keys saved rooms and browser storage.

### 1. Engine (server state and rules)

Create `src/games/<id>/engine/`. The engine class implements `RoomEngine<YourSnapshot>` from `src/platform/rooms/types.ts`. Your snapshot must include `code` and `players: { id, connected }[]`; everything else is up to you.

- Keep **all** rules here. Screens only send requests and render snapshots.
- Use `randomToken`, `secureEqual`, and `ROOM_CODE_ALPHABET` from `src/platform/rooms/tokens.ts` for credentials.
- Pick room codes that pass the `isRoomCodeTaken` check the server gives you.
- Persist rooms to the `Storage` you're given, under your own keys (e.g. `word-race-rooms`). `src/platform/rooms/roomStorageRecovery.ts` gives you versioned primary/backup saving with corruption recovery. Report failures through `persistenceOk`/`onPersistenceChange`.
- `joinPlayer` receives input already validated by the platform join schema.
- Put join and display links in `createRoom`/`hostCredentials`, and **include `game=<id>`** in both, e.g. `${baseUrl}/?game=word-race&mode=player&room=${code}`.

### 2. Server registration

Create `src/games/<id>/server.ts` exporting a `ServerGame` (see `src/games/trivia/server.ts`):

- `storageFile`: a unique file name under `.data/`, e.g. `word-race-rooms.json`
- `createEngine(storage, { isRoomCodeTaken })`
- `sanitize(snapshot, role, playerId)`: strip anything a phone or TV must not see. This is your privacy boundary.
- `hostActions` / `playerActions`: map event names (`host:...`, `player:...`) to engine calls. Authorization is already done when these run.
- Optional `onStateChange` to emit extra room events (trivia uses it for score animations), and `httpRoutes` for read-only GET endpoints.

Add it to `SERVER_GAMES` in `server/games.ts`.

### 3. Browser entry

Create `src/games/<id>/index.tsx` with a default-exported component. Route on `?mode=` yourself (`host`, `player`, `presentation`, or no mode for your menu). Use `emitAck` and `socket` from `src/platform/net/socket.ts`:

```ts
const credentials = await emitAck<HostRoomCredentials>('room:create', { game: 'word-race', settings: {} });
writeHostCredentials(credentials); // from src/platform/session/hostCredentials.ts
```

Add it to `GAMES` in `src/games/registry.ts`. Leave `storageNamespace` unset so your browser keys become `blue-stage-<id>-…`. A test fails if the client and server registries disagree.

### 4. Styles

Import your CSS from your game's `index.tsx`, and scope every selector under a root class on your top-level element (e.g. `.word-race-app`). Styles load only when your game opens, but once loaded they stay for that tab. Scoping keeps you from restyling another game later in the same session.

### 5. Tests

Add tests under `tests/<id>/`: engine rules, `sanitize` privacy, and at least one socket test driving real `game:request` messages through `createRoomServer({ games: [...] })`, like `tests/server/multiGame.test.ts`. Run everything before committing:

```bash
npm run typecheck && npm run typecheck:server && npm run lint && npm test && npm run build
```

## Current limits

- The root URL (`/`, no `?game=`) opens trivia's menu, because trivia is `DEFAULT_GAME_ID`. Once there are two games, add a game picker there or give the new game its own start link.
- The phone "Join a Game" screen with manual room-code entry is part of trivia. Phones joining another game should use that game's Join link or QR, which carries `game=<id>`. A shared join-by-code screen belongs in the platform when a second game ships.
- Background music tracks in `public/audio/` and the audio engine's music themes are shared.
