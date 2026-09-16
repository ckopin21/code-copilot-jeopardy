# Development guide

## Repository map

```text
src/
  App.tsx                    top-level routing/global interaction hooks
  components/                host, phone, board, presentation, recap UI
  lib/browserGameEngine.ts   authoritative engine for GitHub Pages
  lib/socket.ts              PeerJS/WebRTC transport for Pages
  lib/audio.ts               procedural music and cues
  packs/                     built-in question packs + builder/registry
  shared/                    shared types/config/validation
server/
  gameEngine.ts              alternate Node runtime engine
  index.ts                   Express/Socket.IO server
  packRegistry.ts            Node custom-pack support
  persistence.ts             Node file persistence
scripts/
  generate-pack-registry.mjs automatic built-in pack discovery
  postbuild.cjs              production build post-processing
tests/
  gameEngine.test.ts
  validation.test.ts
  packs.test.ts
docs/                        maintained technical/gameplay documentation
```

## Install and run

```bash
npm install
npm run dev
```

The dev command starts both the Node server and Vite client. For the primary GitHub Pages behavior, the browser/P2P path is the important runtime. The Node path is still compiled and tested to avoid silent breakage.

## Quality commands

```bash
npm run packs:sync
npm run typecheck
npm run lint
npm test
npm run build
```

`npm run dev`, `npm run typecheck`, `npm test`, and `npm run build` automatically regenerate the built-in pack registry first.

A change is ready to deploy only after typecheck, lint, tests, and production build pass. GitHub Actions runs these checks and the Pages workflow builds/deploys the static site.

## GitHub Pages deployment

The live static app is deployed from the repository workflow to:

```text
https://ckopin21.github.io/code-copilot-jeopardy/
```

Pages must not depend on a Node server being online. Browser-hosted multiplayer uses PeerJS/WebRTC and the browser engine.

## Alternate Node deployment

The Node runtime is built with:

```bash
npm run build
npm start
```

It needs a host that supports long-lived WebSocket connections. `.data` persistence only applies to the Node implementation.

## Safely changing gameplay

For a gameplay change, inspect all of these before editing:

1. `src/shared/types.ts` — shared state contract
2. `src/lib/browserGameEngine.ts` — Pages rule/state transition
3. `src/components/HostAppV3.tsx` — host rendering/control flow
4. `src/components/PlayerApp.tsx` — phone rendering/control flow
5. `src/lib/socket.ts` — transport/authorization if the action crosses devices
6. `tests/` — regression coverage
7. `docs/gameplay.md` — documented expected behavior

If the feature must also work in the Node runtime, additionally update/test `server/gameEngine.ts` and `server/index.ts`.

## UI interaction rules

- Host is the authority for correctness and manual score resolution.
- Phone UI should derive state from room snapshots, not invent local game phases.
- A network action should be idempotent or safely reject duplicate/stale actions where possible.
- Reset Game must propagate through a room snapshot; phones should not require reload.
- Disconnected reserved players must not block active connected players.
- Presentation mode is an in-page overlay and must use the same board selection callback as the normal board.
- Score animation may delay display of the new score, but it must not delay authoritative engine state.
- Motion must have a reduced-motion fallback.
- Haptics are progressive enhancement only; absence of the Vibration API cannot break controls.

## Audio rules

`src/lib/audio.ts` uses generated Web Audio tones. `src/App.tsx` owns global click cues and the current default-volume migration. Master/Music/Effects default to 75% for this version. Do not add overlapping independent audio players for presentation mode.

## Question pack workflow

Do not hand-edit `src/packs/generatedRegistry.ts`. Add/copy a pack file and let `npm run packs:sync` regenerate the registry. See `question-packs.md` for the preferred explicit point-value authoring format.

## Testing expectations

Regression tests should cover rule/state behavior rather than only visual markup. Important areas include:

- room creation and capacity
- stable reconnect identity
- disconnect/reserved-seat behavior
- board generation and pack validation
- first-buzz acceptance and buzzer eligibility
- score gain/loss and negative-score rules
- Daily Double selection/wagers
- late-game multipliers
- typed responses and grading
- Final wagers/answers/review
- reset behavior
- completion/recap

Visual interaction changes that depend on DOM geometry, WebRTC, camera APIs, vibration, or Web Audio still require browser/device smoke testing in addition to unit tests.

## Documentation checklist

When behavior changes, update the closest owner document:

- gameplay/rules -> `docs/gameplay.md`
- networking/reconnect -> `docs/networking.md`
- runtime/state/storage -> `docs/architecture.md`
- pack format/authoring -> `docs/question-packs.md`
- commands/repo/deploy -> `docs/development.md`
- user-facing overview -> `README.md`
