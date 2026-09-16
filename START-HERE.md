# Start here

## Fastest way to play

Open the deployed game:

```text
https://ckopin21.github.io/code-copilot-jeopardy/
```

Choose **Start New Game** on the host computer. Players join from phones using the QR code or room code. The live Pages version uses direct browser-to-browser PeerJS/WebRTC connections, so the host page must remain open.

## Run locally on Windows

1. Click **Code** → **Download ZIP**.
2. Extract the ZIP.
3. Double-click **START-WINDOWS.bat**.
4. The launcher installs/builds the app, starts the local Node runtime, and opens `http://localhost:3000`.
5. Keep the server window open while using this local mode.

## Run locally on Mac

1. Click **Code** → **Download ZIP**.
2. Extract the ZIP.
3. Open Terminal in the extracted folder.
4. Run `chmod +x START-MAC.command` once.
5. Double-click **START-MAC.command** afterward.

## Local phones

For the local Node runtime, use the room QR code/LAN link shown by the host and keep phones on a network that can reach the host computer. Firewall/client-isolation settings can block local access.

Node.js 22+ is required for local development/server use. It is not required just to use the deployed GitHub Pages game.

For architecture, networking, question packs, and development details, see [`docs/README.md`](docs/README.md).
