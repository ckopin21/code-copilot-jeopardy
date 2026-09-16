# Architecture

## Runtime: GitHub Pages + browser host

Blue Stage is a static React/Vite application. The host browser owns authoritative game state through `src/lib/browserGameEngine.ts`. Player phones and presentation screens connect directly to the host through PeerJS/WebRTC using `src/lib/socket.ts`.

There is intentionally one game engine and one multiplayer authority path. The former Node/Express/Socket.IO implementation was removed because maintaining two independent rule engines caused runtime/test drift.

The host page must remain open for the live room to exist. The browser engine persists room snapshots to host `localStorage` so a host refresh can restore the room, subject to the room TTL and browser storage remaining intact. Running timers preserve their absolute `endsAt` value across engine reconstruction and are reconciled on load.

### Main client entry points

- `src/App.tsx` — top-level mode routing, global button audio, phone haptics, audio default migration
- `src/components/HostAppV3.tsx` — host controls, board/question flow, presentation overlay, score animations, history
- `src/components/PlayerApp.tsx` — phone join/reconnect, buzzer, typed answers, Daily Double and Final wagers
- `src/components/BoardPresentation.tsx` — fullscreen in-page board presentation
- `src/lib/browserGameEngine.ts` — authoritative game rules and state transitions
- `src/lib/socket.ts` — PeerJS transport, identity binding, request/response protocol, reconnect loop
- `src/lib/snapshotSecurity.ts` — role-based snapshot sanitization and hidden-answer privacy
- `src/lib/audio.ts` — procedural Web Audio music and cues
- `src/packs/` — built-in question data and pack builder

## State model

`RoomState`/`RoomSnapshot` in `src/shared/types.ts` is the shared contract used by host/player UI and the engine. Important state includes:

- room code and phase
- connected/reserved players and stable player IDs
- scores, streaks, buzzer eligibility, player statistics
- generated board and used question state
- current question, accepted answers, responses, Daily Double owner/wager
- timer state and host-relative `serverNow`
- current 1x/2x/3x multiplier
- Final Round category/question, participant IDs, response-lock state, wagers, answers, review position

Clients render snapshots rather than maintain an independent copy of game rules.

## Snapshot security

All room snapshots pass through `src/lib/snapshotSecurity.ts` before leaving the host authority boundary.

Before reveal, player/presentation clients do not receive accepted answers or explanations. Typed-response answers and auto-grade metadata are withheld from other clients. During a Daily Double wager, the clue text is hidden until the wager is locked.

Final responses are private until review. A player may retain their own submitted answer/wager, while other players' future answers remain hidden. During review, only the current review player and already-resolved players are exposed to non-host displays. Recap may reveal all Final data.

## Identity and persistence

Host credentials are stored under `blue-stage-host-room`. Player seat credentials are stored under `blue-stage-player`. A player credential contains a stable player ID, reconnect token, and room code. Leaving the phone UI intentionally does not discard those credentials, allowing the same browser to reclaim the reserved seat.

The browser engine persists active rooms under `blue-stage-p2p-engine-v2`. The hard Reset Instance path clears Blue Stage client state and reloads a clean build. Normal Reset Game keeps the room and player seats but resets board, score, statistics, and game progression.

## Question flow

The host selects a board tile. The browser engine creates `currentQuestion`, marks the tile used, calculates the effective multiplier, and changes phase. UI behavior is driven by the resulting phase:

- normal spoken question: question -> buzz -> reveal -> host grading -> board
- typed response: question -> submissions -> reveal -> per-player grading -> board
- Daily Double: wager -> question -> reveal -> grading -> board
- Final Round: category -> wagers -> answer collection/lock -> host review -> recap

Final participation is snapshotted from connected players when Final begins. Disconnecting later does not let an inactive seat block Final. Submission closes when all currently active Final participants submit or the timer expires; review begins only when the host requests it.

Host grading is the score authority. The host UI may delay the visible score-number change until a score-flight animation reaches the player card, while engine state is already updated.

## Board history

The host maintains per-room question history in `localStorage` under `blue-stage-history-<roomCode>`. It records question text/category/value, revealed answer, answering players, and correct/incorrect results. Used tiles render this result summary and can be reopened for review.

## Presentation mode

Presentation mode is an in-page fullscreen overlay on the host, not a second browser tab. It displays the board, player names/scores, multiplier state, and selectable question tiles. Leaving the board phase automatically exits presentation mode.

A separate `?mode=presentation` client is also supported by the transport for a remote display and receives sanitized room snapshots.

## Audio

Audio is generated with Web Audio oscillators; no external game-show audio files are required. Master, Music, and Sound Effects begin at 75% after the current audio-default migration and remain user-adjustable. Preferences persist in local storage.

## Styling

Core styling is split across:

- `src/styles.css`
- `src/showcase.css`
- `src/stage-polish.css`
- `src/interaction-polish.css`

`interaction-polish.css` is intentionally last and contains small behavior-adjacent visual overrides such as score-card impact motion.
