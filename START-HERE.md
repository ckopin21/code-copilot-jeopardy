# Start here

## Fastest way to play

Open the deployed game:

```text
https://ckopin21.github.io/code-copilot-jeopardy/
```

Choose **Start New Game** on the host computer. Players join from phones using the QR code or room code. The game uses direct browser-to-browser PeerJS/WebRTC connections, so the host page must remain open.

## Run locally on Windows

1. Click **Code** → **Download ZIP**.
2. Extract the ZIP.
3. Double-click **START-WINDOWS.bat**.
4. The launcher installs the locked dependencies, builds the static app, starts Vite Preview, and opens a reachable LAN URL when one is available.
5. Keep the launcher/game window open while playing.

## Run locally on Mac

1. Click **Code** → **Download ZIP**.
2. Extract the ZIP.
3. Open Terminal in the extracted folder.
4. Run `chmod +x START-MAC.command` once.
5. Double-click **START-MAC.command** afterward.
6. The launcher opens the Mac's LAN address when available so phone QR links point back to the host computer instead of `localhost`.

## Local phones

Keep phones and the host computer on a network where they can reach one another. The local launcher listens on all interfaces and tries to open the host through its LAN IPv4 address. Firewall, guest-network/client-isolation, VPN, or restrictive WebRTC/NAT settings can still block connections.

Node.js 22+ is required for local build/preview use. It is not required just to use the deployed GitHub Pages game.

For architecture, networking, question packs, and development details, see [`docs/README.md`](docs/README.md).
