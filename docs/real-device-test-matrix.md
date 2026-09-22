# Real-device and LAN test matrix

This procedure verifies the supported same-Wi-Fi Socket.IO game on physical devices. Desktop Playwright WebKit covers some Safari-like lifecycle behavior; it is not a physical iPhone Safari test. Do not mark a physical device row passed based on a desktop simulator.

## Prepare the game

1. On a Windows laptop, install dependencies and run `npm start` at the exact commit under test. Record the commit, Node version, port, printed LAN Host URL, Windows network profile, and browser/device versions. Keep reconnect tokens, Host tokens, and Presentation capability URLs out of logs and screenshots.
2. Connect laptop, iPhone, Android phone, and optional TV browser to the same reachable Wi-Fi. Open the numeric Host URL printed by the server. Confirm `/api/network` reports the reachable LAN address.
3. Allow Node.js through Windows Firewall on the Private profile. Check guest-network client isolation and VPN state before interpreting a failed join as a game defect.
4. Create a room, join two phones by QR or room code, and connect a remote Presentation browser through the Host's display link.

For every scenario record expected/observed state, time to recover, duplicate players (yes/no), preserved seat/profile/score/question (yes/no), Presentation sync (yes/no), and whether a new player can join afterward. A long Connecting/Reconnecting loop or a lost room is a failure. Redact connection URLs if they include the display capability.

## Scenarios

| Scenario | Action | Expected result |
| --- | --- | --- |
| Windows LAN startup | Start the server and open printed URL from laptop and phone | Both load from laptop; Join QR contains reachable LAN address |
| iPhone Safari | Join, buzz, score, lock screen, return, reload | Same ID, seat, profile, score, and active room return |
| Android Chrome | Join beside iPhone, background/return and reload | Independent recovery without duplicate player |
| Host refresh | Refresh/close/reopen Host while server stays up | Same room and board recover; phones and Presentation remain attached |
| Presentation refresh | Reload display during board, scoring, and Final | Current authorized display resynchronizes; hidden Final answers remain hidden |
| Single phone loss | Toggle Wi-Fi, wait through one failed reconnect, restore | Later retry succeeds with same seat and no duplicate action |
| Mass disconnect | Drop both phones during an active clue, then restore | Profiles, scores, seats, and question survive; stale sockets cannot act; third phone joins |
| Screen lock/background | Lock/unlock each phone and resume Safari/Chrome | Socket reconnects and application identity is restored |
| Score retry | Cause acknowledgement loss/retry while scoring or buzzing | The action applies once; all screens show the same score |
| Display rotation | Rotate link while display is connected; retry old/new links | Old display disconnects and cannot rejoin; new link works; phones unaffected |
| Server restart | Stop/restart Node without deleting `.data/rooms.json` | Valid nonexpired room restores; clients reconnect with saved credentials |
| Network obstacle | Try wrong Wi-Fi, guest Wi-Fi, VPN, or blocked firewall | Failure is diagnosed; normal join works after route/firewall correction |

During an active clue, also test app switching for about 10 seconds, a 60-second background interval, a 60-second lock, browser Back/Forward, and a full reload. A first reconnect failure should not discard saved credentials. After recovering, score a question and start a new game in the same room to verify the session remains useful.

The Presentation test must inspect its state before Final reveal: unrevealed answers, other players' private typed responses, and future Final review answers must be absent. The display must never be able to submit Host or player mutations.

## Evidence and limits

Record browser console/network errors and safe server logs without request payloads or tokens. Classify failures as LAN reachability, firewall/VPN/client isolation, server lifecycle, socket reconnect, identity/authorization, stale request, or UI lifecycle. The old external PeerJS-reservation smoke tested public signaling and is retired with that transport. Its useful product behavior is covered by local Socket.IO and WebKit regressions; it is not required for LAN gameplay.

Normal same-room play needs no public Internet after installation. Cross-network, cellular-only, restrictive NAT, STUN, and TURN routes are outside the supported architecture and should not be presented as release gates or successes. Camera scanning, haptics, audio unlock, real Safari background behavior, Android background behavior, and actual Wi-Fi/firewall conditions still require physical-device evidence.

## Release record

| Environment | Status | Evidence / limitation |
| --- | --- | --- |
| Local Node server and desktop browsers | Record per release | Server integration and Chromium/WebKit browser runs |
| Windows laptop + iPhone Safari | Not verified here | Requires physical device and LAN run |
| Windows laptop + Android Chrome | Not verified here | Requires physical device and LAN run |
| TV/remote Presentation | Not verified here | Requires a separate display browser and capability/privacy check |
| Guest Wi-Fi, VPN, Windows Firewall | Not verified here | Requires representative local network conditions |
