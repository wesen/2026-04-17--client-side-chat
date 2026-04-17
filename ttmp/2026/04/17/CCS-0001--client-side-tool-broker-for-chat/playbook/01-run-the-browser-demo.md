---
Title: Run the browser demo
Ticket: CCS-0001
Status: active
Topics:
    - chat
    - backend
    - websocket
DocType: playbook
Intent: long-term
Owners: []
RelatedFiles:
    - Path: backend/cmd/chatd/main.go
      Note: Backend entrypoint used by the tmux demo launch
    - Path: backend/internal/chat/http.go
      Note: Backend handler now serves the static demo bundle and API endpoints from one origin
    - Path: backend/internal/chat/mockmodel.go
      Note: Prompt routing for Browse OPFS and TODO search flows used by the playbook
    - Path: frontend/src/demo/browser-chat-demo.ts
      Note: |-
        Demo shell that the playbook launches in the browser
        Demo shell with the Diagnostics modal and OPFS browse shortcut
    - Path: frontend/src/main.ts
      Note: Browser bootstrap built into frontend/dist/main.js
    - Path: frontend/src/workers/opfs.worker.ts
      Note: OPFS worker metadata shown by the Diagnostics modal
    - Path: frontend/src/workers/wasm.worker.ts
      Note: WASM module initialization log and runtime metadata shown by the Diagnostics modal
    - Path: ttmp/2026/04/17/CCS-0001--client-side-tool-broker-for-chat/changelog.md
      Note: Log entry for the playbook creation and verification
    - Path: ttmp/2026/04/17/CCS-0001--client-side-tool-broker-for-chat/reference/02-diary.md
      Note: Chronological record of the tmux launch and browser smoke test
ExternalSources: []
Summary: Command sequence for building, starting, and using the client-side tool broker demo in a browser.
LastUpdated: 2026-04-17T08:59:26.78137053-04:00
WhatFor: ""
WhenToUse: ""
---




# Run the browser demo

## Purpose

This playbook starts the proof-of-concept demo end-to-end: it bundles the frontend TypeScript into a browser-ready file, starts the Go backend, and serves the demo from the same origin so the UI can talk to the websocket transport and the JSON session endpoints.

## Environment Assumptions

- You are in the repository root: `/home/manuel/code/wesen/2026-04-17--client-side-chat`
- Go 1.22 is installed
- Node.js 22 is installed
- `npm exec` can download and run `esbuild` and `typescript` on demand
- The backend serves static assets from `frontend/dist`
- Port `8090` is available (the demo uses this port to avoid conflicts with local services)

## Commands

### 1) Build the browser bundle

```bash
mkdir -p frontend/dist
npm exec --yes --package esbuild@0.24.0 -- \
  esbuild frontend/src/main.ts \
  --bundle \
  --format=esm \
  --platform=browser \
  --target=es2022 \
  --outfile=frontend/dist/main.js

cat > frontend/dist/index.html <<'EOF'
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Client-side tool broker demo</title>
    <link rel="icon" href="data:," />
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/main.js"></script>
  </body>
</html>
EOF
```

### 2) Validate the frontend TypeScript build

```bash
npm exec --yes --package typescript@5.8.3 -- \
  tsc --project frontend/tsconfig.json --noEmit
```

### 3) Start the backend in tmux

```bash
tmux new-session -d -s ccs-0001-demo \
  'CHATD_ADDR=:8090 go run ./backend/cmd/chatd'

tmux capture-pane -pt ccs-0001-demo
```

If you need to rebuild the frontend bundle later, rerun step 1 and restart the backend process inside tmux.

### 4) Open the demo

Visit:

```text
http://localhost:8090/
```

## Exit Criteria

- `frontend/dist/main.js` exists
- `frontend/dist/index.html` exists
- `npm exec --yes --package typescript@5.8.3 -- tsc --project frontend/tsconfig.json --noEmit` succeeds
- the tmux session `ccs-0001-demo` is running `CHATD_ADDR=:8090 go run ./backend/cmd/chatd`
- `http://localhost:8090/` loads the demo shell
- sending `Browse OPFS /notes` produces an `opfs.list_dir` tool round trip
- sending `Search my local project for TODOs.` produces a backend turn and a `wasm.run_task` round trip
- clicking **Diagnostics** shows the low-level worker metadata, including the WASM module export list and initialization time

## Notes

- The backend and browser demo intentionally share the same origin so the websocket and message endpoints can use the default `window.location.origin`.
- The demo is intentionally small and DOM-based so it can run without a full frontend framework or dev server.
- Open Firefox DevTools Console if you want to see the worker initialization log; the demo WASM worker prints a `[wasm.worker] demo wasm module initialized ...` message when it starts.
- If `go run` fails because `frontend/dist` is missing, repeat the build step before restarting tmux.
