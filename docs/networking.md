# Networking and reconnect behavior

## Primary Pages transport

The GitHub Pages version uses PeerJS/WebRTC. The host browser creates a deterministic PeerJS ID from the room code. Player phones create their own PeerJS peers and open reliable data connections to the host peer.

`src/lib/socket.ts` provides a Socket.IO-like request/event wrapper over PeerJS so the UI can call `emitAck(...)` without owning transport details.

## Identity

A phone joins once and receives:

- `roomCode`
- stable `playerId`
- random `reconnectToken`

The host engine stores the token for authorization. A display name is never used as identity. Reconnecting requires the matching player ID/token pair.

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

When a current player connection closes, the host marks that player `connected=false` but does not delete the player object, score, statistics, or token. The visible player strip hides disconnected players while preserving their seat position for reconnection. The lobby management list still shows the reserved seat so the host can distinguish it from a permanently removed player.

A stale older connection closing after a newer connection has already replaced it must not mark the restored player offline. `playerConnections` tracks the current data connection per player ID to prevent this race.

## Game flow during disconnects

Disconnected seats should not block live progression:

- buzzer eligibility is removed
- typed-response completion waits only on connected players
- Final participation/status uses connected players
- Daily Double selection prefers a connected active/controller player
- reserved players remain part of persistent game state until explicitly removed/reset

## Final answer privacy

Final answers and the accepted answer remain hidden until the host explicitly starts Final review. Even if every connected phone submits or the Final timer expires, the transport holds the room in the Final-question state so the host can run the reveal sequence first.

## Host lifecycle

The host peer attempts to reconnect to PeerJS signaling if signaling drops while the page remains open. The primary room authority still lives in the host browser. Closing the host page removes the live WebRTC endpoint until the host page is reopened and its saved room is restored.

## NAT/firewall behavior

Default ICE configuration uses public STUN servers. WebRTC can fail on restrictive networks/NAT combinations that require TURN. The app supports an optional `window.BLUE_STAGE_ICE_SERVERS` override for deployments that provide their own ICE/TURN configuration.

For the intended same-device-host + phone-controller setup, keeping devices on normal internet/Wi-Fi with WebRTC allowed is the expected path.

## QR join

Phones can scan the room QR through `BarcodeDetector` plus `getUserMedia` where the browser supports those APIs. Unsupported browsers keep manual room-code entry as the fallback. Camera streams are stopped on successful scan, close, and component unmount.

The host lobby QR can also be clicked to open a larger QR modal for easier scanning at a distance.

## Alternate Node transport

The Node runtime under `server/` uses Socket.IO and is architecturally separate from the PeerJS transport. Do not debug Pages reconnect problems in Socket.IO code or assume a PeerJS fix changed Node behavior. Cross-runtime changes require explicit parity work.
