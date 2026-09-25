# Working in this repo

LAN party-game platform (Node + Socket.IO server, React 19 + Vite client, TypeScript). First game: Blue Stage Trivia. Read `docs/architecture.md` for the big picture and `docs/development.md` → "Where a change belongs" before editing.

## Boundaries

- `src/platform/` and `server/` are shared by every game and must never import from `src/games/`. The contract is `src/platform/rooms/types.ts`.
- Each game lives in `src/games/<id>/` and registers in `src/games/registry.ts` and `server/games.ts` (a test keeps them in sync). New games: `docs/adding-a-game.md`.
- The server engine is the only source of truth for rules and scores. Screens send `game:request` intents and render snapshots; never add rules that run only in the Host tab.
- Anything a phone or TV must not see is removed by the game's `sanitize` (`src/games/trivia/engine/snapshotSecurity.ts`).

## Don't

- Don't change browser storage keys (`blue-stage-…`), game ids, or `.data/` file names; saved rooms and reconnect seats depend on them.
- Don't hand-edit `src/games/trivia/packs/generatedRegistry.ts`; run `npm run packs:sync`.
- Don't reorder `src/games/trivia/styles/index.ts`; later sheets override earlier ones and tests assert the order. Add new sheets at the end.
- Don't patch React-rendered DOM from outside React (MutationObserver/querySelector scripts). Put UI in components.

## Checks

```bash
npm run typecheck && npm run typecheck:server && npm run lint && npm test && npm run build
npm run test:e2e && npm run test:e2e:webkit   # after UI or layout changes
```

`typecheck:server` also typechecks `tests/`. Question content: `npm run questions:check` and `docs/question-packs.md`. Update the owning doc in `docs/` when behavior changes.
