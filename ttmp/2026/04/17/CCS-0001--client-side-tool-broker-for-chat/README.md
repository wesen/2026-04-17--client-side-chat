# CCS-0001 — Client-side tool broker for chat

This ticket workspace captures the design, implementation notes, runbook, and final narrative documentation for the client-side chat/tool-broker proof of concept.

The repository itself lives at:

`/home/manuel/code/wesen/2026-04-17--client-side-chat`

The primary ticket goal was to prove a simple architecture where:

- the **Go backend** owns the conversation and routing loop
- the **browser** owns capability-bound tools like OPFS and WASM
- tool execution is carried over a **structured request/result protocol**
- the demo stays **mocked, same-origin, and lightweight**

## What is included here

### Core docs

- `design-doc/01-client-side-tool-broker-design-and-implementation-guide.md`
- `reference/01-client-side-tool-broker-api-reference.md`
- `reference/02-diary.md`
- `playbook/01-run-the-browser-demo.md`
- `changelog.md`
- `tasks.md`
- `index.md`

### Copied narrative notes

The longer Obsidian vault notes have been copied into `sources/` so this ticket has local copies of the final write-up material:

- `sources/PROJ - Client-side Tool Broker for Chat - Intern Research Guide.md`
- `sources/ARTICLE - Browser-Owned Capability Execution for Chat - Narrative Field Guide.md`

### Other workspace folders

- `design/` — design-related material and scratch work
- `reference/` — API and reference documentation
- `playbook/` and `playbooks/` — operational runbooks
- `sources/` — copied notes and source material
- `various/` — miscellaneous supporting files
- `archive/` — historical or retired artifacts

## How to read this ticket

If you are new here, read in this order:

1. `index.md` — high-level ticket status
2. `design-doc/01-client-side-tool-broker-design-and-implementation-guide.md` — the system design
3. `reference/01-client-side-tool-broker-api-reference.md` — the message contract
4. `playbook/01-run-the-browser-demo.md` — how to run the demo
5. `reference/02-diary.md` — chronological implementation narrative
6. `sources/PROJ - Client-side Tool Broker for Chat - Intern Research Guide.md` — intern-focused project report
7. `sources/ARTICLE - Browser-Owned Capability Execution for Chat - Narrative Field Guide.md` — the reusable architecture article

## Final state

The ticket now contains:

- the design and reference docs
- a runnable browser demo playbook
- a chronological diary
- a project-focused research guide
- a longer narrative article about the architecture pattern

In short: the POC is documented from both sides now — as a specific project and as a reusable pattern.

## Validation snapshot

The implementation and demo were validated with:

- `go test ./...`
- `npm exec --yes --package typescript@5.8.3 -- tsc --project frontend/tsconfig.json --noEmit`
- browser smoke testing at `http://localhost:8090/`
- Firefox DevTools console inspection for WASM worker startup evidence

## Current operating notes

- The browser demo uses a same-origin backend on port `8090`.
- The demo is intentionally mocked; no real LLM provider is wired in yet.
- The diagnostics modal is the quickest way to inspect tool requests, tool results, and worker metadata.

## Closing thought

This ticket is a proof-of-concept milestone, not the end of the product idea. The docs here should give a new reader enough context to understand the architecture, run the demo, and extend the system without having to reconstruct the story from chat history.
