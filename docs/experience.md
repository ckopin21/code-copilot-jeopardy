# Game experience systems

This document covers the host/player quality-of-life layer built on top of the authoritative `BrowserGameEngine`.

## Permanent player seats

Every player receives one stable seat from P1 through P5 when they first join. A temporary disconnect does not change that seat. Removing a player permanently frees that exact seat for a future player.

Seat numbers are used for:

- host player-management labels
- phone seat indicators
- keyboard buzzers (`1` through `5` map to P1 through P5)
- gamepads (gamepad indexes `0` through `4` map to P1 through P5)
- stable ordering through reconnects and Final Round

Older persisted games are migrated when `BrowserGameEngine` starts. Missing/duplicate seat values are reassigned to the first available valid seat.

## Player identity and customization

A joined player carries a stable seat plus presentation customization in authoritative room state. The join flow supports:

- 50 avatars across 10 categories
- 8 accent colors
- 4 buzzer sounds
- 3 score-impact effects
- 3 victory effects

Host, phone, remote presentation, board-result, and recap surfaces normalize the same customization fields instead of maintaining separate visual identities. Older/missing customization values fall back to the current defaults.

## Host control panel

The floating **HOST** control opens during any game phase. It contains:

- current recovery/state status
- player seat, score, and connection freshness
- Rename, Pause and Remove actions
- a connection-check modal
- one-level scoring/ruling Undo
- accessibility controls
- lobby-only game presets

The controls use the same authenticated host event path as the primary host UI.

## Pre-game controller check

Connection health is derived from authenticated phone check-ins already used by stale-phone detection. Each connected phone is classified as ready/fair/stale/offline from the age of its last authenticated request.

**Test All Phones** sends a live event over every open player data connection. A reached phone:

1. shows a controller-test confirmation
2. triggers a short haptic pattern where supported
3. plays a confirmation sound after audio unlock where supported
4. immediately refreshes its authenticated reconnect/check-in

This verifies the data channel and player identity path. It is not a synthetic Internet speed benchmark; the freshness display is intentionally based on the real game connection.

## Game presets

Presets only change gameplay settings. They never silently change the selected question pack.

- **Casual**: standard board, relaxed timer, forgiving score floor
- **Fast**: quick board, short timer, one Daily Double
- **Competitive**: standard timing, negative scores, full modifiers
- **Party**: marathon board, more Daily Doubles, forgiving score floor

After choosing a preset, the host can still change any individual lobby rule.

## Scoring undo

The engine keeps one authoritative pre-scoring checkpoint. It is created immediately before:

- spoken-answer resolution
- typed-answer grading
- manual score adjustment
- Final answer resolution

**Undo Last Score / Ruling** restores score, stats, streak state, question/Final phase and reveal state from that checkpoint while preserving live connection flags. Undo is intentionally one level deep and is cleared by roster changes and major game transitions where restoring an old scoring context would be unsafe.

## Automatic recovery

Room state is persisted by the browser game engine after authoritative mutations. Active timers persist an absolute `endsAt` and recover their remaining time after host reload. Player reconnect credentials remain separate on each phone.

The host panel's **Saved continuously** status describes this existing engine persistence; it is not a cloud backup. Closing the host removes the live WebRTC endpoint until that host browser restores the room.

## Question balancing

Board generation still requires complete categories for the selected game length. When a category contains multiple candidates for the same value, the engine now prefers the expected difficulty for that value while continuing to prioritize unseen questions:

- 100/200: easy
- 300: medium
- 400/500/1000: hard

If no preferred-difficulty candidate exists, a valid same-value question is used rather than failing board generation.

## Pack presentation metadata

Question packs may optionally provide:

- `accentColor`
- `titleArt`
- `categoryOrder`
- `finalQuestionId`

`categoryOrder` is honored when category randomization is disabled. `finalQuestionId` is preferred for Final Round when that question was not already used on the board. Presentation metadata is optional and never required for gameplay validity.

## Round presentation

The host experience includes short, non-interactive transition moments for:

- category introduction when a board starts
- Daily Double discovery
- Final Round entry
- transition into final results

Existing phase-specific music/cues remain authoritative. These overlays deliberately block accidental host clicks while the short transition is on screen.

## Post-game awards

The recap uses competition ranking for ties and supports multiple co-winners. It can surface awards including:

- Fastest Buzzer
- Sharpshooter
- Hot Streak
- High Roller
- Point Machine

Awards are derived only from statistics already recorded by the authoritative engine.

## Accessibility

Host and phone controls expose local display preferences for:

- larger text
- increased contrast
- reduced motion

Preferences are stored on that browser/device and applied through root data attributes, so they persist across menu/game routes without changing gameplay for other devices.

## Network relay limitation

The default P2P transport uses public STUN and cannot relay traffic through restrictive NAT/firewall combinations. Production TURN support is therefore configured through an HTTPS ICE-credential endpoint, preferably via `VITE_ICE_CONFIG_URL` (or `window.BLUE_STAGE_ICE_CONFIG_URL` at runtime). Each newly created PeerJS peer can fetch fresh short-lived TURN credentials with `cache: no-store`.

`window.BLUE_STAGE_ICE_SERVERS` remains available for local/private testing or already-short-lived credentials. Long-lived TURN secrets must never be embedded in the GitHub Pages bundle. If the credential endpoint fails, the app falls back to STUN-only behavior and surfaces that limitation in connection errors. See `networking.md` for the exact contract.
