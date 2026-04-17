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
- [ ] Wire a real browser transport and replace the loopback client bridge

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

- The implementation code does not exist yet; this ticket is a design-first proof-of-concept.
- The simple version intentionally excludes policy-engine complexity and real LLM integration.
