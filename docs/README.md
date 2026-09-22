# Blue Stage Trivia documentation

This folder is the maintained technical and gameplay reference for the current game.

## Start here

- [`../README.md`](../README.md) — project overview, run/deploy commands, supported runtime
- [`gameplay.md`](gameplay.md) — complete game flow, scoring, wagers, streaks, Final Round, reset/reconnect behavior
- [`experience.md`](experience.md) — permanent seats, pre-game checks, host controls, presets, undo, recovery, transitions, awards, accessibility
- [`architecture.md`](architecture.md) — client structure, state ownership, storage, snapshot security, audio, presentation mode
- [`networking.md`](networking.md) — Socket.IO roles, LAN joining, reconnect/reserved-seat behavior, failure cases
- [`real-device-test-matrix.md`](real-device-test-matrix.md) — repeatable physical-device and same-Wi-Fi validation matrix
- [`question-packs.md`](question-packs.md) — built-in pack authoring, automatic registration, metadata, and validation
- [`development.md`](development.md) — repository layout, testing, CI, deployment, safe modification checklist

## Runtime support

Blue Stage has one supported multiplayer runtime: the laptop's Node/Socket.IO server. It runs the shared `BrowserGameEngine` and serves Host, player, and Presentation browsers across a reachable LAN. GitHub Pages may show a static preview or documentation; it cannot host the multiplayer authority. `npm run dev` and `npm start` use the same server game path.

## Documentation maintenance rule

A gameplay, networking, persistence, deployment, question-pack, or experience-system architecture change is not complete until the corresponding document above is updated. `README.md` should describe the current user-facing behavior; the files in this folder hold implementation detail.
