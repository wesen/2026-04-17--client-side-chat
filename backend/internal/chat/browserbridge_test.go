package chat

import (
	"context"
	"encoding/json"
	"strings"
	"testing"
	"time"
)

func TestBrowserBridgeCallRequiresConnection(t *testing.T) {
	t.Parallel()

	bridge := NewBrowserBridge()
	result, err := bridge.Call(context.Background(), "sess_1", ToolManifest{Name: "opfs.read_text", Execution: ToolExecutionClient}, "call_1", MustRawJSON(`{"path":"/notes/today.md"}`))
	if err == nil || !strings.Contains(err.Error(), "browser client is connected") {
		t.Fatalf("expected browser unavailable error, got %v", err)
	}
	if result.OK {
		t.Fatalf("expected failure result, got ok=true")
	}
	if result.Error == nil || result.Error.Code != "CLIENT_UNAVAILABLE" {
		t.Fatalf("unexpected result error: %#v", result.Error)
	}
}

func TestBrowserBridgeRoundTrip(t *testing.T) {
	t.Parallel()

	bridge := NewBrowserBridge()
	conn := bridge.Connect("sess_2")

	go func() {
		request := <-conn.Requests
		if request.Tool != "opfs.write_text" {
			t.Errorf("tool = %s, want opfs.write_text", request.Tool)
			return
		}
		args := make(map[string]any)
		if err := json.Unmarshal(request.Args, &args); err != nil {
			t.Errorf("json.Unmarshal() error = %v", err)
			return
		}
		if args["path"] != "/notes/output.md" {
			t.Errorf("path = %#v, want /notes/output.md", args["path"])
			return
		}
		if err := conn.SubmitResult(ToolResultEnvelope{
			ID:   request.ID,
			Type: "tool.result",
			OK:   true,
			Output: map[string]any{
				"path":          "/notes/output.md",
				"bytes_written": 31,
			},
		}); err != nil {
			t.Errorf("SubmitResult() error = %v", err)
		}
	}()

	ctx, cancel := context.WithTimeout(context.Background(), time.Second)
	defer cancel()

	result, err := bridge.Call(ctx, "sess_2", ToolManifest{Name: "opfs.write_text", Execution: ToolExecutionClient}, "call_2", MustRawJSON(`{"path":"/notes/output.md","text":"hello"}`))
	if err != nil {
		t.Fatalf("Call() error = %v", err)
	}
	if !result.OK {
		t.Fatalf("expected ok result, got %#v", result)
	}
}
