#!/bin/bash
cd "$(dirname "$0")"

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js is required to run the game."
  echo "Install the LTS version from https://nodejs.org/"
  read -r -p "Press Enter to close..."
  exit 1
fi

echo "Installing locked dependencies..."
npm ci --no-audit --no-fund || exit 1

echo "Building game..."
npm run build || exit 1

echo "Starting game..."
npm start &
SERVER_PID=$!
sleep 3

LAN_IP="$(ipconfig getifaddr en0 2>/dev/null || true)"
if [ -z "$LAN_IP" ]; then
  LAN_IP="$(ipconfig getifaddr en1 2>/dev/null || true)"
fi
if [ -n "$LAN_IP" ]; then
  GAME_URL="http://${LAN_IP}:3000"
else
  GAME_URL="http://localhost:3000"
fi

open "$GAME_URL"

echo "Game launched at $GAME_URL"
echo "Opening the LAN address lets phone QR links point back to this computer."
echo "Keep this window open while playing. Press Control-C to stop."
wait "$SERVER_PID"
