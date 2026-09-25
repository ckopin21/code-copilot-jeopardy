# Networking and reconnect behavior

## Same Wi-Fi transport

The laptop runs `server/index.ts`: one HTTP server serves the application and one Socket.IO server carries game actions and snapshots over WebSockets. Host, phone controllers, and a remote Presentation display connect to that laptop. Normal gameplay uses only the local network after dependencies and assets are installed. No public signaling, STUN, TURN, WebRTC negotiation, or cloud game service is involved.

```text
Host browser ───────┐
Player phones ──────┼── local Wi-Fi/LAN ── laptop Node + Socket.IO server
Presentation screen ┘                       authoritative TriviaEngine
```

The server listens on `0.0.0.0:3000` by default. It discovers and advertises a private IPv4 address, preferring a Wi-Fi adapter. The Host page obtains that base URL from `/api/network`; room creation produces a player Join URL, a QR code, and a capability-bearing Presentation URL. `BLUE_STAGE_BASE_URL` can override the advertised address when the laptop has several adapters. `PORT` and `HOST` override the listening port and interface. Keep the Host and phones on the same reachable network; a numeric LAN address such as `http://192.168.1.174:3000` is the fallback when local hostname resolution is unreliable.

The Host browser is a client, not the server. Closing or refreshing it does not delete the room while the laptop server continues running. The server persists room records in `.data/rooms.json`; it restores valid rooms and reconciles active timers when restarted. Every client must reconnect after a server process restart. Stop the server only after the game is finished.

## Wire protocol and authority

Clients send `game:request` with `{ requestId, event, payload }` and receive an acknowledgement `{ requestId, ok, data?, error? }`. Existing event names describe intents: `room:create`, `host:*`, `player:*`, and `presentation:join`. The server checks the socket's bound role and room before calling the shared `TriviaEngine`. It then sends each authorized socket a `room:state` snapshot sanitized for Host, player, or Presentation. A committed score change also sends `room:score` before the new snapshot so score effects can target the correct player. Clients do not send replacement scores or room snapshots.

The request journal coalesces an in-flight request and replays the acknowledgement for a completed request ID. The client reuses that ID when retrying an uncertain acknowledgement. The server also keeps bounded session-level completed responses, so reconnect retries cannot score, buzz, answer, or wager twice. Question actions include the active question ID and game start time; Final actions include game start time. The engine rejects stale actions and enforces response deadlines.

## Host, player, and display credentials

- Room creation issues a secret Host token. `host:reconnect` validates it and binds the current Host socket. Host mutations require both that bound socket and the token; knowing a room code is insufficient. A deliberate Host takeover replaces the older Host socket, which loses mutation authority.
- A phone join issues a stable player ID, reconnect token, and P1–P5 seat. The phone stores those credentials locally and reuses them after reload, Back/Forward, screen lock, or Wi-Fi interruption. Names do not identify players. A replacement socket takes ownership of the same player; the old socket cannot mutate state or mark the replacement offline when it closes.
- A remote Presentation URL contains a high-entropy capability. The display receives read-only, role-sanitized snapshots. **Rotate display link** revokes the old capability and disconnects existing displays. The server sends a refreshed LAN Presentation URL to a Host that restores a saved room.

The server hides unrevealed clue answers and explanations, other players' typed responses, and future Final answers from player and Presentation snapshots. A player may see their own submitted answer or wager; future Final review responses are revealed only as the Host progresses. The Presentation socket cannot score, select clues, or perform Host actions.

## Reconnect and reserved seats

Socket.IO reconnects the WebSocket transport. The application separately replays `host:reconnect`, `player:reconnect`, or `presentation:join` to restore its authority and state. A failed first attempt can retry later with the same credentials. When the server sees a close or an authenticated phone heartbeat goes stale, it marks that player offline without deleting the profile, seat, score, statistics, or active response. Connected-only phases do not wait indefinitely for the disconnected controller. A new player may claim another free seat after recovery.

Phone `pagehide`, `pageshow`, visibility, and `online` events also trigger recovery. In a backgrounded mobile browser, the WebSocket may be gone even when the page's JavaScript was preserved; the client reconnects and reauthenticates before it is considered live. Returning to the menu retains phone credentials. **Pause seat** deliberately disconnects the phone but preserves its seat; the player uses **Reconnect to Seat** to return. **Remove** deletes the player and token, frees the seat, and rejects future reconnects with those credentials.

The Host can return to its menu while the Node server maintains the room. Leaving active play pauses the game; Continue resumes, and Start New Game resets board and competitive progress in the same room while retaining connected players, seats, profiles, and credentials. A Host refresh restores from the server with the saved Host token. An invalid token or expired room requires a new room.

## Connection check and failure recovery

The Host's controller status uses recent authenticated phone activity. **Test All Phones** sends `preflight:test` to active controller sockets; each reached phone shows a confirmation and may play a sound or haptic feedback. This verifies the gameplay connection, not Internet speed.

If every phone drops together, keep the laptop server running. Phones reconnect independently with their saved identities; one failed attempt does not invalidate the room. Stale sockets lose authority, connected state is recomputed from current sockets, and the room stays joinable for a new player. The same procedure applies when Safari backgrounds, a phone locks, or Wi-Fi briefly disappears.

If a phone cannot open the Join URL:

1. Confirm the laptop server window is still running and open the printed Host URL on the laptop.
2. Confirm the phone and laptop are on the same Wi-Fi or otherwise have a route between them; disable cellular-only browsing on the phone for the test.
3. Use the numeric LAN address printed by the server or shown in the Host Join URL. Set `BLUE_STAGE_BASE_URL` if the server selected the wrong adapter.
4. Allow Node.js through Windows Firewall on the **Private** network profile. A Public profile or blocked inbound port 3000 can prevent phones from connecting even while `localhost` works on the laptop.
5. Check guest Wi-Fi or access-point client isolation, and temporarily disconnect a VPN that routes local traffic away from the LAN.

If the server itself stops, restart it with `npm start` (or `npm run dev` during development), reopen the Host page, and let each phone reconnect. Server-side room persistence is a local recovery aid, not a cloud backup.

## GitHub Pages and the old PeerJS test

GitHub Pages can publish a static preview or documentation, but it cannot run the Node/Socket.IO authority. Use the laptop URL for multiplayer. The prior WebKit external PeerJS-reservation failure concerned public PeerJS signaling and no longer represents the supported transport. Preserve its product-level join/reload/recovery assertions in local Socket.IO and WebKit tests; do not count a retired external signaling test as evidence of physical iPhone behavior. The [real-device test matrix](real-device-test-matrix.md) covers what still needs physical verification.
