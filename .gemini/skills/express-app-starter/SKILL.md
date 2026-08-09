---
name: express-app-starter
description: Installs dependencies and starts an Express.js application from index.js. Use when the user needs to launch a local Express server and has a package.json and index.js present.
---

# Express App Starter

## Workflow

1. Checks for `node_modules` and installs dependencies if missing.
2. Executes `node index.js` to start the server.

## Implementation

This skill uses `scripts/start.sh` to automate this process.
