# Blue Stage Trivia

A shared-screen browser trivia game with a host display and up to five phone controllers. The deployed version runs on GitHub Pages: the host browser owns the game state and player phones connect directly with PeerJS/WebRTC.

Live game:

```text
https://ckopin21.github.io/code-copilot-jeopardy/
```

## Current features

- 0–5 player seats, including practice mode with no phones
- Classic mode with buzzers plus Free Response mode where every active player answers simultaneously
- QR/camera join plus manual room codes and click-to-enlarge host QR
- stable phone identity with automatic reconnect, heartbeat disconnect detection, reserved seats, and persistent party carry-over between games
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
- seven built-in question packs with automatic pack registration and validation; pack availability is filtered by game mode and one pack is selected per game
- mobile/WebKit recovery that rebuilds stale PeerJS/WebRTC transports after bfcache restore, meaningful background resume, or network return

## Documentation

The maintained documentation index is [`docs/README.md`](docs/README.md).

- [`docs/gameplay.md`](docs/gameplay.md) — complete game/rule flow
- [`docs/experience.md`](docs/experience.md) — player customization, host controls, presets, undo, recovery, awards, accessibility
- [`docs/architecture.md`](docs/architecture.md) — runtime, state ownership, storage, UI architecture
- [`docs/networking.md`](docs/networking.md) — WebRTC/PeerJS, reconnects, reserved seats, failure behavior
- [`docs/question-packs.md`](docs/question-packs.md) — easiest way to add questions and packs
- [`docs/development.md`](docs/development.md) — repository layout, tests, CI, deployment, change checklist

## Runtime: GitHub Pages + PeerJS

The build is static. `src/lib/browserGameEngine.ts` is the authoritative game engine and stores active room state in the host browser. `src/lib/socket.ts` connects phones and presentation screens to the host over PeerJS/WebRTC.

There is one game engine and one multiplayer authority path. The former alternate Node/Socket.IO backend was removed so tests, local builds, and production cannot drift between separate implementations.

The host page is the live room endpoint. If it closes, phones cannot keep playing until the host page is reopened and restores the saved room.

### Game flow

1. Choose **Start New Game** or **Continue Saved Game**. If a saved room already exists, **Start New Game** reuses that room and current party while resetting game progress.
2. Select Classic or Free Response, one compatible question pack, and the rules in the lobby.
3. Choose Quick (16 clues), Standard (25), or Marathon (36, including the 1000-point row).
4. Players join by QR or room code.
5. Host starts the game.
6. Host selects a question from the normal or fullscreen board.
7. Question response/reveal/grading runs according to its response mode.
8. Correct/incorrect grading returns to the board when complete; unanswered reveals wait for the host to continue.
9. Late-game multipliers apply to the last six/three questions when enabled.
10. Final Round collects wagers and phone answers when enabled, then waits for the host's staged reveal.
11. Podium reveal plays, then the host can immediately choose **Start New Game** with the same connected party or view the full game statistics.

See [`docs/gameplay.md`](docs/gameplay.md) for exact behavior.

## Reconnect behavior

A joined phone receives a stable player ID and reconnect token stored in that browser. If the phone intentionally leaves, refreshes, loses connectivity, or disappears without a clean WebRTC close, its seat remains reserved until it returns or the host permanently removes/resets it. The host also uses an authenticated heartbeat timeout to detect stale mobile tabs.

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

Built-in packs live in `src/packs/`.

To add a new built-in pack:

1. Copy `src/packs/_pack.template.ts.example` to a new `.ts` file.
2. Fill in metadata/categories/questions.
3. Export one `somethingPack` created with `buildPack(...)`.
4. Run a normal dev/test/build command.

The registry is generated automatically; do not edit `src/packs/index.ts` or `src/packs/generatedRegistry.ts` just to add a pack.

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

## Install and development

Requires Node.js 22+.

```bash
npm ci
npm run dev
```

Useful commands:

```bash
npm run packs:sync
npm run typecheck
npm run lint
npm test
npm run build
```

Dependencies are pinned and `package-lock.json` is committed so local and CI installs resolve the same dependency graph. Pack registration is automatically refreshed before dev, typecheck, tests, and builds.

## Testing and CI

Tests exercise the production `BrowserGameEngine`, multiplayer snapshot privacy, answer normalization, game modes, pack loading/validation, game-length boards, reconnect identity, timer restoration, Daily Doubles, Free Response grading/rejoin behavior, Final participation/privacy, customization/layout regressions, and mobile recovery policies.

GitHub Actions uses the committed lockfile, runs typecheck, lint, Vitest, and a production build, then runs Playwright in Chromium. Selected Safari/mobile and player-card regressions also run in WebKit.

Real device/network behavior still needs smoke testing for camera scanning, haptics, audio unlock behavior, and WebRTC routes that depend on the user's NAT/firewall/TURN environment.

## Security/authority model

The host browser is authoritative for room/game state. Player actions are authorized with stable player IDs and reconnect tokens. Phones request actions but do not directly mutate scores or game phases.

Snapshots are sanitized by role before being sent. Hidden clue answers/explanations, unrevealed typed-response details, and future Final responses are withheld from player/presentation clients until their reveal phase.

React renders names/questions as text, avoiding raw HTML injection for normal content paths.

## Between-game and reset behavior

Returning from the host game to the main menu uses in-app navigation instead of reloading the page. The live PeerJS host remains active, so connected phones stay connected to the same room while the host is on the menu.

When a saved room exists, **Start New Game** reuses that room. Player IDs, seats, reconnect tokens, names, avatars, accents, and other profile customization stay attached to the same players, while the board, scores, streaks, statistics, timers, Final state, and host question history reset. Phones receive the lobby state immediately without rejoining.

After a game fully finishes, the results flow exposes **Start New Game** directly so the same party can continue without returning to the join flow.

**Reset Instance** remains the destructive recovery option. It clears saved Blue Stage host/player/game state and reloads the current application build cleanly.
