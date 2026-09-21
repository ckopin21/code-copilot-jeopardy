# Real-device and network test matrix

This procedure complements deterministic runtime tests. It does **not** turn desktop browsers or Playwright WebKit into proof of physical iPhone Safari, carrier NAT, or TURN relay behavior.

## Before testing

Deploy the exact commit under test over HTTPS. Record commit, deployed URL, browser version, device model/OS, host and controller network type, and whether `VITE_ICE_CONFIG_URL` is configured. Never record reconnect tokens, presentation capabilities, or TURN credentials. The public build variable must name only an HTTPS credential-minting endpoint that returns short-lived ICE servers and permits the deployed origin.

## Test cases

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

For every row record: environment, browser/device, host/controller networks, expected and observed result, reconnect time, duplicated players (yes/no), state preserved (yes/no), room still joinable (yes/no), new player joins (yes/no), and safe diagnostic kinds. Classify failures as signaling, ICE/TURN, data channel, identity authorization, host authority, or lifecycle recovery; do not paste secrets into reports.

## Optional external checks

Run `BLUE_STAGE_REAL_PEERJS=1 npx playwright test e2e/real-peerjs-smoke.spec.ts --project=chromium` only when external public signaling access is intended. A public-service outage is an environment result, not deterministic product failure. There is no relay-only command because real relay verification needs externally provisioned TURN credentials; when available, repeat different-network, mass-recovery, and reload rows and retain only safe diagnostic evidence.

## Release record

| Environment | Status | Evidence / limitation |
| --- | --- | --- |
| Desktop host + desktop controller | Partially verified | Deterministic runtime and opt-in public-service smoke coverage |
| Desktop host + Android | Not verified | Requires physical device/network run |
| Desktop host + iPhone Safari | Not verified | Playwright WebKit is not iOS Safari |
| Same Wi-Fi / cross-network / cellular | Not verified | Requires physical network runs |
| Player reload / host recovery / mass disconnect | Partially verified | Deterministic production-runtime coverage |
| Restrictive or symmetric NAT / TURN relay | Not verified | Requires provisioned TURN service and relay observation |
