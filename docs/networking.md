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

## Automatic reconnect

The client reconnect loop:

1. Detects a closed/failed data connection.
2. Rejects pending requests as interrupted instead of leaving them unresolved.
3. Schedules a reconnect with increasing delay capped at five seconds.
4. Reopens the host data connection.
5. Replays `player:reconnect` automatically using saved credentials.
6. Resumes live room snapshots without a page reload.

The player screen also performs a periodic identity sync while joined. Terminal errors such as expired/not-found/authorization failures stop the retry loop and allow the user to choose another seat.

## Reserved seats

When a current player connection closes, the host marks that player `connected=false` but does not delete the player object, score, statistics, or token. The visible player strip hides disconnected players while preserving their seat position for reconnection.

A stale older connection closing after a newer connection has already replaced it must not mark the restored player offline. `playerConnections` tracks the current data connection per player ID to prevent this race.

## Game flow during disconnects

Disconnected seats should not block live progression:

- buzzer eligibility is removed
- typed-response completion waits only on connected players
- Final answer completion waits only on connected players
- Daily Double selection prefers a connected active/controller player
- reserved players remain part of persistent game state until explicitly removed/reset

## Host lifecycle

The host peer attempts to reconnect to PeerJS signaling if signaling drops while the page remains open. The primary room authority still lives in the host browser. Closing the host page removes the live WebRTC endpoint until the host page is reopened and its saved room is restored.

## NAT/firewall behavior

Default ICE configuration uses public STUN servers. WebRTC can fail on restrictive networks/NAT combinations that require TURN. The app supports an optional `window.BLUE_STAGE_ICE_SERVERS` override for deployments that provide their own ICE/TURN configuration.

For the intended same-device-host + phone-controller setup, keeping devices on normal internet/Wi-Fi with WebRTC allowed is the expected path.

## QR join

Phones can scan the room QR through `BarcodeDetector` plus `getUserMedia` where the browser supports those APIs. Unsupported browsers keep manual room-code entry as the fallback. Camera streams are stopped on successful scan, close, and component unmount.

## Alternate Node transport

The Node runtime under `server/` uses Socket.IO and is architecturally separate from the PeerJS transport. Do not debug Pages reconnect problems in Socket.IO code or assume a PeerJS fix changed Node behavior. Cross-runtime changes require explicit parity work.
