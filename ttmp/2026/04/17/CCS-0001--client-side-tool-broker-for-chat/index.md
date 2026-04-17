---
Title: Client-side tool broker for chat
Ticket: CCS-0001
Status: active
Topics:
    - chat
    - backend
    - websocket
DocType: index
Intent: long-term
Owners: []
RelatedFiles:
    - Path: backend/cmd/chatd/main.go
      Note: Backend entrypoint that wires the service and HTTP server
    - Path: backend/internal/chat/contracts.go
      Note: Canonical Go-side tool manifest and envelope types
    - Path: backend/internal/chat/http.go
      Note: JSON API used to create sessions and post chat messages
    - Path: backend/internal/chat/browserbridge.go
      Note: In-memory browser session bridge used by the proof of concept
    - Path: backend/internal/chat/browserbridge_test.go
      Note: Bridge tests that exercise browser-style request/result round-trips
    - Path: backend/internal/chat/mockbridge.go
      Note: Deterministic server-side mock runner used by the proof of concept
    - Path: backend/internal/chat/mockmodel.go
      Note: Deterministic prompt-to-tool planner used by the proof of concept
    - Path: backend/internal/chat/router.go
      Note: Execution router that splits server and client tool calls
    - Path: backend/internal/chat/service.go
      Note: Session orchestration and mock model turn loop
    - Path: backend/internal/chat/service_test.go
      Note: Backend routing and turn-loop tests
    - Path: frontend/src/tool-broker/broker.ts
      Note: Frontend broker singleton scaffold for routed tool execution
    - Path: frontend/src/tool-broker/contracts.ts
      Note: Browser-side envelope vocabulary mirrored from the Go backend
    - Path: frontend/src/tool-broker/opfs-executors.ts
      Note: Browser OPFS executors backed by dedicated workers
    - Path: frontend/src/tool-broker/registry.ts
      Note: Registry of browser-capability tool definitions
    - Path: frontend/src/tool-broker/worker-client.ts
      Note: Generic worker request helper used by the browser executors
    - Path: frontend/src/tool-broker/wasm-executors.ts
      Note: Browser WASM executor backed by a dedicated worker
    - Path: frontend/src/workers/opfs.worker.ts
      Note: Dedicated worker that performs OPFS list/read/write operations
    - Path: frontend/src/workers/parser.worker.ts
      Note: Dedicated worker for tokenization, parse, and index transforms
    - Path: frontend/src/workers/wasm.worker.ts
      Note: Dedicated worker that performs local compute tasks
    - Path: ttmp/2026/04/17/CCS-0001--client-side-tool-broker-for-chat/changelog.md
      Note: Chronological ticket changelog
    - Path: ttmp/2026/04/17/CCS-0001--client-side-tool-broker-for-chat/design-doc/01-client-side-tool-broker-design-and-implementation-guide.md
      Note: Primary design guide for the ticket
    - Path: ttmp/2026/04/17/CCS-0001--client-side-tool-broker-for-chat/reference/01-client-side-tool-broker-api-reference.md
      Note: Quick reference for the tool-manifest and event contracts
    - Path: ttmp/2026/04/17/CCS-0001--client-side-tool-broker-for-chat/reference/02-diary.md
      Note: Chronological investigation diary
    - Path: ttmp/2026/04/17/CCS-0001--client-side-tool-broker-for-chat/tasks.md
      Note: Current task checklist
ExternalSources: []
Summary: Browser-routed chat proof-of-concept with Go-owned session state and client-side execution for browser-only tools.
LastUpdated: 2026-04-17T08:59:26.78137053-04:00
WhatFor: ""
WhenToUse: ""
---



# Client-side tool broker for chat

## Overview

This ticket documents the design for a simple proof of concept where the Go backend owns the conversation and the browser owns capability-bound tools such as OPFS and WASM workers. The repository now includes an initial implementation scaffold: the Go backend service, mock router, backend tests, and frontend contract files exist, but the real browser execution path is still a stub.

The main goal is still to validate the routed RPC model with mocked LLM calls and minimal policy. That keeps the first build small while still proving the most important boundary: model → backend router → browser tool broker → backend → model.

## Key Links

- [Design guide](./design-doc/01-client-side-tool-broker-design-and-implementation-guide.md)
- [API reference](./reference/01-client-side-tool-broker-api-reference.md)
- [Diary](./reference/02-diary.md)
- [Changelog](./changelog.md)
- [Tasks](./tasks.md)

## Status

Current status: **active**

## Topics

- chat
- backend
- websocket

## Tasks

See [tasks.md](./tasks.md) for the current task list.

## Changelog

See [changelog.md](./changelog.md) for recent changes and decisions.

## Structure

- `design-doc/` - Architecture and implementation guidance
- `reference/` - API reference and the investigation diary
- `playbooks/` - Command sequences and QA procedures
- `scripts/` - Temporary code and tooling
- `sources/` - Imported evidence or external material
- `various/` - Scratch notes and intermediate research
- `archive/` - Deprecated or reference-only artifacts
