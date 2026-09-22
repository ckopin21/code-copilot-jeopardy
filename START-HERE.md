# Start here

## Play on the same Wi-Fi

1. Connect the laptop, phones, and optional TV/presentation browser to the same reachable Wi-Fi network.
2. Install Node.js 22+ on the laptop. In this repository, run `npm ci` once and then `npm start` for a game. Keep that server window open.
3. Open the Host URL printed by the server, usually `http://192.168.x.x:3000/?mode=host`. Create or continue a room.
4. If Windows asks, allow Node.js through Windows Firewall on the **Private** network profile.
5. Show the Host's QR code or player Join URL. Players scan it or enter the room code from their phones.
6. Open the Host's Presentation link on a TV/browser if desired. The link is read-only and can be rotated by the Host.

The laptop owns the game. Host, phones, and Presentation send actions or receive snapshots through its Socket.IO server. Host or phone refreshes recover while the server stays running. Once installed, ordinary LAN gameplay does not need public Internet, PeerJS, STUN, TURN, or WebRTC.

## Windows or Mac launcher

The repository also includes `START-WINDOWS.bat` and `START-MAC.command`. They install locked dependencies if needed, build the game, run `npm start`, and try to open a laptop LAN URL. The launchers may build once before `npm start` builds again; this takes extra time but does not change gameplay. Keep the game server window open. On Mac, run `chmod +x START-MAC.command` once if the downloaded launcher is not executable.

## If a phone cannot join

- Try the numeric LAN URL printed by the server, rather than `localhost` or the GitHub Pages preview. The phone must be able to reach the laptop's port 3000.
- Check that the laptop and phone are on the same Wi-Fi. Guest Wi-Fi may isolate devices from one another.
- Allow Node.js through the Windows **Private** firewall profile. A Public network profile may block inbound connections.
- Disconnect a VPN temporarily if it redirects local traffic.
- If the laptop has several network adapters and the printed address is wrong, set `BLUE_STAGE_BASE_URL` to the reachable `http://<laptop-LAN-IP>:3000` before starting the server.
- Confirm the server window is still open. If it stopped, restart `npm start` and let the saved Host/phone credentials reconnect.

The [networking guide](docs/networking.md) explains reconnects and troubleshooting. GitHub Pages is a static preview only; it does not run the multiplayer server.
