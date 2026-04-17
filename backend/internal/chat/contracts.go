package chat

import (
	"encoding/json"
	"fmt"
	"sort"
	"time"
)

type ToolExecution string

const (
	ToolExecutionServer ToolExecution = "server"
	ToolExecutionClient ToolExecution = "client"
)

type ToolVisibility string

const (
	ToolVisibilityLocalOnly    ToolVisibility = "local_only"
	ToolVisibilityModelVisible ToolVisibility = "model_visible"
	ToolVisibilityUserVisible  ToolVisibility = "user_visible_only"
)

type ToolManifest struct {
	Name                 string          `json:"name"`
	Description          string          `json:"description"`
	Execution            ToolExecution   `json:"execution"`
	Visibility           ToolVisibility  `json:"visibility"`
	Capability           string          `json:"capability,omitempty"`
	InputSchema          json.RawMessage `json:"input_schema,omitempty"`
	OutputSchema         json.RawMessage `json:"output_schema,omitempty"`
	RequiresConfirmation bool            `json:"requires_confirmation,omitempty"`
}

type SessionCapabilities struct {
	OPFS              bool     `json:"opfs"`
	WASMWorker        bool     `json:"wasm_worker"`
	FilePicker        bool     `json:"file_picker"`
	MaxLocalReadBytes int      `json:"max_local_read_bytes"`
	SupportedTools    []string `json:"supported_tools"`
}

type SessionCapabilitiesEnvelope struct {
	Type         string              `json:"type"`
	Capabilities SessionCapabilities `json:"capabilities"`
}

type ToolRequestEnvelope struct {
	ID   string          `json:"id"`
	Type string          `json:"type"`
	Tool string          `json:"tool"`
	Args json.RawMessage `json:"args"`
}

type ToolError struct {
	Code    string `json:"code"`
	Message string `json:"message"`
}

type ToolResultEnvelope struct {
	ID     string         `json:"id"`
	Type   string         `json:"type"`
	OK     bool           `json:"ok"`
	Output any            `json:"output,omitempty"`
	Error  *ToolError     `json:"error,omitempty"`
	Meta   map[string]any `json:"meta,omitempty"`
}

type ConversationRole string

const (
	RoleUser      ConversationRole = "user"
	RoleAssistant ConversationRole = "assistant"
	RoleTool      ConversationRole = "tool"
)

type MockToolCall struct {
	ID   string          `json:"id"`
	Tool string          `json:"tool"`
	Args json.RawMessage `json:"args"`
}

type ConversationMessage struct {
	Role       ConversationRole    `json:"role"`
	Content    string              `json:"content,omitempty"`
	ToolCall   *MockToolCall       `json:"tool_call,omitempty"`
	ToolName   string              `json:"tool_name,omitempty"`
	ToolCallID string              `json:"tool_call_id,omitempty"`
	ToolResult *ToolResultEnvelope `json:"tool_result,omitempty"`
	CreatedAt  time.Time           `json:"created_at"`
}

type SessionSnapshot struct {
	ID           string                `json:"id"`
	Messages     []ConversationMessage `json:"messages"`
	Tools        []ToolManifest        `json:"tools"`
	Capabilities SessionCapabilities   `json:"capabilities"`
}

type MockModelRequest struct {
	SessionID    string                `json:"session_id"`
	Messages     []ConversationMessage `json:"messages"`
	Tools        []ToolManifest        `json:"tools"`
	Capabilities SessionCapabilities   `json:"capabilities"`
}

type MockModelResponseKind string

const (
	MockResponseAssistantText MockModelResponseKind = "assistant_text"
	MockResponseToolCall      MockModelResponseKind = "tool_call"
)

type MockModelResponse struct {
	Kind     MockModelResponseKind `json:"kind"`
	Text     string                `json:"text,omitempty"`
	ToolCall *MockToolCall         `json:"tool_call,omitempty"`
}

type TurnResponse struct {
	Session        SessionSnapshot     `json:"session"`
	AssistantText  string              `json:"assistant_text,omitempty"`
	LastToolResult *ToolResultEnvelope `json:"last_tool_result,omitempty"`
}

func MustRawJSON(input string) json.RawMessage {
	return json.RawMessage([]byte(input))
}

func CopyAndSortTools(tools map[string]ToolManifest) []ToolManifest {
	out := make([]ToolManifest, 0, len(tools))
	for _, tool := range tools {
		out = append(out, tool)
	}
	sort.Slice(out, func(i, j int) bool {
		return out[i].Name < out[j].Name
	})
	return out
}

func (m MockModelResponse) String() string {
	switch m.Kind {
	case MockResponseAssistantText:
		return fmt.Sprintf("assistant_text(%q)", m.Text)
	case MockResponseToolCall:
		if m.ToolCall == nil {
			return "tool_call(<nil>)"
		}
		return fmt.Sprintf("tool_call(%s:%s)", m.ToolCall.Tool, m.ToolCall.ID)
	default:
		return string(m.Kind)
	}
}
