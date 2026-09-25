# Blue Stage Trivia

A shared-screen trivia game with a Host display and up to five phone controllers. The repo is organized as a small game platform (`src/platform/`, `server/`) with trivia as its first game (`src/games/trivia/`), so more games can be added alongside it. For multiplayer, the user's laptop runs the authoritative Node + Socket.IO server; Host, phones, and Presentation connect over the same Wi-Fi/LAN.

GitHub Pages hosts a static preview, not the multiplayer server:

```text
https://ckopin21.github.io/code-copilot-jeopardy/
```

## Current features

- 0–5 player seats, including practice mode with no phones
- Classic mode with buzzers plus Free Response mode where every active player answers simultaneously
- QR/camera join plus manual room codes and click-to-enlarge host QR
- stable phone identity with automatic reconnect, heartbeat disconnect detection, and reserved seats
- host can return to the main menu without dropping controllers; starting a new game reuses the same room, seats, and player profiles while resetting game progress
- host-selectable board with in-page fullscreen presentation mode
- first-buzz locking, keyboard/gamepad host buzzers, typed-response questions
- Daily Doubles with fixed wager choices
- visible locked wagers and points in play on host and phones
- 2× final-six and 3× final-three question values
- On Fire and Cold Streak states
- animated score transfer from used clue to player card, with impact/heartbeat score change
- used board tiles retain player name + correct/incorrect result; unanswered reveals use a centered completion mark
- Final Round fixed wagers: 0, board values, or All In when score is positive
- host-controlled Final reveal with a staged tension sequence
- staged end podium followed by readable host statistics and individual phone statistics
- temporary seat pause versus permanent player removal controls
- host audio mixer with generated game cues/music plus selectable background tracks; fresh instances start at Master 75%, Music 50%, Effects 75%
- short haptic pulse on phone button presses when the browser supports the Vibration API
- player customization for avatar, accent, buzzer sound, score effect, and victory effect
- reduced-motion, larger-text, increased-contrast, and sound-caption accessibility support
- built-in question packs with automatic pack registration and validation; pack availability is filtered by game mode and one pack is selected per game
- mobile/WebKit recovery that reconnects and reauthenticates after bfcache restore, background resume, or network return

## Documentation

The maintained documentation index is [`docs/README.md`](docs/README.md).

- [`docs/gameplay.md`](docs/gameplay.md) — complete game/rule flow
- [`docs/experience.md`](docs/experience.md) — player customization, host controls, presets, undo, recovery, awards, accessibility
- [`docs/architecture.md`](docs/architecture.md) — runtime, state ownership, storage, UI architecture
- [`docs/networking.md`](docs/networking.md) — Socket.IO, reconnects, reserved seats, LAN troubleshooting
- [`docs/question-packs.md`](docs/question-packs.md) — easiest way to add questions and packs
- [`docs/development.md`](docs/development.md) — repository layout, where each kind of change belongs, tests, CI, renaming
- [`docs/adding-a-game.md`](docs/adding-a-game.md) — how to add another game to this repo

## Run a multiplayer game on the laptop

Install Node.js 22+ once, then run:

```bash
npm ci
npm start
```

`npm start` builds the app and starts its HTTP/Socket.IO server on port 3000, listening on the LAN. Open the printed Host URL on the laptop. Allow Node.js through Windows Firewall for **Private** networks if prompted. Put the laptop and phones on the same reachable Wi-Fi; the Host shows a room code, player Join URL/QR, and an optional Presentation link. Keep the server process running during the game. `npm run dev` starts the same server with Vite for development. [Start here](START-HERE.md) has the short setup and connection checklist.

The laptop server owns rooms, gameplay, and scoring through `src/games/trivia/engine/TriviaEngine.ts`. The browser Host is an authenticated client; refreshing it leaves the room on the server. Phones and a remote Presentation browser connect through `src/platform/net/socket.ts`, the Socket.IO client adapter. Normal same-room gameplay needs no public Internet after dependencies and assets are installed. GitHub Pages cannot host the Node server and is only useful as a static preview or landing page.

### Game flow

1. Choose **Start New Game** or **Continue Game**. If a saved room exists, Start New Game keeps its players/profiles and resets only game progress.
2. Select Classic or Free Response, one compatible question pack, and the rules in the lobby.
3. Choose Quick (16 clues), Standard (25), or Marathon (36, including the 1000-point row).
4. Players join by QR or room code.
5. Host starts the game.
6. Host selects a question from the normal or fullscreen board.
7. Question response/reveal/grading runs according to its response mode.
8. Correct/incorrect grading returns to the board when complete; unanswered reveals wait for the host to continue.
9. Late-game multipliers apply to the last six/three questions when enabled.
10. Final Round collects wagers and phone answers when enabled, then waits for the host's staged reveal.
11. Podium reveal plays, then host and phone player statistics are shown.

See [`docs/gameplay.md`](docs/gameplay.md) for exact behavior.

## Reconnect behavior

A joined phone receives a stable player ID and reconnect token stored in that browser. If the phone leaves the page, refreshes, loses connectivity, or disappears without a clean socket close, its seat remains reserved until it returns or the Host permanently removes it. The server uses authenticated heartbeats to detect stale mobile tabs.

Disconnected players disappear from the connected-player strip but retain score and seat state. **Pause seat** deliberately disconnects a controller while keeping that state; **Remove** deletes the player and reconnect identity. Connected-player-only phases do not wait forever on disconnected phones.

See [`docs/networking.md`](docs/networking.md).

## Audio

Game cues and dynamic phase music use Web Audio, and the host can also select bundled background tracks. On a fresh instance, the visible audio controls start at Master 75%, Music 50%, and Sound Effects 75%. The Music control is intentionally gain-limited internally, so its 0–100% slider maps to a lower music-gain range than Master/Effects.

Audio settings persist locally. Player phones are effects-focused, while host/presentation audio follows the active game phase. In-page Presentation Mode does not create an independent host audio system.

## Daily Double

Daily Double ownership follows the active controller/last-resolved player automatically; there is no separate board selector. In zero-player practice mode, an otherwise hidden Daily Double is treated as a normal clue because there is no player who can own a wager.

Available wagers are fixed presets:

```text
100, 200, 300, 400, 500, 1000
```

The same choices are visible on the active player's phone and host screen. Other phones can see the available choices. After lock-in, every connected screen can see the chosen wager and total points in play.

## Final Round

Final wager choices are:

```text
0, 100, 200, 300, 400, 500, 1000, ALL IN
```

All In shows the player's current positive score and is disabled at zero/negative score. Host status cards show the locked wager amount. Missing wagers become 0 if the host starts the Final question early.

Only players connected when Final begins become Final participants. Final answer submission closes when every active Final participant submits or the timer expires, but the accepted answer remains hidden until the host begins review. Late submissions are rejected after that lock. Player/presentation snapshots reveal only the currently reviewed or already resolved Final responses, not future players' answers.

## Question packs

Built-in packs live in `src/games/trivia/packs/`.

To add a new built-in pack:

1. Copy `src/games/trivia/packs/_pack.template.ts.example` to a new `.ts` file.
2. Fill in metadata/categories/questions.
3. Export one `somethingPack` created with `buildPack(...)`.
4. Run a normal dev/test/build command.

The registry is generated automatically; do not edit `src/games/trivia/packs/index.ts` or `src/games/trivia/packs/generatedRegistry.ts` just to add a pack.

Preferred category authoring uses explicit point keys:

```ts
category('Category', {
  100: question('Question?', 'Answer'),
  200: question('Question?', 'Answer'),
  300: question('Question?', 'Answer'),
  400: question('Question?', 'Answer'),
  500: question('Question?', 'Answer'),
  1000: question('Question?', 'Answer')
})
```

See [`docs/question-packs.md`](docs/question-packs.md) for all options and validation rules.

## Development and validation

Requires Node.js 22+.

Run `npm run dev` for live development on the same laptop server architecture.

Useful commands:

```bash
npm run packs:sync
npm run typecheck
npm run typecheck:server
npm run lint
npm test
npm run build
```

Dependencies are pinned and `package-lock.json` is committed so local and CI installs resolve the same dependency graph. Pack registration is automatically refreshed before dev, typecheck, tests, and builds.

## Testing and CI

Tests exercise the production `TriviaEngine`, the room server hosting two games side by side, multiplayer snapshot privacy, answer normalization, game modes, pack loading/validation, game-length boards, reconnect identity, timer restoration, Daily Doubles, Free Response grading/rejoin behavior, Final participation/privacy, customization/layout regressions, and mobile recovery policies.

GitHub Actions uses the committed lockfile, runs typecheck, lint, Vitest, and a production build, then runs Playwright in Chromium. Selected Safari/mobile and player-card regressions also run in WebKit.

Real physical devices still need smoke testing for camera scanning, haptics, audio unlock, Wi-Fi reachability, screen lock, and Safari/Android lifecycle behavior. Playwright WebKit is not a physical iPhone.

## Security/authority model

The laptop server is authoritative for room/game state. Host actions require a secret Host token and the current Host socket. Player actions require stable player IDs and reconnect tokens. Phones request actions but do not directly mutate scores or game phases; remote Presentation is read-only and uses a revocable display capability.

Snapshots are sanitized by role before being sent. Hidden clue answers/explanations, unrevealed typed-response details, and future Final responses are withheld from player/presentation clients until their reveal phase.

React renders names/questions as text, avoiding raw HTML injection for normal content paths.

## Reset behavior

**New Game / Reset Game** keeps the room, active controller connections, reserved seats, and player profiles, but resets the board, scores, statistics, current phase, and question history. Phones receive the lobby state immediately. Returning the host to the main menu uses in-app navigation; active gameplay is paused first so timers do not continue off-screen.

**Reset Instance** clears browser-side saved credentials/preferences and reloads the current application build. The laptop server's persisted room data is separate; removing it requires stopping the server and intentionally deleting its local `.data/rooms.json` file.
