#!/bin/bash
cd "$(dirname "$0")"
PORT=8080
python3 -m http.server "$PORT" --directory public &
SERVER_PID=$!
sleep 2
open "http://127.0.0.1:$PORT"
echo "CRICBETUL RPL demo running at http://127.0.0.1:$PORT"
echo "Press Ctrl+C in this Terminal window to stop the demo."
wait "$SERVER_PID"
