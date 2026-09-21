# Real-device and network test matrix

This procedure complements deterministic runtime tests. It does **not** turn desktop browsers or Playwright WebKit into proof of physical iPhone Safari, carrier NAT, or TURN relay behavior.

## Before testing

Deploy the exact commit under test over HTTPS. Record commit, deployed URL, browser version, device model/OS, host and controller network type, and whether `VITE_ICE_CONFIG_URL` is configured. Never record reconnect tokens, presentation capabilities, or TURN credentials. The public build variable must name only an HTTPS credential-minting endpoint that returns short-lived ICE servers and permits the deployed origin.

## Test cases

Use a Windows/desktop HTTPS host in Chrome or Edge unless a row says otherwise. Start every case with a fresh room, record the room code separately from credentials, and retain a screen recording plus a redacted diagnostic-event export. A pass requires the stated behavior **and** no duplicate roster entry; a failure is any permanent Connecting/Reconnecting state, lost authoritative state, or a room that rejects a new controller after recovery.

| Scenario | Action | Expected result | Record |
| --- | --- | --- | --- |
| Same Wi-Fi iPhone Safari | Join, buzz, score, lock briefly, return | Same seat reconnects; score/question remain | reconnect time, duplicate seat, state preserved |
| Same Wi-Fi Android Chrome | Join alongside iPhone, background/return | Controllers remain usable or recover independently | reconnect time, roster correctness |
| Different Wi-Fi | Host/controller on separate networks | Join/gameplay work; note direct vs relay diagnostics | network pair, relay configuration |
| Cellular transition | iPhone Wi-Fi to cellular and back | Transport rebuilds or stays healthy; never falsely connected | each transition, recovery path |
| Airplane interruption | Drop one controller, restore network | Automatic recovery first; manual recovery remains possible | retry count, seat/profile preservation |
| Host interruption | Hide/restore, refresh/recover host, temporary network loss | Saved room recoverable; controllers reclaim state | room reachability, new join afterward |
| Mass recovery | Drop two controllers during active clue; restore together | No duplicates; scores/question retained; third player joins | all recovery times, third join result |
| Presentation | Join display, rotate capability, retry old/new URLs | Old display closes; new works; players/privacy unaffected | display count, privacy result |

### Exact lifecycle procedure

For iPhone Safari and Android Chrome, run each action with two joined controllers during an active clue: switch apps for 10 seconds, background for 60 seconds, lock/unlock for 60 seconds, reload the controller, then repeat after 5 minutes where the operating system permits. Return to the page and wait up to 20 seconds for an existing healthy channel or a restored reserved seat. Save the player screen, host roster, current clue/score, and safe events (`peer-*`, `data-*`, `reconnect-*`, `generation-superseded`).

For Wi-Fi-to-cellular, cellular-to-Wi-Fi, and airplane-mode tests, make the switch while the buzzer is open. For host loss, disable the host network for 30 seconds or reload the host tab, restore it, then require both controllers to recover and a third new controller to join. For failed-first-retry, restore the network only after one failed automatic reconnect attempt has been visibly recorded.

For presentation, use a second screen or browser with the current presentation URL, verify that Final answers are absent before host reveal, rotate the capability from the host, show that the old URL cannot reconnect, and show that the replacement URL can. Capture only redacted URLs/screenshots.

For every row record: environment, browser/device, host/controller networks, expected and observed result, reconnect time, duplicated players (yes/no), state preserved (yes/no), room still joinable (yes/no), new player joins (yes/no), and safe diagnostic kinds. Classify failures as signaling, ICE/TURN, data channel, identity authorization, host authority, or lifecycle recovery; do not paste secrets into reports.

## Optional external checks

Run `BLUE_STAGE_REAL_PEERJS=1 npx playwright test e2e/real-peerjs-smoke.spec.ts --project=chromium` only when external public signaling access is intended. A public-service outage is an environment result, not deterministic product failure. There is no relay-only command because real relay verification needs externally provisioned TURN credentials; when available, repeat different-network, mass-recovery, and reload rows and retain only safe diagnostic evidence.

## Safe diagnostics and TURN evidence

For a local or support-session capture, attach a listener to the runtime's `network:diagnostic` event or read its bounded `getNetworkDiagnostics()` result in DevTools. Retain only `at`, `kind`, `role`, `generation`, `detail`, and `turnConfigured`. Do not export request payloads, local storage, URLs containing capabilities, reconnect tokens, or ICE credentials. Useful kinds are `peer-open`, `peer-disconnected`, `peer-closed`, `peer-error`, `data-open`, `data-closed`, `data-error`, `reconnect-scheduled`, `reconnect-coalesced`, `reconnect-started`, `reconnect-failed`, `ice-configured`, and `ice-config-fallback`.

Before relay testing, verify the HTTPS ICE endpoint returns an `iceServers` array containing STUN plus short-lived `turn:` or `turns:` credentials and accepts no browser cookies. A relay-only experiment must live in a disposable test harness using `iceTransportPolicy: 'relay'`; never enable it in the shipping app. Save a redacted browser WebRTC-internals report showing a relay candidate, then repeat join, buzz, score, disconnect/reconnect, and a post-recovery join.

## Release record

| Environment | Status | Evidence / limitation |
| --- | --- | --- |
| Desktop host + desktop controller | Partially verified | Deterministic runtime and opt-in public-service smoke coverage |
| Desktop host + Android | Not verified | Requires physical device/network run |
| Desktop host + iPhone Safari | Not verified | Playwright WebKit is not iOS Safari |
| Same Wi-Fi | Not verified | Requires iPhone/Android physical run |
| Cellular and cross-network | Not verified | Requires physical carrier/remote-network run |
| Player reload / host recovery / mass disconnect | Partially verified | Deterministic production-runtime coverage |
| Restrictive NAT | Not verified | Requires representative network and TURN fallback evidence |
| Symmetric NAT / Private Relay-like path | Not verified | Requires representative network and relay evidence |
| STUN direct path | Partially verified | Default configuration and deterministic browser-path validation; no external route proof |
| TURN relay | Not verified | Requires provisioned TURN service and relay observation |
