# Blue Stage Trivia documentation

This folder is the maintained technical and gameplay reference for the current game.

## Start here

- [`../README.md`](../README.md) — project overview, run/deploy commands, supported runtime
- [`gameplay.md`](gameplay.md) — complete game flow, scoring, wagers, streaks, Final Round, reset/reconnect behavior
- [`architecture.md`](architecture.md) — client structure, state ownership, engines, storage, audio, presentation mode
- [`networking.md`](networking.md) — phone connections, PeerJS/WebRTC lifecycle, reconnect/reserved-seat behavior, failure cases
- [`question-packs.md`](question-packs.md) — built-in pack authoring, automatic registration, validation, custom server packs
- [`development.md`](development.md) — repository layout, testing, CI, deployment, safe modification checklist

## Runtime support

The GitHub Pages build is the primary supported version. It runs the game host in the browser and connects player phones with PeerJS/WebRTC. The Node/Express/Socket.IO implementation remains available for traditional server deployment, but it is a separate runtime path and should not be assumed to receive a gameplay change unless that path is changed and tested too.

## Documentation maintenance rule

A gameplay, networking, persistence, deployment, or question-pack architecture change is not complete until the corresponding document above is updated. `README.md` should describe the current user-facing behavior; the files in this folder hold implementation detail.
