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
open "http://localhost:3000"

echo "Game launched at http://localhost:3000"
echo "Keep this window open while playing. Press Control-C to stop."
wait "$SERVER_PID"
