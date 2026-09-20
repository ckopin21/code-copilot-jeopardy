# iPhone Safari multiplayer root-cause analysis

This note records the confirmed causes before implementation changes are made.

## Confirmed code-level failures

1. Player heartbeat timeouts do not currently invalidate the WebRTC data connection. Safari can leave a PeerJS `DataConnection` marked open after iOS sleep or a network-path change. The reconnect scheduler refuses to start while that stale object still reports `open`, so recovery can hang indefinitely.

2. `pagehide` closes the current data connection but leaves the client PeerJS `Peer` alive. A bfcache restore or WebKit resume can therefore reuse a signaling peer whose JavaScript state still says open even though its network session is stale.

3. Existing `online`, `pageshow`, and visibility recovery paths only schedule reconnect when no open connection exists. That is insufficient when the browser's open flag is stale.

4. Player lifecycle handling is duplicated between `PlayerApp` and the global client lifecycle module, increasing the chance of overlapping reconnect attempts and making recovery ordering harder to reason about.

## Network limitation

The default ICE configuration is STUN-only. STUN can discover public-facing candidates, but it cannot relay traffic when direct NAT traversal is impossible. Restrictive or symmetric NAT combinations therefore require TURN for reliable cross-network operation.

Because this app is deployed as static GitHub Pages, long-lived TURN credentials must not be embedded in the bundle. The implementation should support fetching short-lived ICE/TURN credentials from a separately hosted HTTPS endpoint instead.

## Fix direction

- Treat an unanswered heartbeat as a broken transport and rebuild it.
- Recreate PeerJS signaling state after lifecycle/network recovery when the old state cannot be trusted.
- Centralize client lifecycle recovery.
- Reuse saved player ID/reconnect token so the same seat is reclaimed.
- Add secure runtime TURN configuration without committed secrets.
- Add Chromium and WebKit regression coverage in CI.
