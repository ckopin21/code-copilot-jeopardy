# Blue Stage Trivia

A server-authoritative multiplayer quiz-show party game for a host screen, player phones, and an optional presentation display. It uses original visuals and procedural Web Audio cues rather than copyrighted Jeopardy branding, music, or sound effects.

## Features

- 0–5 players: practice, solo, or competitive multiplayer
- Short room codes, phone join URLs, and QR codes
- Stable player identity across refresh/reconnect
- Server-authoritative buzz order, scoring, timers, wagers, and state transitions
- Host console plus board-only TV/projector presentation view
- Phone-first buzzer with large touch target
- Local keyboard buzzers (`1`–`5`) and Gamepad API support
- Animated scoring, On Fire streaks, Cold Streaks, Daily Doubles, Double/Triple late-game phases
- Secret Final Round wagers and phone answer submission
- End-game recap with accuracy, streaks, wagers, buzz timing, and score movement
- Independent master/music/effects controls with persistent preferences
- Three built-in 60-question packs: Disney, Movies & TV, Science & Nature
- JSON custom-pack import with server-side validation
- Quick, Standard, and Marathon board presets
- Reduced-motion support, keyboard focus, semantic controls, and responsive layouts
- Active room persistence through host refresh and server restart when `.data` is persistent

## Screenshots

Screenshots can be added under `docs/screenshots/` after deployment.

## Stack

- Node.js 22+
- TypeScript
- Express
- Socket.IO
- React + Vite
- Vitest
- ESLint

The server owns all game state. Clients request actions but never award points, choose the accepted buzz, resolve correctness, or mutate room state directly.

## Install

```bash
npm install
npm run dev
```

Development starts:

- Vite client: `http://localhost:5173`
- Socket/Express server: `http://localhost:3000`

Vite proxies `/api` and `/socket.io` to the server.

## Local-network phone play

Run `npm run dev`, then use the LAN address printed by the Node server, for example:

```text
http://192.168.1.25:3000
```

For the simplest same-Wi-Fi development flow, build once and run the production server so the host page and WebSocket server use the same port:

```bash
npm run build
npm start
```

Open the printed LAN URL on the host computer. The lobby QR code and join link use a phone-reachable LAN address when one can be detected.

If a phone cannot connect:

1. Confirm the phone and host are on the same LAN/Wi-Fi.
2. Allow inbound Node.js traffic through the host firewall.
3. Avoid guest Wi-Fi/client isolation networks.
4. Set `PUBLIC_BASE_URL` if automatic LAN detection is wrong.

## Game flow

1. Open `/` and choose **Host a Game**.
2. Select one or more question packs and game rules.
3. Players scan the QR code or open `/?mode=player&room=ABCDE`.
4. Start the game with 0–5 players.
5. Host selects board tiles and opens buzzers.
6. The server accepts the first eligible buzz it receives and locks the rest.
7. Host marks the answer correct/incorrect. With steals enabled, remaining players can buzz after a miss.
8. At six remaining questions, points become 2×. At three remaining, points become 3×.
9. If enabled, Final Round collects secret wagers and typed answers from phones.
10. The recap shows scores and player statistics.

## Daily Doubles

Daily Doubles are assigned randomly to eligible board questions at game generation time. The default is three. The host chooses/retains the answering player, then selects a fixed wager (`100`, `200`, `300`, `400`, `500`, `1000`) or a custom amount. Wager limits and late-game multiplier stacking are configurable.

## Streaks

- **On Fire** activates after three consecutive correct answers.
- **Cold Streak** activates after the configured number of consecutive misses, default three.
- Correct answers clear Cold Streak; incorrect answers clear On Fire progress.

## Final Round

1. Final category reveal
2. Secret player wagers
3. Final question reveal
4. Private phone answer submission
5. Host reviews answers one at a time
6. Wagers are added/subtracted
7. Final scores and winner ceremony

Exact answer normalization is available, but the host can override correctness for human-language ambiguity.

## Presentation view

The host lobby exposes a presentation URL:

```text
/?mode=presentation&room=ABCDE
```

This view hides host controls and is intended for a TV, projector, or screen share.

## Question packs

Built-in packs live in `src/packs/`. Custom JSON packs can be imported with:

```bash
curl -X POST http://localhost:3000/api/packs/import \
  -H 'content-type: application/json' \
  --data @my-pack.json
```

See [`docs/question-packs.md`](docs/question-packs.md) for the schema and validation rules.

## Scripts

```bash
npm run dev        # server + Vite dev clients
npm run typecheck  # client and server TypeScript
npm run lint       # ESLint
npm test           # Vitest engine tests
npm run build      # typecheck + Vite build + server compile
npm start          # production server after build
```

## Environment

Copy `.env.example` if needed:

```text
PORT=3000
HOST=0.0.0.0
PUBLIC_BASE_URL=
ROOM_TTL_MINUTES=180
```

`PUBLIC_BASE_URL` should be the externally reachable origin when deployed behind a proxy or when LAN auto-detection is not suitable.

## Persistence

Active room snapshots are stored in `.data/rooms.json`. Custom packs are stored in `.data/custom-packs.json`. This first release intentionally uses an abstracted file adapter instead of requiring a database. For horizontally scaled production, replace the persistence adapter with shared storage and use a Socket.IO multi-node adapter.

## Production deployment

Use any Node hosting platform that supports long-lived WebSocket connections. Build and start with:

```bash
npm install
npm run build
NODE_ENV=production npm start
```

Deployment requirements:

- Route HTTP and WebSocket traffic to the same app.
- Enable WebSocket upgrade support in the reverse proxy.
- Set `PUBLIC_BASE_URL=https://your-domain.example`.
- Use sticky sessions or a shared Socket.IO adapter if running multiple app instances.
- Mount `.data` on persistent storage if room/custom-pack recovery is required across instance replacement.

The app is not hardcoded to a particular hosting vendor.

## Security model

- Every socket action is validated and authorized as host or player.
- Players use random stable IDs plus reconnect tokens instead of socket IDs or display names.
- Host actions require a random host token.
- Scores, first-buzz selection, timers, Daily Doubles, Final Round scoring, and state transitions are server-owned.
- Clients cannot submit arbitrary score changes or trigger host events without the host token.
- Pack imports are schema-validated and capped by the Express JSON body limit.
- Player names and question strings are rendered by React, avoiding raw HTML injection.

## Testing

`tests/gameEngine.test.ts` covers room creation, five-player limits, reconnect identity, duplicate names, pack loading, buzz locking, first-buzz wins, normal scoring, steals, Daily Doubles and wagers, exact late-game multipliers, On Fire, Cold Streak, answer normalization, invalid pack rejection, Final Round wagering/answers/scoring, and game completion.

GitHub Actions runs install, typecheck, lint, tests, and production build on pushes and pull requests.
