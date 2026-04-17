package chat

import (
	"context"
	"encoding/json"
	"fmt"
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
