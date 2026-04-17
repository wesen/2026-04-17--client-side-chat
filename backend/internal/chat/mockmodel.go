package chat

import (
	"encoding/json"
	"fmt"
	"regexp"
	"strings"
	"sync/atomic"
)

type MockModel struct{}

var mockCallCounter atomic.Uint64

func NewMockModel() MockModel {
	return MockModel{}
}

func (MockModel) Generate(req MockModelRequest) MockModelResponse {
	if len(req.Messages) == 0 {
		return MockModelResponse{
			Kind: MockResponseAssistantText,
			Text: "Send a message and I will choose a mock tool call.",
		}
	}

	last := req.Messages[len(req.Messages)-1]
	switch last.Role {
	case RoleUser:
		return planFromUserPrompt(last.Content, req.Tools)
	case RoleTool:
		return summarizeToolResult(last)
	default:
		return MockModelResponse{
			Kind: MockResponseAssistantText,
			Text: "I am waiting for a user message or tool result.",
		}
	}
}

func planFromUserPrompt(prompt string, tools []ToolManifest) MockModelResponse {
	lower := strings.ToLower(prompt)

	if strings.Contains(lower, "summarize conversation") || strings.Contains(lower, "summarize the conversation") {
		if toolAvailable(tools, "conversation.summarize") {
			return MockModelResponse{
				Kind: MockResponseToolCall,
				ToolCall: &MockToolCall{
					ID:   nextCallID("summarize"),
					Tool: "conversation.summarize",
					Args: MustRawJSON(`{"scope":"conversation"}`),
				},
			}
		}
	}

	if strings.Contains(lower, "todo") || strings.Contains(lower, "search") {
		if toolAvailable(tools, "wasm.run_task") {
			return MockModelResponse{
				Kind: MockResponseToolCall,
				ToolCall: &MockToolCall{
					ID:   nextCallID("grep"),
					Tool: "wasm.run_task",
					Args: MustRawJSON(`{"task":"grep","args":{"root":"/project","query":"TODO"},"timeout_ms":5000}`),
				},
			}
		}
	}

	if strings.Contains(lower, "read") {
		if toolAvailable(tools, "opfs.read_text") {
			path := extractPath(prompt)
			if path == "" {
				path = "/notes/today.md"
			}
			args, _ := json.Marshal(map[string]any{
				"path":      path,
				"max_bytes": 200000,
			})
			return MockModelResponse{
				Kind: MockResponseToolCall,
				ToolCall: &MockToolCall{
					ID:   nextCallID("read"),
					Tool: "opfs.read_text",
					Args: args,
				},
			}
		}
	}

	if strings.Contains(lower, "save") || strings.Contains(lower, "write") || strings.Contains(lower, "transform") {
		if toolAvailable(tools, "opfs.write_text") {
			args, _ := json.Marshal(map[string]any{
				"path": "/notes/output.md",
				"text": "mock transformed content",
			})
			return MockModelResponse{
				Kind: MockResponseToolCall,
				ToolCall: &MockToolCall{
					ID:   nextCallID("write"),
					Tool: "opfs.write_text",
					Args: args,
				},
			}
		}
	}

	return MockModelResponse{
		Kind: MockResponseAssistantText,
		Text: "No mock tool was needed for that request.",
	}
}

func summarizeToolResult(msg ConversationMessage) MockModelResponse {
	if msg.ToolResult == nil {
		return MockModelResponse{
			Kind: MockResponseAssistantText,
			Text: "Tool execution completed, but no structured result was attached.",
		}
	}

	if !msg.ToolResult.OK {
		message := "unknown tool error"
		if msg.ToolResult.Error != nil {
			message = fmt.Sprintf("%s: %s", msg.ToolResult.Error.Code, msg.ToolResult.Error.Message)
		}
		return MockModelResponse{
			Kind: MockResponseAssistantText,
			Text: fmt.Sprintf("The tool %s failed (%s).", msg.ToolName, message),
		}
	}

	switch output := msg.ToolResult.Output.(type) {
	case map[string]any:
		if summary, ok := output["summary"].(string); ok && summary != "" {
			return MockModelResponse{
				Kind: MockResponseAssistantText,
				Text: fmt.Sprintf("Tool %s completed successfully: %s", msg.ToolName, summary),
			}
		}
		if text, ok := output["text"].(string); ok && text != "" {
			return MockModelResponse{
				Kind: MockResponseAssistantText,
				Text: fmt.Sprintf("Tool %s returned text: %s", msg.ToolName, trimText(text, 120)),
			}
		}
	}

	return MockModelResponse{
		Kind: MockResponseAssistantText,
		Text: fmt.Sprintf("Tool %s completed successfully.", msg.ToolName),
	}
}

func toolAvailable(tools []ToolManifest, name string) bool {
	for _, tool := range tools {
		if tool.Name == name {
			return true
		}
	}
	return false
}

var pathPattern = regexp.MustCompile(`([A-Za-z0-9_./-]+\.(?:md|txt|log|json|csv))`)

func extractPath(prompt string) string {
	match := pathPattern.FindStringSubmatch(prompt)
	if len(match) < 2 {
		return ""
	}
	return match[1]
}

func trimText(text string, max int) string {
	text = strings.TrimSpace(text)
	if len(text) <= max {
		return text
	}
	return text[:max] + "…"
}

func nextCallID(prefix string) string {
	seq := mockCallCounter.Add(1)
	return fmt.Sprintf("call_%s_%d", prefix, seq)
}
