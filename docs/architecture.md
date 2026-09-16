# Architecture

## Primary runtime: GitHub Pages + browser host

The deployed Pages game is a static React/Vite application. The host browser owns authoritative game state through `src/lib/browserGameEngine.ts`. Player phones connect directly to the host through PeerJS/WebRTC using `src/lib/socket.ts`.

The host page must remain open for the live room to exist. The browser engine persists room snapshots to host `localStorage` so a host refresh can restore the room, subject to the room TTL and browser storage remaining intact.

### Main client entry points

- `src/App.tsx` — top-level mode routing, global button audio, phone haptics, audio default migration
- `src/components/HostAppV3.tsx` — host controls, board/question flow, presentation overlay, score animations, history
- `src/components/PlayerApp.tsx` — phone join/reconnect, buzzer, typed answers, Daily Double and Final wagers
- `src/components/BoardPresentation.tsx` — fullscreen in-page board presentation
- `src/lib/browserGameEngine.ts` — Pages game rules and authoritative state transitions
- `src/lib/socket.ts` — PeerJS transport, identity binding, request/response protocol, reconnect loop
- `src/lib/audio.ts` — procedural Web Audio music and cues
- `src/packs/` — built-in question data and pack builder

## Alternate runtime: Node/Express/Socket.IO

`server/` contains a separate server-hosted implementation for environments that run Node and WebSockets. It includes `server/gameEngine.ts`, `server/index.ts`, persistence, and custom pack storage.

This path does not power the GitHub Pages deployment. A feature implemented only in `browserGameEngine.ts` or the PeerJS transport is not automatically present in the Node engine, and vice versa. Changes intended for both runtimes require a parity pass and tests in both paths.

## State model

`RoomState`/`RoomSnapshot` in `src/shared/types.ts` is the shared contract used by host/player UI and engines. Important state includes:

- room code and phase
- connected/reserved players and stable player IDs
- scores, streaks, buzzer eligibility, player statistics
- generated board and used question state
- current question, accepted answers, responses, Daily Double owner/wager
- timer state and host-relative `serverNow`
- current 1x/2x/3x multiplier
- Final Round category/question, wagers, answers, review position

Clients should render snapshots rather than maintain an independent copy of game rules.

## Identity and persistence

Host credentials are stored under `blue-stage-host-room`. Player seat credentials are stored under `blue-stage-player`. A player credential contains a stable player ID, reconnect token, and room code. Leaving the phone UI intentionally does not discard those credentials, allowing the same browser to reclaim the reserved seat.

The browser engine persists active rooms under `blue-stage-p2p-engine-v2`. The hard Reset Instance path clears Blue Stage client state and reloads a clean build. Normal Reset Game keeps the room and player seats but resets board, score, statistics, and game progression.

## Question flow

The host selects a board tile. The browser engine creates `currentQuestion`, marks the tile used, calculates the effective multiplier, and changes phase. UI behavior is driven by the resulting phase:

- normal spoken question: question -> buzz -> reveal -> host grading -> board
- typed response: question -> submissions -> reveal -> per-player grading -> board
- Daily Double: wager -> question -> reveal -> grading -> board
- Final Round: category -> wagers -> question -> review -> recap

Host grading is the score authority. The host UI delays the visible score-number change until the score-flight animation reaches the player card, while engine state is already updated.

## Board history

The host maintains per-room question history in `localStorage` under `blue-stage-history-<roomCode>`. It records question text/category/value, revealed answer, answering players, and correct/incorrect results. Used tiles render this result summary and can be reopened for review.

## Presentation mode

Presentation mode is an in-page fullscreen overlay on the host, not a second browser tab. It displays the board, player names/scores, multiplier state, and selectable question tiles. Leaving the board phase automatically exits presentation mode.

## Audio

Audio is generated with Web Audio oscillators; no external game-show audio files are required. Master, Music, and Sound Effects begin at 75% after the current audio-default migration and remain user-adjustable. Preferences persist in local storage.

## Styling

Core styling is split across:

- `src/styles.css`
- `src/showcase.css`
- `src/stage-polish.css`
- `src/interaction-polish.css`

`interaction-polish.css` is intentionally last and contains small behavior-adjacent visual overrides such as score-card impact motion.
