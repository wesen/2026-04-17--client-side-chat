package chat

import (
	"context"
	"encoding/json"
	"strings"
	"testing"
)

type recordingClientBridge struct {
	calls []clientCall
}

type clientCall struct {
	sessionID string
	toolName  string
	callID    string
	args      map[string]any
}

func (r *recordingClientBridge) Call(_ context.Context, sessionID string, tool ToolManifest, callID string, args json.RawMessage) (ToolResultEnvelope, error) {
	decoded := decodeArgs(args)
	r.calls = append(r.calls, clientCall{
		sessionID: sessionID,
		toolName:  tool.Name,
		callID:    callID,
		args:      decoded,
	})
	return ToolResultEnvelope{
		ID:   callID,
		Type: "tool.result",
		OK:   true,
		Output: map[string]any{
			"summary": "Found 2 TODO matches in the mock project.",
		},
	}, nil
}

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

func TestHandleUserMessageRoutesClientTool(t *testing.T) {
	t.Parallel()

	client := &recordingClientBridge{}
	svc := NewService(NewRouter(&recordingServerRunner{}, client))
	session := svc.CreateSession()

	turn, err := svc.HandleUserMessage(context.Background(), session.ID, "Search my local project for TODOs.")
	if err != nil {
		t.Fatalf("HandleUserMessage() error = %v", err)
	}

	if got := len(client.calls); got != 1 {
		t.Fatalf("expected 1 client call, got %d", got)
	}
	if got := client.calls[0].toolName; got != "wasm.run_task" {
		t.Fatalf("expected wasm.run_task, got %s", got)
	}
	if got := client.calls[0].args["task"]; got != "grep" {
		t.Fatalf("expected grep task, got %#v", got)
	}
	if !strings.Contains(turn.AssistantText, "Found 2 TODO matches") {
		t.Fatalf("assistant text = %q, want TODO summary", turn.AssistantText)
	}
}

func TestHandleUserMessageRoutesServerTool(t *testing.T) {
	t.Parallel()

	server := &recordingServerRunner{}
	svc := NewService(NewRouter(server, &recordingClientBridge{}))
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
