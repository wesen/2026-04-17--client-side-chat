package chat

import (
	"context"
	"encoding/json"
	"fmt"
	"time"
)

type MockServerRunner struct{}

func NewMockServerRunner() MockServerRunner { return MockServerRunner{} }

func (MockServerRunner) Run(_ context.Context, tool ToolManifest, callID string, args json.RawMessage) (ToolResultEnvelope, error) {
	decoded := decodeArgs(args)
	result := ToolResultEnvelope{
		ID:   callID,
		Type: "tool.result",
		OK:   true,
		Meta: map[string]any{"duration_ms": 1, "tool": tool.Name},
	}

	switch tool.Name {
	case "conversation.summarize":
		result.Output = map[string]any{
			"summary": "This is a mock summary of the conversation.",
		}
	default:
		result.OK = false
		result.Error = &ToolError{Code: "UNKNOWN_SERVER_TOOL", Message: tool.Name}
	}

	if !result.OK {
		return result, nil
	}
	if scope, ok := decoded["scope"].(string); ok && scope != "" {
		result.Output = map[string]any{
			"summary": fmt.Sprintf("Mock summary for %s scope.", scope),
		}
	}
	return result, nil
}

type LoopbackClientBridge struct{}

func NewLoopbackClientBridge() LoopbackClientBridge { return LoopbackClientBridge{} }

func (LoopbackClientBridge) Call(_ context.Context, _ string, tool ToolManifest, callID string, args json.RawMessage) (ToolResultEnvelope, error) {
	decoded := decodeArgs(args)
	result := ToolResultEnvelope{
		ID:   callID,
		Type: "tool.result",
		OK:   true,
		Meta: map[string]any{"duration_ms": 2, "tool": tool.Name},
	}

	switch tool.Name {
	case "opfs.list_dir":
		path, _ := decoded["path"].(string)
		if path == "" {
			path = "/"
		}
		result.Output = map[string]any{
			"path":      path,
			"entries":   []string{"notes/today.md", "projects/demo.txt", "tasks/todo.txt"},
			"truncated": false,
		}
	case "opfs.read_text":
		path, _ := decoded["path"].(string)
		if path == "" {
			path = "/notes/today.md"
		}
		result.Output = map[string]any{
			"path":      path,
			"text":      fmt.Sprintf("Mock OPFS contents for %s\n- TODO: validate tool routing\n- TODO: wire browser bridge", path),
			"truncated": false,
			"summary":   fmt.Sprintf("Read mock file %s successfully.", path),
		}
	case "opfs.write_text":
		path, _ := decoded["path"].(string)
		if path == "" {
			path = "/notes/output.md"
		}
		text, _ := decoded["text"].(string)
		result.Output = map[string]any{
			"path":          path,
			"bytes_written": len(text),
			"written":       true,
			"summary":       fmt.Sprintf("Wrote %d bytes to %s.", len(text), path),
		}
	case "wasm.run_task":
		task, _ := decoded["task"].(string)
		argsValue, _ := decoded["args"].(map[string]any)
		if task == "grep" {
			root, _ := argsValue["root"].(string)
			query, _ := argsValue["query"].(string)
			if root == "" {
				root = "/project"
			}
			if query == "" {
				query = "TODO"
			}
			result.Output = map[string]any{
				"task":    task,
				"matches": []map[string]any{{"path": root + "/notes.md", "line": 12, "text": query + ": add a browser tool broker"}},
				"summary": "Found 1 TODO match in the mock project.",
			}
		} else {
			result.Output = map[string]any{
				"task":    task,
				"summary": fmt.Sprintf("Completed mock WASM task %q.", task),
			}
		}
	case "conversation.summarize":
		result.Output = map[string]any{
			"summary": "Client-side tool routing is the focus of this conversation.",
		}
	default:
		result.OK = false
		result.Error = &ToolError{Code: "UNKNOWN_CLIENT_TOOL", Message: tool.Name}
	}

	if result.OK {
		result.Meta["completed_at"] = time.Now().UTC().Format(time.RFC3339)
	}
	return result, nil
}

func decodeArgs(args json.RawMessage) map[string]any {
	if len(args) == 0 {
		return map[string]any{}
	}
	decoded := make(map[string]any)
	if err := json.Unmarshal(args, &decoded); err != nil {
		return map[string]any{}
	}
	return decoded
}
