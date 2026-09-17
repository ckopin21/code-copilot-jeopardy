# Networking and reconnect behavior

## Transport

Blue Stage uses PeerJS/WebRTC. The host browser creates a deterministic PeerJS ID from the room code. Player phones and remote presentation screens create their own PeerJS peers and open reliable data connections to the host peer.

`src/lib/socket.ts` provides a request/event wrapper over PeerJS so the UI can call `emitAck(...)` without owning transport details. The browser host and `BrowserGameEngine` are the only gameplay authority path.

## Identity and permanent seats

A phone joins once and receives:

- `roomCode`
- stable `playerId`
- random `reconnectToken`
- an authoritative P1-P5 seat stored with the player

The host engine stores the token for authorization. A display name is never used as identity. Reconnecting requires the matching player ID/token pair.

Temporary disconnects never renumber seats. Permanent removal frees that exact seat for the next new player. Keyboard keys and host-side gamepad indexes map to the permanent seat rather than the filtered list of currently connected players.

## Snapshot privacy

Every outgoing room snapshot is sanitized by `src/lib/snapshotSecurity.ts` according to the receiving role.

Before reveal, accepted answers and explanations are withheld from player/presentation clients. Other players' typed answers and auto-grade information are hidden. Daily Double question text is withheld during the wager phase. The Final question itself is withheld until the answer phase begins, and future Final answers stay hidden even from the host until each player reaches progressive review.

## Connection state

`socket.connected` means the client has an open host data connection, not merely that PeerJS signaling is online. This prevents the phone status bubble from reporting LIVE when the host channel is unavailable.

The player UI listens for room snapshots and disconnect events. On a transport interruption it enters a reconnecting state and retains seat credentials.

The phone also presents an explicit reconnect overlay after a short interruption delay. Host-initiated Pause/Remove events are treated as intentional disconnects and do not show the generic failure overlay.

## Clean page exits

The phone controller explicitly suspends its client session on component unmount and `pagehide`. This covers normal Back navigation, leaving the player route, and ordinary tab/page closure. The WebRTC data connection is closed instead of allowing the reconnect loop to keep the phone logically online after the player intentionally left the page.

A phone restored from the browser back/forward cache handles `pageshow` and re-enables its reconnect transport so the existing React tree can reclaim the same reserved seat.

## Heartbeat / stale-phone detection

Mobile browsers do not always deliver a clean WebRTC close event when a tab is killed, backgrounded aggressively, or the browser process disappears. Therefore connection state does not rely on close events alone.

While a controller is active it refreshes its authenticated player session every few seconds. The host records the last authenticated request time for each player. If a connected phone stops checking in for roughly eight seconds, the host marks that player disconnected, removes the stale live connection, and broadcasts the updated room state. The player object, score, statistics, permanent seat, and reconnect token remain reserved.

This means both graceful exits and abrupt mobile-tab loss converge on the same reserved-seat state.

## Pre-game controller check

The host control panel exposes the same heartbeat freshness as a pre-game readiness display. A connected phone is categorized from the age of its latest authenticated check-in.

**Test All Phones** sends a live `preflight:test` event over every open controller channel. A reached phone shows a confirmation, triggers haptics where supported, plays a short sound where audio is available, and performs an authenticated reconnect/check-in. This verifies the same data path that gameplay uses.

The check is intentionally not marketed as a synthetic latency benchmark. It verifies reachability, recent authenticated activity, haptics/audio feedback, and controller identity without inventing a misleading network-quality score.

## Automatic reconnect

The client reconnect loop:

1. Detects a closed/failed data connection.
2. Rejects pending requests as interrupted instead of leaving them unresolved.
3. Schedules a reconnect with increasing delay capped at five seconds.
4. Reopens the host data connection.
5. Replays `player:reconnect` automatically using saved credentials.
6. Resumes live room snapshots without a page reload.

The player screen also performs a periodic identity sync while joined. Terminal errors such as expired/not-found/authorization failures stop the retry loop and allow the user to join a new seat.

## Action freshness and delayed packets

Gameplay requests that can become stale carry authoritative context from the latest room snapshot. Buzzes, typed responses, and Daily Double wagers include both the current question ID and the game start timestamp. Final wagers and answers include the game start timestamp.

The host rejects a request whose context no longer matches the active question/game. This prevents an ordered-but-delayed packet from an earlier clue, or from a previous game in the same room, from being applied to the current state.

Timer deadlines are also reconciled inside player action handling rather than only by the host's periodic timer tick. A response arriving after an authoritative deadline cannot slip through during the interval between the deadline and the next scheduled tick. If buzzer auto-close is disabled, the timer can expire without closing the buzzer window, preserving that setting's intended behavior.

## Host-controlled temporary disconnect

**Pause seat** is a recoverable host action. It:

1. marks the player disconnected in authoritative room state
2. removes the controller from active buzzer/response participation
3. closes the current phone data channel
4. suppresses automatic reconnect on that phone
5. preserves the player ID, reconnect token, score, statistics, and permanent seat

The phone displays a paused-seat screen with a deliberate **Reconnect to Seat** action. Reconnecting restores the same identity and seat.

## Permanent removal

**Remove** is destructive. It deletes the player object and reconnect token from the host engine, frees the P1-P5 seat, and closes the current data channel if one exists. A connected phone is told that its seat was removed and clears its saved seat. A phone that was already offline will fail authorization when it later tries the stale token and must join as a new player.

Removal is reconciled against live gameplay so the room cannot retain references to a deleted player. If the removed player currently owns the buzzer, the winner is cleared and eligible remaining players are reopened; a removed free-response submission is discarded and completion is recalculated; Final participation/completion is recalculated against the remaining participants. The active Daily Double owner cannot be permanently removed until that Daily Double is finished or exited, preventing a stranded wager/question state.

## Reserved seats

When a current player connection closes, the host marks that player `connected=false` but does not delete the player object, score, statistics, permanent seat, or token. The visible player strip hides disconnected players while preserving their seat for reconnection. The host management drawer still shows the reserved seat so the host can distinguish it from a permanently removed player.

A stale older connection closing after a newer connection has already replaced it must not mark the restored player offline. `playerConnections` tracks the current data connection per player ID to prevent this race.

## Game flow during disconnects and late joins

Disconnected seats do not block live progression:

- buzzer eligibility is removed
- typed-response completion waits only on connected players
- Daily Double ownership prefers connected players and degrades to a normal question in zero-player practice mode
- Final participants are snapshotted from connected players when Final begins
- if a Final participant disconnects after that, active completion waits only on the remaining connected Final participants
- reserved players remain part of persistent room state until explicitly removed/reset

The room itself remains open throughout the game. A new player can still claim a free seat after play starts. Once Final begins, however, its participant roster and scoreboard roster are frozen. A player who joins after that point receives a valid reserved seat but spectates that Final, does not block wager/answer completion, cannot shift the active Final-review player, and is excluded from the finished-game scoreboard. The same result-roster freeze prevents players who join after recap begins from changing completed standings, including the intentionally empty scoreboard of zero-player practice mode.

## Final response lock and privacy

Final answer collection has a separate authoritative lock state. When every active Final participant submits or the Final timer expires, `responsesClosed` becomes true and the timer stops while the room remains in `final-question`. Any later answer attempt is rejected.

The host then explicitly transitions to `final-review`. Review tracks the active player by stable player ID rather than by mutable array position, so joins/removals cannot shift the reveal onto the wrong seat. Player/presentation snapshots reveal only the currently reviewed player and already resolved players; future Final answers remain hidden. Recap may expose all Final results.

## Host lifecycle and recovery

The host peer attempts to reconnect to PeerJS signaling if signaling drops while the page remains open. The primary room authority still lives in the host browser. Closing the host page removes the live WebRTC endpoint until the host page is reopened and its saved room is restored.

Each successfully opened host peer also claims a browser-wide ownership lease. Only one host tab on that browser can own authoritative persistence at a time, matching the intended one-host-device model. Host mutations, timer ticks, stale-phone cleanup, and incoming controller requests are accepted only while that peer still owns the lease. If another host tab becomes active, even for a different room, it replaces the lease; the older tab closes its stale controller channels and can no longer mutate or rewrite persisted room state. This prevents a suspended/older host tab from waking later and writing stale gameplay over the active host.

Authoritative room state is persisted after game mutations. Active timer `endsAt` values are persisted with the room. On host engine reconstruction, the timer is restored from that absolute end time and expired timers are reconciled immediately instead of restarting or disappearing silently.

The browser keeps both a primary persisted room snapshot and a previous valid recovery snapshot. If the primary snapshot is malformed, startup falls back to the recovery copy; malformed primary data is not allowed to overwrite the valid backup during repair.

This is browser-local recovery, not a cloud backup. Clearing site storage or Reset Instance intentionally removes that recovery state.

## NAT/firewall behavior and TURN

Default ICE configuration uses public STUN servers. WebRTC can fail on restrictive networks/NAT combinations that require TURN.

The transport accepts an optional deployment-level override:

```js
window.BLUE_STAGE_ICE_SERVERS = [
  { urls: 'stun:your-stun.example.com:3478' },
  {
    urls: 'turn:your-turn.example.com:3478',
    username: 'deployment-user',
    credential: 'deployment-secret'
  }
];
```

The repository intentionally does not ship public TURN credentials. TURN credentials are deployment secrets and require an external TURN service. Once configured before the game transport initializes, the same PeerJS/WebRTC path uses those ICE servers automatically.

For the intended host-computer + phone-controller setup, keeping devices on normal Internet/Wi-Fi with WebRTC allowed remains the expected zero-configuration path.

## Local preview networking

The Windows and Mac launchers serve the built static app on all interfaces and attempt to open the host through its LAN IPv4 address. This matters because the join QR is generated from the host page URL; opening the host through `localhost` would produce a phone link that points back to the phone itself.

## QR join

Phones can scan the room QR through `BarcodeDetector` plus `getUserMedia` where the browser supports those APIs. Unsupported browsers keep manual room-code entry as the deterministic fallback. Camera streams are stopped on successful scan, close, and component unmount.

The host lobby QR can also be clicked to open a larger QR modal for easier scanning at a distance.
