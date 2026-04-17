---
Title: Client-side tool broker API reference
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
    - Path: ttmp/2026/04/17/CCS-0001--client-side-tool-broker-for-chat/design-doc/01-client-side-tool-broker-design-and-implementation-guide.md
      Note: Primary architecture and implementation rationale for the API contract
    - Path: ttmp/2026/04/17/CCS-0001--client-side-tool-broker-for-chat/reference/02-diary.md
      Note: Chronological notes about how the contract was drafted
ExternalSources:
    - https://developers.openai.com/api/docs/guides/function-calling
    - https://developer.mozilla.org/en-US/docs/Web/API/File_System_API/Origin_private_file_system
    - https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Using_web_workers
    - https://developer.mozilla.org/en-US/docs/Web/API/Window/postMessage
Summary: Copy/paste-ready transport envelopes, tool manifest shape, and example RPC contracts for the browser-routed chat tool broker.
LastUpdated: 2026-04-17T08:59:26.592712615-04:00
WhatFor: ""
WhenToUse: ""
---


# Client-side tool broker API reference

## Goal

This document is the quick-reference companion to the main design guide. It captures the canonical shapes for tool manifests, request/result envelopes, and the minimal backend/frontend message flow needed for the proof of concept.

## Context

Use this reference when you are implementing or reviewing the routed tool protocol. The overall architecture is simple:

- Go backend owns conversation state and the model loop
- browser owns local capabilities such as OPFS and WASM
- the backend decides whether a tool executes in Go or in the browser
- the browser returns structured results over the session channel

The POC uses a mocked LLM adapter, so the shapes below are the contracts that matter most.

## Quick Reference

### 1) Tool categories

| Class | Execution | Visibility | Examples |
| --- | --- | --- | --- |
| Server tool | `server` | usually `model_visible` | `kb.search`, `conversation.summarize` |
| Client tool | `client` | `local_only` or `model_visible` | `opfs.read_text`, `opfs.write_text`, `wasm.run_task` |
| Hybrid tool | mixed | depends on step | `index_local_project`, `summarize_local_pdf` |

### 2) Canonical tool manifest

```json
{
  "name": "opfs.read_text",
  "description": "Read a UTF-8 text file from the origin-private file system.",
  "execution": "client",
  "visibility": "model_visible",
  "capability": "opfs",
  "input_schema": {
    "type": "object",
    "properties": {
      "path": { "type": "string" },
      "max_bytes": { "type": "integer", "minimum": 1, "maximum": 1048576 }
    },
    "required": ["path"]
  },
  "output_schema": {
    "type": "object",
    "properties": {
      "path": { "type": "string" },
      "text": { "type": "string" },
      "truncated": { "type": "boolean" }
    },
    "required": ["path", "text", "truncated"]
  }
}
```

```json
{
  "name": "wasm.run_task",
  "description": "Run a named local WASM task in a dedicated worker.",
  "execution": "client",
  "visibility": "local_only",
  "capability": "wasm_worker",
  "input_schema": {
    "type": "object",
    "properties": {
      "task": { "type": "string", "enum": ["grep", "tokenize", "embed", "transcode"] },
      "args": { "type": "object" },
      "timeout_ms": { "type": "integer", "maximum": 30000 }
    },
    "required": ["task", "args"]
  }
}
```

### 3) Session capability snapshot

Send this after the browser connects.

```json
{
  "type": "session.capabilities",
  "capabilities": {
    "opfs": true,
    "wasm_worker": true,
    "file_picker": true,
    "max_local_read_bytes": 1048576,
    "supported_tools": [
      "opfs.list_dir",
      "opfs.read_text",
      "opfs.write_text",
      "wasm.run_task"
    ]
  }
}
```

### 4) Tool request envelope

```json
{
  "id": "call_123",
  "type": "tool.request",
  "tool": "opfs.read_text",
  "args": {
    "path": "/projects/a.txt",
    "max_bytes": 200000
  }
}
```

### 5) Tool result envelope

```json
{
  "id": "call_123",
  "type": "tool.result",
  "ok": true,
  "output": {
    "path": "/projects/a.txt",
    "text": "...",
    "truncated": false
  },
  "meta": {
    "duration_ms": 42,
    "bytes_read": 18231
  }
}
```

### 6) Tool error envelope

```json
{
  "id": "call_123",
  "type": "tool.result",
  "ok": false,
  "error": {
    "code": "CLIENT_UNAVAILABLE",
    "message": "No active browser client is connected for local tool execution."
  }
}
```

### 7) Minimal backend routing pseudocode

```go
func routeTool(ctx context.Context, sessionID string, tool ToolManifest, args json.RawMessage) (ToolResult, error) {
    switch tool.Execution {
    case "server":
        return serverRunner.Run(ctx, tool, args)
    case "client":
        return clientBridge.Call(ctx, sessionID, tool, args)
    default:
        return ToolResult{}, fmt.Errorf("unsupported execution mode %q", tool.Execution)
    }
}
```

### 8) Minimal frontend broker pseudocode

```ts
async function handleToolRequest(msg: ToolRequestEnvelope) {
  const tool = registry.get(msg.tool)
  if (!tool) {
    return sendResult({ id: msg.id, ok: false, error: { code: "UNKNOWN_TOOL", message: msg.tool } })
  }

  try {
    const output = await tool.execute(msg.args)
    return sendResult({ id: msg.id, ok: true, output, meta: { duration_ms: performance.now() } })
  } catch (error) {
    return sendResult({ id: msg.id, ok: false, error: normalize(error) })
  }
}
```

### 9) Suggested error codes

| Code | Meaning | Typical recovery |
| --- | --- | --- |
| `CLIENT_UNAVAILABLE` | No browser session is attached | Ask the user to reconnect the tab |
| `UNKNOWN_TOOL` | Backend or frontend does not know the tool name | Fix manifest mismatch |
| `INVALID_ARGUMENT` | Schema validation failed | Rebuild args from manifest |
| `TIMEOUT` | Tool exceeded its deadline | Retry with smaller input |
| `PERMISSION_DENIED` | Browser refused the action | Ask the user to approve or choose another tool |

## Usage Examples

### Example 1: Read a local file and answer questions about it

1. User asks: “Read `notes/today.md` and summarize the action items.”
2. Backend mock model emits `opfs.read_text`.
3. Backend sends `tool.request` to the browser.
4. Browser reads the file from OPFS.
5. Browser returns `tool.result` with the text.
6. Backend appends the result to the session and generates the final answer.

### Example 2: Search a project locally with WASM

1. User asks: “Find all TODOs in my local project.”
2. Backend mock model emits `wasm.run_task` with `task=grep`.
3. Browser worker scans local files.
4. Browser returns a compact result set of file paths and matches.
5. Backend feeds the result to the mock model for the final summary.

### Example 3: Save a transformed file locally

1. User asks: “Normalize these notes and save them back to OPFS.”
2. Browser executes local parsing or transformation in a worker.
3. Browser writes the output with `opfs.write_text`.
4. Backend sees only a structured success response unless the tool is marked `model_visible`.

## Related

- [Client-side tool broker design and implementation guide](../design-doc/01-client-side-tool-broker-design-and-implementation-guide.md)
- [Diary](./02-diary.md)
- OpenAI tool calling guide: https://developers.openai.com/api/docs/guides/function-calling
- MDN Origin private file system: https://developer.mozilla.org/en-US/docs/Web/API/File_System_API/Origin_private_file_system
- MDN Web Workers guide: https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Using_web_workers
- MDN `postMessage`: https://developer.mozilla.org/en-US/docs/Web/API/Window/postMessage
