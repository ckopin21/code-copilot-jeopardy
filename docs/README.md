# Blue Stage Trivia documentation

This folder is the maintained technical and gameplay reference for the current game.

## Start here

- [`../README.md`](../README.md) — project overview, run/deploy commands, supported runtime
- [`gameplay.md`](gameplay.md) — complete game flow, scoring, wagers, streaks, Final Round, reset/reconnect behavior
- [`architecture.md`](architecture.md) — client structure, state ownership, storage, snapshot security, audio, presentation mode
- [`networking.md`](networking.md) — phone connections, PeerJS/WebRTC lifecycle, reconnect/reserved-seat behavior, failure cases
- [`question-packs.md`](question-packs.md) — built-in pack authoring, automatic registration, and validation
- [`development.md`](development.md) — repository layout, testing, CI, deployment, safe modification checklist

## Runtime support

Blue Stage has one supported gameplay runtime: the browser-hosted GitHub Pages/P2P architecture. The host browser owns authoritative state through `BrowserGameEngine`, and player/presentation clients connect through PeerJS/WebRTC. Local development and production tests use this same engine path.

## Documentation maintenance rule

A gameplay, networking, persistence, deployment, or question-pack architecture change is not complete until the corresponding document above is updated. `README.md` should describe the current user-facing behavior; the files in this folder hold implementation detail.
