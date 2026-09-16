# Networking and reconnect behavior

## Transport

Blue Stage uses PeerJS/WebRTC. The host browser creates a deterministic PeerJS ID from the room code. Player phones and remote presentation screens create their own PeerJS peers and open reliable data connections to the host peer.

`src/lib/socket.ts` provides a request/event wrapper over PeerJS so the UI can call `emitAck(...)` without owning transport details. The browser host and `BrowserGameEngine` are the only gameplay authority path.

## Identity

A phone joins once and receives:

- `roomCode`
- stable `playerId`
- random `reconnectToken`

The host engine stores the token for authorization. A display name is never used as identity. Reconnecting requires the matching player ID/token pair.

## Snapshot privacy

Every outgoing room snapshot is sanitized by `src/lib/snapshotSecurity.ts` according to the receiving role.

Before reveal, accepted answers and explanations are withheld from player/presentation clients. Other players' typed answers and auto-grade information are hidden. Daily Double clue text is withheld during the wager phase. Final wagers/answers remain private until the appropriate Final review step.

## Connection state

`socket.connected` means the client has an open host data connection, not merely that PeerJS signaling is online. This prevents the phone status bubble from reporting LIVE when the host channel is unavailable.

The player UI listens for room snapshots and disconnect events. On a transport interruption it enters a reconnecting state and retains seat credentials.

## Clean page exits

The phone controller explicitly suspends its client session on component unmount and `pagehide`. This covers normal Back navigation, leaving the player route, and ordinary tab/page closure. The WebRTC data connection is closed instead of allowing the reconnect loop to keep the phone logically online after the player intentionally left the page.

## Heartbeat / stale-phone detection

Mobile browsers do not always deliver a clean WebRTC close event when a tab is killed, backgrounded aggressively, or the browser process disappears. Therefore connection state does not rely on close events alone.

While a controller is active it refreshes its authenticated player session every few seconds. The host records the last authenticated request time for each player. If a connected phone stops checking in for roughly eight seconds, the host marks that player disconnected, removes the stale live connection, and broadcasts the updated room state. The player object, score, statistics, and reconnect token remain reserved.

This means both graceful exits and abrupt mobile-tab loss converge on the same reserved-seat state.

## Automatic reconnect

The client reconnect loop:

1. Detects a closed/failed data connection.
2. Rejects pending requests as interrupted instead of leaving them unresolved.
3. Schedules a reconnect with increasing delay capped at five seconds.
4. Reopens the host data connection.
5. Replays `player:reconnect` automatically using saved credentials.
6. Resumes live room snapshots without a page reload.

The player screen also performs a periodic identity sync while joined. Terminal errors such as expired/not-found/authorization failures stop the retry loop and allow the user to join a new seat.

## Host-controlled temporary disconnect

**Pause seat** is a recoverable host action. It:

1. marks the player disconnected in authoritative room state
2. removes the controller from active buzzer/response participation
3. closes the current phone data channel
4. suppresses automatic reconnect on that phone
5. preserves the player ID, reconnect token, score, statistics, and seat

The phone displays a paused-seat screen with a deliberate **Reconnect to Seat** action. Reconnecting restores the same identity.

## Permanent removal

**Remove** is destructive. It deletes the player object and reconnect token from the host engine and closes the current data channel if one exists. A connected phone is told that its seat was removed and clears its saved seat. A phone that was already offline will fail authorization when it later tries the stale token and must join as a new player.

## Reserved seats

When a current player connection closes, the host marks that player `connected=false` but does not delete the player object, score, statistics, or token. The visible player strip hides disconnected players while preserving their seat for reconnection. The lobby management list still shows the reserved seat so the host can distinguish it from a permanently removed player.

A stale older connection closing after a newer connection has already replaced it must not mark the restored player offline. `playerConnections` tracks the current data connection per player ID to prevent this race.

## Game flow during disconnects

Disconnected seats do not block live progression:

- buzzer eligibility is removed
- typed-response completion waits only on connected players
- Daily Double ownership prefers connected players and degrades to a normal clue in zero-player practice mode
- Final participants are snapshotted from connected players when Final begins
- if a Final participant disconnects after that, active completion waits only on the remaining connected Final participants
- reserved players remain part of persistent room state until explicitly removed/reset

## Final response lock and privacy

Final answer collection has a separate authoritative lock state. When every active Final participant submits or the Final timer expires, `responsesClosed` becomes true and the timer stops while the room remains in `final-question`. Any later answer attempt is rejected.

The host then explicitly transitions to `final-review`. Player/presentation snapshots reveal only the currently reviewed player and already resolved players; future Final answers remain hidden. Recap may expose all Final results.

## Host lifecycle

The host peer attempts to reconnect to PeerJS signaling if signaling drops while the page remains open. The primary room authority still lives in the host browser. Closing the host page removes the live WebRTC endpoint until the host page is reopened and its saved room is restored.

Active timer `endsAt` values are persisted with the room. On host engine reconstruction, the timer is restored from that absolute end time and expired timers are reconciled immediately instead of restarting or disappearing silently.

## NAT/firewall behavior

Default ICE configuration uses public STUN servers. WebRTC can fail on restrictive networks/NAT combinations that require TURN. The app supports an optional `window.BLUE_STAGE_ICE_SERVERS` override for deployments that provide their own ICE/TURN configuration.

For the intended host-computer + phone-controller setup, keeping devices on normal internet/Wi-Fi with WebRTC allowed is the expected path.

## Local preview networking

The Windows and Mac launchers serve the built static app on all interfaces and attempt to open the host through its LAN IPv4 address. This matters because the join QR is generated from the host page URL; opening the host through `localhost` would produce a phone link that points back to the phone itself.

## QR join

Phones can scan the room QR through `BarcodeDetector` plus `getUserMedia` where the browser supports those APIs. Unsupported browsers keep manual room-code entry as the fallback. Camera streams are stopped on successful scan, close, and component unmount.

The host lobby QR can also be clicked to open a larger QR modal for easier scanning at a distance.
