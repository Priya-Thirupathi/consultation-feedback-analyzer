#!/bin/bash
# Kill existing process on port 3000
PID=$(/usr/sbin/lsof -ti:3000)
if [ ! -z "$PID" ]; then
  echo "Killing existing process on port 3000: $PID"
  kill -9 $PID
fi

# Check for node_modules
if [ ! -d "node_modules" ]; then
  npm install --silent
fi
node index.js
