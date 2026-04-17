---
Title: Client-side tool broker for chat tasks
Ticket: CCS-0001
Status: active
Topics:
    - chat
    - backend
    - websocket
DocType: task-list
Intent: short-term
Owners: []
RelatedFiles: []
ExternalSources: []
Summary: Work items for the browser-routed tool broker proof of concept.
LastUpdated: 2026-04-17T08:59:26.78137053-04:00
WhatFor: ""
WhenToUse: ""
---

# Client-side tool broker for chat tasks

## Tasks

- [x] Create the CCS-0001 ticket workspace
- [x] Draft the design guide for the browser-routed tool broker
- [x] Draft the API reference for manifests and envelopes
- [x] Draft the investigation diary
- [x] Run docmgr validation (`docmgr doctor --ticket CCS-0001 --stale-after 30`)
- [x] Update ticket bookkeeping with file relations and changelog entries
- [x] Upload the document bundle to reMarkable
- [x] Verify the uploaded bundle listing on reMarkable
- [x] Scaffold the Go backend service, mock model, and router
- [x] Scaffold the frontend tool-broker contracts and worker stubs
- [x] Add backend unit tests for routing and mock-model flow
- [x] Wire a browser session bridge that replaces the loopback client bridge
- [x] Add worker-backed browser executors for OPFS and WASM tasks
- [x] Add a websocket transport endpoint for browser sessions
- [x] Add a browser websocket session client
- [x] Wire the session client into the demo chat UI
- [x] Validate the frontend TypeScript demo with `tsc --noEmit`
- [x] Refresh the reMarkable bundle after the demo UI wiring
- [x] Verify the refreshed bundle listing on reMarkable
- [x] Create the browser demo run playbook
- [x] Launch the demo in tmux on port 8090
- [x] Verify the browser smoke test end-to-end

## Completed

- [x] Ticket workspace created under `2026/04/17/CCS-0001--client-side-tool-broker-for-chat`
- [x] Design doc written with architecture, pseudocode, and implementation phases
- [x] API reference written with manifest and envelope examples
- [x] Diary started with chronological notes
- [x] Ticket relations updated for the design guide, API reference, and diary
- [x] Changelog updated with workspace creation, drafting, and validation entries
- [x] reMarkable bundle uploaded to `/ai/2026/04/17/CCS-0001`
- [x] reMarkable bundle listing verified
- [x] Backend Go scaffold now compiles and passes `go test ./...`

## Notes

- The implementation is still a proof-of-concept; the websocket/browser transport is now present, but a production LLM provider is intentionally out of scope for now.
- The browser demo is DOM-based to avoid a React/toolchain dependency in this repo.
- Frontend TypeScript validation used `npm exec --yes --package typescript@5.8.3 -- tsc --project frontend/tsconfig.json --noEmit`.
- The run playbook uses `CHATD_ADDR=:8090 go run ./backend/cmd/chatd` and the browser smoke-test URL is `http://localhost:8090/`.
- The demo backend is currently running in tmux as `ccs-0001-demo`.
- The simple version intentionally excludes policy-engine complexity and real LLM integration.
