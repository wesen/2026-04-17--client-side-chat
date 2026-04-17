---
Title: Diary
Ticket: CCS-0001
Status: active
Topics:
    - chat
    - backend
    - websocket
DocType: reference
Intent: long-term
Owners: []
RelatedFiles:
    - Path: backend/internal/chat/service.go
      Note: Implementation step recorded in the diary
    - Path: backend/internal/chat/service_test.go
      Note: Validation evidence captured in the diary
    - Path: frontend/src/tool-broker/broker.ts
      Note: Frontend scaffold referenced by the implementation diary
    - Path: frontend/src/tool-broker/contracts.ts
      Note: Frontend contract layer referenced by the implementation diary
    - Path: ttmp/2026/04/17/CCS-0001--client-side-tool-broker-for-chat/design-doc/01-client-side-tool-broker-design-and-implementation-guide.md
      Note: Primary design artifact documented in the diary
    - Path: ttmp/2026/04/17/CCS-0001--client-side-tool-broker-for-chat/reference/01-client-side-tool-broker-api-reference.md
      Note: Companion quick-reference for the same routing contract
ExternalSources: []
Summary: Chronological investigation diary for ticket CCS-0001.
LastUpdated: 2026-04-17T08:59:26.597070339-04:00
WhatFor: ""
WhenToUse: ""
---



# Diary

## Goal

This diary captures the work done to turn the browser-routed tool-broker idea into a concrete, reviewable ticket. It records the commands that were run, the decisions that were made, what was learned from the workspace, and what remains to be validated.

## Step 1: Create the ticket workspace and inspect the current repository state

This first step turned the user request into a docmgr ticket and established the current shape of the workspace. The key outcome is that we now have a named ticket and a clear record that the repository itself does not yet contain application source code; it is a documentation workspace that needs to define the implementation from scratch.

That matters because the rest of the work should be framed as a design-first effort. Before writing the detailed guide, I needed to confirm the docs root, create the ticket, and understand what was already present so the analysis would not invent an existing runtime that is not actually there.

### Prompt Context

**User prompt (verbatim):** "Create a new docmgr ticket to build the attached tool.

We want a simple version:
- mock LLM calls, this is just a proof of concept
- no policy stuff, that's overly complex.

Yes. The clean version is:

**Go backend owns the conversation and the model session.**
**Frontend owns capability-bound tools** like OPFS access, WASM workers, device APIs, and other browser-only actions.
**Tool calls become a routed RPC protocol** where some tools execute server-side and some execute client-side. This matches the standard tool-calling loop: the model emits a tool call, your application executes it, then sends the tool result back to the model. ([OpenAI Developers][1])

A workable architecture looks like this:

```text
┌──────────────────────────────── Browser / Frontend ────────────────────────────────┐
│                                                                                   │
│  Chat UI                                                                           │
│    └─ sends user messages / receives streamed assistant text                       │
│                                                                                   │
│  Frontend Tool Broker                                                              │
│    ├─ validates tool requests from backend                                         │
│    ├─ dispatches to browser tools                                                  │
│    ├─ enforces per-tool permissions / consent                                      │
│    ├─ returns structured tool results                                              │
│    │                                                                               │
│    ├─ OPFS Tool Adapter                                                            │
│    │   └─ reads/writes origin-private files                                        │
│    │      OPFS is origin-private and optimized for file access                     │
│    │      createSyncAccessHandle is worker-only for OPFS files                     │
│    │      :contentReference[oaicite:1]{index=1}
│    │                                                                               │
│    ├─ WASM Tool Adapter                                                            │
│    │   └─ spawns Dedicated Workers / WASM modules                                  │
│    │      Workers run off the main UI thread                                       │
│    │      WebAssembly runs in modern browsers and is suited to compute-heavy work  │
│    │      :contentReference[oaicite:2]{index=2}
│    │                                                                               │
│    └─ Browser-only capability adapters                                             │
│        └─ file pickers, local parsing, media, etc.                                 │
│                                                                                   │
│  Worker Mesh                                                                       │
│    ├─ dedicated wasm worker(s)                                                     │
│    ├─ local indexing / embeddings / parsing                                        │
│    └─ optional shared state via message passing                                    │
│                                                                                   │
└───────────────────────────────▲───────────────────────────────────────────────────┘
                                │ WebSocket / SSE + POST
                                │ tool_request / tool_result envelopes
                                ▼
┌──────────────────────────────── Go Backend ────────────────────────────────────────┐
│                                                                                   │
│  API Gateway / Session Manager                                                     │
│    ├─ auth                                                                         │
│    ├─ conversation state                                                           │
│    ├─ stream orchestration                                                         │
│    └─ per-session tool registry snapshot                                           │
│                                                                                   │
│  Agent Orchestrator                                                                │
│    ├─ builds model request                                                         │
│    ├─ declares available tools                                                     │
│    ├─ receives model tool calls                                                    │
│    ├─ routes server tools locally                                                  │
│    └─ routes client tools to the browser                                           │
│                                                                                   │
│  Server Tool Runner                                                                │
│    ├─ DB/search/internal APIs                                                      │
│    ├─ retrieval                                                                    │
│    └─ sensitive operations                                                         │
│                                                                                   │
│  Policy / Guardrails                                                               │
│    ├─ allowlist which client tools are exposed                                     │
│    ├─ argument schemas                                                             │
│    ├─ authz / tenancy                                                              │
│    └─ audit log                                                                    │
│                                                                                   │
│  LLM Provider                                                                      │
│    └─ model inference with tool definitions                                        │
│                                                                                   │
└───────────────────────────────────────────────────────────────────────────────────┘
```

Keep a frequent diary as you work.

reate a detailed analysis / design / implementation guide that is very detailed for a new intern, explaining all the parts of the system needed to understand what it is, with prose paragraphs and bullet point sand pseudocode and diagrams and api references and file
  references.
  It should be very clear and detailed. Store in the ticket and the nupload to remarkable."

**Assistant interpretation:** The user wants a docmgr ticket plus a detailed onboarding-friendly design and implementation guide for a browser-routed tool broker, with the implementation deliberately simplified to mock model calls and minimal policy.

**Inferred user intent:** Create a durable documentation trail for a proof-of-concept architecture so a new engineer can understand the system boundary, the data flow, and the first implementation steps.

### What I did
- Ran `docmgr status --summary-only` to inspect the workspace state.
- Ran `find . -maxdepth 2 -type f | sed 's#^./##' | sort | head -200` to confirm what files existed.
- Created ticket `CCS-0001` with `docmgr ticket create-ticket --ticket CCS-0001 --title "Client-side tool broker for chat" --topics chat,backend,websocket`.
- Created the initial docs with `docmgr doc add` for the design guide, API reference, and diary.

### Why
- The design doc needs to rest on a known workspace state.
- Creating the ticket first gives the rest of the docs a stable home and ID.
- Confirming that there is no application code yet prevents accidental claims about current runtime behavior.

### What worked
- The ticket workspace was created successfully.
- The ticket path is `2026/04/17/CCS-0001--client-side-tool-broker-for-chat`.
- The workspace now has the canonical doc set needed for a design-first ticket.

### What didn't work
- N/A. There were no command failures in this step.

### What I learned
- This repository is a docmgr workspace rather than a codebase with an existing implementation.
- The architecture needs to be documented as a first build, not as a refactor.

### What was tricky to build
- The main challenge was avoiding false assumptions about existing source files or runtime components.
- Because there is no application code yet, the diary had to focus on evidence from the workspace itself rather than on file diffs.

### What warrants a second pair of eyes
- Confirm that the eventual implementation repo matches the file layout assumed in the design guide.
- Check that the simplified POC really stays free of policy-engine creep.

### What should be done in the future
- Create the actual source tree that the design guide proposes.
- Keep later diary steps tied to code changes, tests, and validation commands instead of only document authoring.

### Code review instructions
- Start with the ticket index and the design guide.
- Verify that the described system boundary matches the intended product scope.
- If implementation files are added later, review them against the proposed backend/router/frontend split.

### Technical details
- Ticket path: `2026/04/17/CCS-0001--client-side-tool-broker-for-chat`
- Commands run: `docmgr status --summary-only`, `find . -maxdepth 2 -type f | sed 's#^./##' | sort | head -200`, `docmgr ticket create-ticket ...`, `docmgr doc add ...`

## Step 2: Draft the design guide and API reference for the routed tool protocol

This step converted the high-level architecture into a concrete design document and a compact API reference. The result is a guide that an intern can follow without already knowing the codebase: it explains the backend/frontend split, the message envelopes, the tool categories, and the proposed file layout for the first implementation.

The design intentionally stays simple. It models mocked LLM behavior, keeps policy out of scope, and focuses on the routing contract between Go and the browser. That makes the document useful for implementation planning while keeping the proof-of-concept easy to reason about.

### Prompt Context

**User prompt (verbatim):** (same as Step 1)

**Assistant interpretation:** Turn the requested architecture into an implementable, high-detail design guide and a supporting API reference.

**Inferred user intent:** Give the team a clear, durable blueprint that can be handed to a new engineer for implementation.

### What I did
- Wrote `design-doc/01-client-side-tool-broker-design-and-implementation-guide.md` with sections for executive summary, scope, architecture, manifests, pseudocode, implementation phases, tests, risks, and references.
- Wrote `reference/01-client-side-tool-broker-api-reference.md` with copy/paste-ready tool manifests, envelopes, error codes, and usage examples.
- Included Mermaid diagrams, file-layout guidance, and explicit examples of `execution`, `visibility`, and `tool.request` / `tool.result` envelopes.

### Why
- The main guide gives the reasoning and implementation plan.
- The reference doc gives the exact shapes developers will need while coding.
- Separating the two makes the workspace easier to navigate for both architects and implementers.

### What worked
- The architecture is now expressed as a backend orchestrator plus a frontend capability executor.
- The POC constraints are visible in writing: mock model, no policy engine, routed tool calls.
- The docs now include enough detail for a new contributor to start implementation without guessing the intended boundaries.

### What didn't work
- N/A. This was a documentation-only step.

### What I learned
- The cleanest way to keep the system understandable is to treat tool execution location as a first-class schema field.
- The browser broker and backend router should be mirror images of each other with different trust responsibilities.

### What was tricky to build
- The biggest challenge was balancing detail with simplicity: the guide needed to be very explicit for onboarding, but the POC itself should still be small.
- Another sharp edge was deciding how much policy language to retain. The final doc keeps only minimal validation and allowlist concepts.

### What warrants a second pair of eyes
- Confirm that the proposed endpoint names and envelope shapes are stable enough for the first build.
- Review the proposed file layout to ensure it aligns with the repository’s actual package structure once code exists.

### What should be done in the future
- Implement the mock backend loop and browser broker described in the guide.
- Add tests that verify request/result correlation and local-only versus model-visible result handling.

### Code review instructions
- Start in the design guide, then open the API reference and trace one request end-to-end.
- Verify that every tool call has an explicit execution location and visibility mode.
- Check that the frontend is never described as a direct model target; it is only a tool executor.

### Technical details
- Design doc: `design-doc/01-client-side-tool-broker-design-and-implementation-guide.md`
- API reference: `reference/01-client-side-tool-broker-api-reference.md`
- Key contract shapes: `session.capabilities`, `tool.request`, `tool.result`, `tool.error`
- Implementation targets: `backend/cmd/chatd/main.go`, `backend/internal/chat/router.go`, `frontend/src/tool-broker/broker.ts`, `frontend/src/workers/opfs.worker.ts`, `frontend/src/workers/wasm.worker.ts`

## Step 3: Validate the ticket and deliver the documentation bundle to reMarkable

This step closed the documentation loop. I validated the ticket workspace, packaged the completed docs into a single reMarkable bundle, and verified that the remote file appeared in the expected destination. The result is a ticket that is both locally consistent and externally delivered.

The important thing here is that the delivery path matched the simplified scope of the ticket: there is still no application code, but the design, API reference, task list, changelog, and diary are now all in sync and ready for the implementation phase.

### Prompt Context

**User prompt (verbatim):** (same as Step 1)

**Assistant interpretation:** Finish the documentation workflow by validating the ticket and publishing the bundle to reMarkable.

**Inferred user intent:** Make the ticket easy to review and portable for offline reading or annotation.

### What I did
- Ran `docmgr doctor --ticket CCS-0001 --stale-after 30` and confirmed that all checks passed.
- Ran `remarquee status` and `remarquee cloud account --non-interactive` to verify the delivery toolchain.
- Ran a bundle dry-run with `remarquee upload bundle --dry-run ... --name "CCS-0001 client-side tool broker" --remote-dir "/ai/2026/04/17/CCS-0001" --toc-depth 2`.
- Uploaded the bundle for real with the same files and options.
- Verified the remote destination with `remarquee cloud ls /ai/2026/04/17/CCS-0001 --long --non-interactive`.

### Why
- Validation confirms the docs are internally consistent before delivery.
- The dry-run reduces the risk of shipping a broken bundle or missing files.
- The remote listing gives a final confirmation that the upload landed where expected.

### What worked
- `docmgr doctor` returned a clean report.
- `remarquee` was available and authenticated.
- The reMarkable bundle uploaded successfully.
- The remote listing showed the uploaded bundle in `/ai/2026/04/17/CCS-0001`.

### What didn't work
- N/A. The validation and delivery path completed successfully.

### What I learned
- The docs are self-contained enough to stand on their own as an implementation briefing.
- A bundle upload is a good fit for this kind of ticket because the reviewer gets one artifact with a table of contents instead of a set of disconnected markdown files.

### What was tricky to build
- The only real sharp edge was keeping the bundle file selection aligned with the ticket story while avoiding unnecessary clutter.
- It was also important to preserve the distinction between documentation delivery and implementation; the upload succeeded without implying any code exists yet.

### What warrants a second pair of eyes
- Confirm that the reMarkable bundle contains the intended document set and ordering.
- Review the next implementation step to ensure it follows the simple mocked-LLM scope and does not expand into policy machinery prematurely.

### What should be done in the future
- Start the actual Go backend and browser broker implementation from the proposed file layout.
- Keep the diary updated with code changes, tests, and any runtime issues that appear once implementation begins.

### Code review instructions
- Start with the ticket index, then read the design guide and the API reference.
- If the implementation starts, compare the code against the file targets listed in the design doc.
- Validate the round-trip flow with a local end-to-end demo after code lands.

### Technical details
- Validation command: `docmgr doctor --ticket CCS-0001 --stale-after 30`
- Delivery commands: `remarquee status`, `remarquee cloud account --non-interactive`, `remarquee upload bundle --dry-run ...`, `remarquee upload bundle ...`, `remarquee cloud ls /ai/2026/04/17/CCS-0001 --long --non-interactive`
- Delivery destination: `/ai/2026/04/17/CCS-0001`

## Step 4: Scaffold the backend service and frontend contract layer

This step turned the design into code. I added a small Go service that owns sessions, a mock model, a router, and HTTP endpoints, plus a matching frontend contract layer with a tool broker, registry, and worker stubs. The backend now has a complete in-memory route from user prompt to mock tool call and back to assistant text, which is enough to validate the architecture without a real browser runtime yet.

The important boundary is still preserved: the backend owns the conversation and chooses the tool, while the frontend code defines the future browser-side execution contract. For now, a loopback client bridge stands in for the browser so the orchestration logic can be tested and compiled before the real websocket/browser transport exists.

### Prompt Context

**User prompt (verbatim):** (same as Step 1)

**Assistant interpretation:** Build the initial code scaffold for the backend and the browser tool-contract layer.

**Inferred user intent:** Move from design docs into the first runnable implementation, while keeping the architecture simple and mocked.

**Commit (code):** 96a791f — "Scaffold backend and frontend tool broker"

### What I did
- Created `go.mod` for a local Go module named `clientsidechat`.
- Added backend code under `backend/cmd/chatd` and `backend/internal/chat` for:
  - session storage
  - tool manifests and envelopes
  - a deterministic mock model
  - a routed client/server tool bridge
  - a small HTTP API
  - backend unit tests
- Added frontend scaffold files under `frontend/src` for:
  - tool broker contracts
  - a broker singleton
  - a tool registry
  - OPFS / parser / WASM worker stubs
  - a minimal `ChatView` component stub
- Refreshed the reMarkable bundle after the scaffold landed so the published docs match the current ticket state.
- Ran `gofmt -w backend/cmd/chatd/main.go backend/internal/chat/*.go && go test ./...`.

### Why
- The ticket needed a real code foundation before browser transport and UI work can happen.
- The backend and frontend contracts should be visible in source before the browser integration is attempted.
- A loopback client bridge makes it possible to validate the orchestration path now and swap in a real browser bridge later.

### What worked
- The backend test suite now passes with `go test ./...`.
- The mock model can route prompts to either a server tool or a client tool.
- The frontend files now define the same tool envelope vocabulary as the Go backend.
- The HTTP backend can create sessions and process user messages through the mock tool loop.

### What didn't work
- The first `go test ./...` run failed with:

  ```text
  # clientsidechat/backend/internal/chat
  backend/internal/chat/service.go:5:2: "encoding/json" imported and not used
  FAIL	clientsidechat/backend/cmd/chatd [build failed]
  FAIL	clientsidechat/backend/internal/chat [build failed]
  FAIL
  ```

- The first attempt to refresh the reMarkable bundle without `--force` was skipped with:

  ```text
  SKIP: CCS-0001 client-side tool broker already exists in /ai/2026/04/17/CCS-0001 (use --force to overwrite)
  ```

- I fixed the Go compile issue by removing the unused import from `backend/internal/chat/service.go` and simplifying `HandleToolResult` so it reads the tool name from structured metadata when present.
- I fixed the bundle refresh by rerunning `remarquee upload bundle --force ...` with the same document set.

### What I learned
- Even a small scaffold benefits from keeping the contract types shared mentally between Go and TypeScript.
- A loopback bridge is a useful stepping stone because it validates orchestration before the browser transport exists.
- The mock model is easier to reason about when it only needs to decide between a handful of deterministic tool plans.

### What was tricky to build
- The main sharp edge was keeping the backend service generic enough for future browser transport while still making it executable now.
- Another tricky point was deciding what the mock model should do after a tool result arrives; the solution was to make it summarize the structured output rather than invent new behavior.

### What warrants a second pair of eyes
- Confirm that the loopback client bridge is clearly temporary and will be replaced by a real browser transport in the next implementation step.
- Review the backend/router/service split to make sure it still matches the design doc’s trust-boundary story.
- Check that the frontend broker and worker stubs are adequate placeholders rather than misleading pseudo-implementations.

### What should be done in the future
- Replace the loopback client bridge with a real websocket or browser messaging bridge.
- Wire the frontend broker to actual OPFS and WASM behaviors.
- Add browser-level tests once the frontend runtime exists.

### Code review instructions
- Start in `backend/internal/chat/service.go`, `backend/internal/chat/router.go`, and `backend/internal/chat/mockmodel.go`.
- Then review `frontend/src/tool-broker/broker.ts` and `frontend/src/tool-broker/contracts.ts` to confirm the envelope vocabulary matches the backend.
- Validate with `go test ./...`.

### Technical details
- Go entrypoint: `backend/cmd/chatd/main.go`
- Core backend contracts: `backend/internal/chat/contracts.go`
- Routing loop: `backend/internal/chat/service.go` and `backend/internal/chat/router.go`
- Mock client execution: `backend/internal/chat/mockbridge.go`
- Frontend contract layer: `frontend/src/tool-broker/contracts.ts`, `frontend/src/tool-broker/broker.ts`, `frontend/src/tool-broker/registry.ts`
- Validation command: `gofmt -w backend/cmd/chatd/main.go backend/internal/chat/*.go && go test ./...`

## Step 5: Replace the loopback bridge with an attachable browser session bridge and worker-backed executors

This step made the browser side feel like a real capability executor instead of a placeholder. The backend now routes client-side tool calls through an attachable in-memory browser bridge with request/result correlation, and the frontend tool registry now uses actual worker-backed executors for OPFS and WASM tasks. The result is still a proof of concept, but the boundary is much closer to the intended production shape.

The most important thing preserved here is the trust split: the Go backend still owns the conversation and the orchestration loop, while browser-only actions are executed behind a narrow transport contract. The browser bridge is in-memory for now, but the request/result flow, pending-call cleanup, and worker execution path are all explicit and testable.

### Prompt Context

**User prompt (verbatim):** (same as Step 1)

**Assistant interpretation:** Replace the temporary loopback client bridge with a more realistic browser session bridge and make the frontend executors perform actual worker-backed local tasks.

**Inferred user intent:** Move the POC from pure scaffolding toward a believable end-to-end architecture that still stays simple and mock-friendly.

**Commit (code):** dc724a1 — "Add browser bridge and worker-backed executors"

**Commit (docs):** ca149cf — "Update ticket docs for browser bridge"

### What I did
- Added `backend/internal/chat/browserbridge.go` with:
  - attachable browser sessions
  - request/result correlation
  - timeout handling
  - disconnect handling
  - capability publication hooks
- Added `backend/internal/chat/browserbridge_test.go` to exercise both the unavailable-browser path and a successful request/result round-trip.
- Switched `backend/cmd/chatd/main.go` to use `NewBrowserBridge()` instead of the old loopback browser bridge.
- Removed the old loopback browser executor from `backend/internal/chat/mockbridge.go`; that file now only holds the deterministic server-side mock runner.
- Added `frontend/src/tool-broker/worker-client.ts` as a generic worker request helper.
- Added `frontend/src/tool-broker/opfs-executors.ts` and `frontend/src/tool-broker/wasm-executors.ts` so the registry can use real worker-backed local executors.
- Replaced the placeholder worker stubs with actual task handlers in:
  - `frontend/src/workers/opfs.worker.ts`
  - `frontend/src/workers/parser.worker.ts`
  - `frontend/src/workers/wasm.worker.ts`
- Updated `frontend/src/tool-broker/registry.ts` to wire the new executors into the default tool registry.
- Updated the ticket docs to match the new file layout and task state.
- Committed the doc updates so the ticket history reflects the bridge/executor work.
- Refreshed the reMarkable bundle with the updated docs so the published artifact stays in sync with the new bridge/executor scaffold.
- Ran `gofmt -w backend/cmd/chatd/main.go backend/internal/chat/*.go && go test ./...`.
- Checked for a local TypeScript compiler with `which tsc || true`; the environment had no `tsc` binary available, so the frontend changes were validated by source review rather than by a local TS compile.

### Why
- The loopback bridge was only useful for bootstrap. The browser bridge makes the backend/client contract explicit and much closer to how a real browser session will behave.
- Worker-backed executors prove the local execution model: the browser broker can dispatch OPFS and compute tasks without the backend needing to know the implementation details.
- Moving the worker logic into helper modules keeps the broker itself thin and readable.

### What worked
- `go test ./...` still passes after the bridge swap.
- The browser bridge tests verify both the failure mode and the request/result round trip.
- The frontend registry now points at real executor functions instead of `NOT_IMPLEMENTED` stubs.
- The OPFS worker now performs actual list/read/write operations when the browser APIs are available.
- The WASM worker now performs deterministic local compute tasks such as grep, tokenize, embed, and transcode.
- The reMarkable bundle was refreshed after the bridge/executor changes, so the remote artifact matches the current ticket state.

### What didn't work
- A local TypeScript compiler was not available in the environment:

  ```text
  # from: which tsc || true
  (no output)
  ```

- Because of that, I could not run a full TS compile check on the frontend files in this session.

### What I learned
- The browser bridge is easiest to reason about when it is attachable and request/response based rather than hidden inside the tool router.
- A small `runWorkerTask` helper removes a lot of repetitive worker plumbing.
- It is useful to keep the OPFS and compute executors separate even if the worker code is still relatively small.

### What was tricky to build
- The main sharp edge was preserving the clean backend/browser split while still making the browser side realistic enough to test.
- Another tricky point was keeping the worker code browser-friendly without assuming a bundler/runtime beyond standard module workers.
- The bridge needed careful correlation handling so pending requests are cleaned up on completion or timeout.

### What warrants a second pair of eyes
- Confirm that the in-memory browser bridge is the right intermediate step before introducing a real websocket transport.
- Review the OPFS worker path handling and write path creation semantics.
- Review the worker helper and executor wiring to make sure the browser build tooling will accept `new URL(..., import.meta.url)` module-worker imports.

### What should be done in the future
- Replace the in-memory browser bridge with the real websocket/browser transport.
- Add a frontend build/test pass once the repo has a TypeScript toolchain.
- Extend the worker-backed executors with richer local file and parsing operations as needed.

### Code review instructions
- Start in `backend/internal/chat/browserbridge.go` and `backend/internal/chat/browserbridge_test.go`.
- Then review `frontend/src/tool-broker/worker-client.ts`, `frontend/src/tool-broker/opfs-executors.ts`, and `frontend/src/tool-broker/wasm-executors.ts`.
- Finally inspect `frontend/src/workers/opfs.worker.ts` and `frontend/src/workers/wasm.worker.ts` to confirm the worker contracts match the registry.
- Validate with `go test ./...`.

### Technical details
- Browser bridge API: `Connect`, `PublishCapabilities`, `SubmitResult`, `Disconnect`, `Call`
- Worker helper: `runWorkerTask(workerUrl, request, timeoutMs)`
- OPFS task handlers: `list_dir`, `read_text`, `write_text`
- WASM task handlers: `grep`, `tokenize`, `embed`, `transcode`
- Validation command: `gofmt -w backend/cmd/chatd/main.go backend/internal/chat/*.go && go test ./...`
