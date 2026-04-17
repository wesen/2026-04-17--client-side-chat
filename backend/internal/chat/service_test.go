package chat

import (
	"context"
	"encoding/json"
	"strings"
	"testing"
	"time"
)

type recordingServerRunner struct {
	calls []serverCall
}

type serverCall struct {
	toolName string
	callID   string
	args     map[string]any
}

func (r *recordingServerRunner) Run(_ context.Context, tool ToolManifest, callID string, args json.RawMessage) (ToolResultEnvelope, error) {
	r.calls = append(r.calls, serverCall{
		toolName: tool.Name,
		callID:   callID,
		args:     decodeArgs(args),
	})
	return ToolResultEnvelope{
		ID:   callID,
		Type: "tool.result",
		OK:   true,
		Output: map[string]any{
			"summary": "Short mock conversation summary.",
		},
	}, nil
}

func TestHandleUserMessageRoutesClientToolThroughBrowserBridge(t *testing.T) {
	t.Parallel()

	browser := NewBrowserBridge()
	svc := NewService(NewRouter(&recordingServerRunner{}, browser))
	session := svc.CreateSession()
	conn := browser.Connect(session.ID)

	done := make(chan struct{})
	go func() {
		defer close(done)
		select {
		case req := <-conn.Requests:
			if req.Tool != "wasm.run_task" {
				t.Errorf("tool = %s, want wasm.run_task", req.Tool)
				return
			}
			if got := decodeArgs(req.Args)["task"]; got != "grep" {
				t.Errorf("task = %#v, want grep", got)
				return
			}
			if err := conn.SubmitResult(ToolResultEnvelope{
				ID:   req.ID,
				Type: "tool.result",
				OK:   true,
				Output: map[string]any{
					"summary": "Found 2 TODO matches in the mock project.",
				},
				Meta: map[string]any{"tool": req.Tool},
			}); err != nil {
				t.Errorf("SubmitResult() error = %v", err)
			}
		case <-time.After(2 * time.Second):
			t.Errorf("timed out waiting for browser request")
		}
	}()

	turn, err := svc.HandleUserMessage(context.Background(), session.ID, "Search my local project for TODOs.")
	if err != nil {
		t.Fatalf("HandleUserMessage() error = %v", err)
	}
	<-done

	if !strings.Contains(turn.AssistantText, "Found 2 TODO matches") {
		t.Fatalf("assistant text = %q, want TODO summary", turn.AssistantText)
	}
}

func TestHandleUserMessageRoutesServerTool(t *testing.T) {
	t.Parallel()

	browser := NewBrowserBridge()
	server := &recordingServerRunner{}
	svc := NewService(NewRouter(server, browser))
	session := svc.CreateSession()

	turn, err := svc.HandleUserMessage(context.Background(), session.ID, "Summarize the conversation.")
	if err != nil {
		t.Fatalf("HandleUserMessage() error = %v", err)
	}

	if got := len(server.calls); got != 1 {
		t.Fatalf("expected 1 server call, got %d", got)
	}
	if got := server.calls[0].toolName; got != "conversation.summarize" {
		t.Fatalf("expected conversation.summarize, got %s", got)
	}
	if !strings.Contains(turn.AssistantText, "Short mock conversation summary") {
		t.Fatalf("assistant text = %q, want conversation summary", turn.AssistantText)
	}
}

func TestClientToolFailsWhenBrowserIsDisconnected(t *testing.T) {
	t.Parallel()

	browser := NewBrowserBridge()
	svc := NewService(NewRouter(&recordingServerRunner{}, browser))
	session := svc.CreateSession()

	_, err := svc.HandleUserMessage(context.Background(), session.ID, "Search my local project for TODOs.")
	if err == nil || !strings.Contains(err.Error(), "browser client is connected") {
		t.Fatalf("expected browser unavailable error, got %v", err)
	}
}
