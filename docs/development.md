# Development guide

## Repository map

```text
src/
  App.tsx                    top-level routing/global interaction hooks
  components/                host, phone, board, presentation, recap UI
  lib/browserGameEngine.ts   authoritative game engine
  lib/socket.ts              PeerJS/WebRTC transport, host authority, ICE/reconnect logic
  lib/clientLifecycle.ts     mobile/WebKit lifecycle recovery
  lib/snapshotSecurity.ts    role-based snapshot privacy
  lib/audio.ts               procedural music and cues
  packs/                     built-in question packs + builder/registry
  shared/                    shared types/config/validation
scripts/
  generate-pack-registry.mjs automatic built-in pack discovery
tests/
  browserGameEngine.test.ts
  snapshotSecurity.test.ts
  validation.test.ts
  packs.test.ts
  gameLengthConfig.test.ts
docs/                        maintained technical/gameplay documentation
```

## Install and run

```bash
npm ci
npm run dev
```

`npm run dev` starts Vite on the local machine. The same browser/P2P engine used by GitHub Pages is the gameplay runtime used during development.

For a production-style local build:

```bash
npm run build
npm start
```

`npm start` serves the built static app through Vite Preview on port 3000.

## Dependency reproducibility

Runtime and development dependencies are pinned in `package.json`, and `package-lock.json` is committed. Use `npm ci` for clean installs so local machines and GitHub Actions use the exact locked dependency graph.

Do not replace pinned versions with `latest` without intentionally regenerating and validating the lockfile.

## Quality commands

```bash
npm run packs:sync
npm run typecheck
npm run lint
npm test
npm run test:e2e
npm run test:e2e:webkit
npm run build
```

`npm run dev`, `npm run typecheck`, `npm test`, and `npm run build` automatically regenerate the built-in pack registry first. `npm run test:e2e` runs the locked Playwright Chromium suite; `npm run test:e2e:webkit` runs the equivalent WebKit suite. Install browser binaries once with `npx playwright install chromium webkit` (CI uses `--with-deps`).

The default browser suites are deterministic rendered checks. When a networked browser and the public PeerJS signaling service are available, run the real host/controller smoke separately with `BLUE_STAGE_REAL_PEERJS=1 npx playwright test e2e/real-peerjs-smoke.spec.ts --project=chromium`. It creates a room, joins a separate controller context, buzzes, scores, and reloads the controller to verify its seat recovery. Do not treat this opt-in smoke as evidence for restrictive-NAT, TURN, cellular, or physical-device behavior.

A change is ready to deploy only after typecheck, lint, Vitest, production build, and applicable browser regressions pass. The main CI workflow installs the locked dependencies, runs typecheck/lint/unit tests/build, installs Playwright Chromium + WebKit, runs the complete Playwright suite in Chromium, then reruns the Safari/mobile smoke and player-card layout suites in WebKit. The Pages workflow builds/deploys the static site.

## GitHub Pages deployment

The live static app is deployed from the repository workflow to:

```text
https://ckopin21.github.io/code-copilot-jeopardy/
```

The game does not require an application server. Multiplayer uses PeerJS/WebRTC and the host browser is authoritative for room/game state.

## Safely changing gameplay

For a gameplay change, inspect all of these before editing:

1. `src/shared/types.ts` — state contract
2. `src/lib/browserGameEngine.ts` — authoritative rule/state transition
3. `src/lib/snapshotSecurity.ts` — privacy impact of new state
4. `src/components/HostAppV3.tsx` — host rendering/control flow
5. `src/components/PlayerApp.tsx` — phone rendering/control flow
6. `src/lib/socket.ts` — transport/authorization if the action crosses devices
7. `tests/` — regression coverage
8. `docs/gameplay.md` — documented expected behavior

There is no second server engine to keep in sync. Production and tests should target `BrowserGameEngine` directly.

## UI interaction rules

- Host is the authority for correctness and manual score resolution.
- Phone UI should derive state from room snapshots, not invent local game phases.
- A network action should be idempotent or safely reject duplicate/stale actions where possible.
- Reset Game must propagate through a room snapshot; phones should not require reload.
- Disconnected reserved players must not block active connected players.
- Hidden answers/explanations and unrevealed player responses must not cross the snapshot privacy boundary.
- Presentation mode is an in-page overlay and must use the same board selection callback as the normal board.
- Score animation may delay display of the new score, but it must not delay authoritative engine state.
- Motion must have a reduced-motion fallback.
- Haptics are progressive enhancement only; absence of the Vibration API cannot break controls.

## Audio rules

`src/lib/audio.ts` owns generated cues/dynamic phase music and selectable bundled background tracks. `src/App.tsx` owns global click cues and the audio-default migration, while `src/lib/musicVolumePolicy.ts` maps the visible Music slider to its intentionally lower internal gain range. Fresh instances show Master 75%, Music 50%, and Effects 75%. Do not add overlapping independent audio systems for host/presentation surfaces.

## Question pack workflow

Do not hand-edit `src/packs/generatedRegistry.ts`. Add/copy a pack file and let `npm run packs:sync` regenerate the registry. See `question-packs.md` for the preferred explicit point-value authoring format.

## Testing expectations

Regression tests should target the production browser engine and cover rule/state behavior rather than only visual markup. Deterministic `createSocketRuntime(...)` coverage exercises the actual request/response protocol with controlled Peer/DataConnection failures; browser suites provide rendered Chromium/WebKit evidence but do not claim physical-device or restrictive-NAT coverage. Important areas include:

- room creation and capacity
- Classic and Free Response mode behavior, including reading delay, simultaneous submissions, missing-response penalties, Group Miss Mercy, and confirm-to-score flow
- stable reconnect identity and reserved seats
- host main-menu navigation without page reload, including pause-on-leave and same-room new-game carryover
- reset/new-game preservation of player IDs, reconnect tokens, seats, connection state, and customization
- iPhone/WebKit lifecycle recovery across pagehide/pageshow, bfcache restore, background resume, online recovery, and stale Peer/DataConnection replacement
- timer persistence/restoration
- board generation and pack validation
- first-buzz acceptance and buzzer eligibility
- score gain/loss and negative-score rules
- Daily Double selection/wagers/practice-mode fallback
- late-game multipliers
- typed responses and grading
- snapshot privacy for answers/explanations/responses
- Final participant selection, wager fairness/protection rules, answer lock, timeout, disconnects, privacy, review, recap
- player customization consistency across host, phone, presentation, score effects, and recap
- rendered player-card geometry/status/avatar regressions in Chromium and WebKit
- the shared three-track player identity contract: Fire/Cold and question-turn pills must remain in the normal-flow status lane, preserve card geometry, stay contained, and never overlap an avatar, name, or score
- presentation board result modifiers: used values and modifier pills must remain centered flow siblings rather than resolution-specific positioned overlays
- reset behavior

Visual interaction changes that depend on DOM geometry, WebRTC, camera APIs, vibration, or Web Audio still require browser/device smoke testing in addition to unit tests.

## Documentation checklist

When behavior changes, update the closest owner document:

- gameplay/rules -> `docs/gameplay.md`
- networking/reconnect -> `docs/networking.md`
- runtime/state/storage -> `docs/architecture.md`
- pack format/authoring -> `docs/question-packs.md`
- commands/repo/deploy -> `docs/development.md`
- user-facing overview -> `README.md`
