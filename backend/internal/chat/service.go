package chat

import (
	"context"
	"fmt"
	"strings"
)

type Service struct {
	store  *Store
	model  MockModel
	router Router
}

func NewService(router Router) *Service {
	return &Service{
		store:  NewStore(),
		model:  NewMockModel(),
		router: router,
	}
}

func (s *Service) CreateSession() SessionSnapshot {
	session := s.store.Create()
	seedSession(session)
	return session.Snapshot()
}

func (s *Service) Session(id string) (SessionSnapshot, bool) {
	session, ok := s.store.Get(id)
	if !ok {
		return SessionSnapshot{}, false
	}
	return session.Snapshot(), true
}

func (s *Service) HandleUserMessage(ctx context.Context, sessionID, content string) (TurnResponse, error) {
	session, ok := s.store.Get(sessionID)
	if !ok {
		return TurnResponse{}, fmt.Errorf("unknown session %q", sessionID)
	}

	session.AppendUserMessage(content)
	return s.runTurn(ctx, session)
}

func (s *Service) HandleToolResult(ctx context.Context, sessionID string, result ToolResultEnvelope) (TurnResponse, error) {
	session, ok := s.store.Get(sessionID)
	if !ok {
		return TurnResponse{}, fmt.Errorf("unknown session %q", sessionID)
	}

	toolName := "browser.tool"
	if result.Meta != nil {
		if metaTool, ok := result.Meta["tool"].(string); ok && metaTool != "" {
			toolName = metaTool
		}
	}
	session.AppendToolResult(toolName, result)
	return s.runTurn(ctx, session)
}

func (s *Service) runTurn(ctx context.Context, session *Session) (TurnResponse, error) {
	for step := 0; step < 8; step++ {
		snapshot := session.Snapshot()
		response := s.model.Generate(MockModelRequest{
			SessionID:    snapshot.ID,
			Messages:     snapshot.Messages,
			Tools:        snapshot.Tools,
			Capabilities: snapshot.Capabilities,
		})

		switch response.Kind {
		case MockResponseAssistantText:
			assistant := session.AppendAssistantMessage(response.Text)
			return TurnResponse{
				Session:       session.Snapshot(),
				AssistantText: assistant.Content,
			}, nil
		case MockResponseToolCall:
			if response.ToolCall == nil {
				return TurnResponse{}, fmt.Errorf("mock model returned an empty tool call")
			}

			tool, ok := session.LookupTool(response.ToolCall.Tool)
			if !ok {
				return TurnResponse{}, fmt.Errorf("tool %q is not registered for session %s", response.ToolCall.Tool, session.ID)
			}

			session.AppendToolCall(*response.ToolCall)
			result, err := s.router.RouteTool(ctx, session.ID, tool, response.ToolCall.ID, response.ToolCall.Args)
			if err != nil {
				return TurnResponse{}, err
			}
			session.AppendToolResult(tool.Name, result)
			continue
		default:
			return TurnResponse{}, fmt.Errorf("unknown mock response kind %q", response.Kind)
		}
	}

	return TurnResponse{}, fmt.Errorf("mock model exceeded the maximum turn depth")
}

func seedSession(session *Session) {
	session.SetCapabilities(SessionCapabilities{
		OPFS:              true,
		WASMWorker:        true,
		FilePicker:        true,
		MaxLocalReadBytes: 1048576,
		SupportedTools: []string{
			"conversation.summarize",
			"opfs.list_dir",
			"opfs.read_text",
			"opfs.write_text",
			"wasm.run_task",
		},
	})

	for _, tool := range DefaultToolManifests() {
		session.UpsertTool(tool)
	}
}

func DefaultToolManifests() []ToolManifest {
	return []ToolManifest{
		{
			Name:         "conversation.summarize",
			Description:  "Summarize the current conversation for the user.",
			Execution:    ToolExecutionServer,
			Visibility:   ToolVisibilityModelVisible,
			InputSchema:  MustRawJSON(`{"type":"object","properties":{"scope":{"type":"string"}},"required":["scope"]}`),
			OutputSchema: MustRawJSON(`{"type":"object","properties":{"summary":{"type":"string"}},"required":["summary"]}`),
		},
		{
			Name:         "opfs.list_dir",
			Description:  "List a directory in the origin-private file system.",
			Execution:    ToolExecutionClient,
			Visibility:   ToolVisibilityModelVisible,
			Capability:   "opfs",
			InputSchema:  MustRawJSON(`{"type":"object","properties":{"path":{"type":"string"}},"required":["path"]}`),
			OutputSchema: MustRawJSON(`{"type":"object","properties":{"path":{"type":"string"},"entries":{"type":"array","items":{"type":"string"}},"truncated":{"type":"boolean"}},"required":["path","entries","truncated"]}`),
		},
		{
			Name:         "opfs.read_text",
			Description:  "Read a UTF-8 text file from the origin-private file system.",
			Execution:    ToolExecutionClient,
			Visibility:   ToolVisibilityModelVisible,
			Capability:   "opfs",
			InputSchema:  MustRawJSON(`{"type":"object","properties":{"path":{"type":"string"},"max_bytes":{"type":"integer"}},"required":["path"]}`),
			OutputSchema: MustRawJSON(`{"type":"object","properties":{"path":{"type":"string"},"text":{"type":"string"},"truncated":{"type":"boolean"}},"required":["path","text","truncated"]}`),
		},
		{
			Name:         "opfs.write_text",
			Description:  "Write a UTF-8 text file into the origin-private file system.",
			Execution:    ToolExecutionClient,
			Visibility:   ToolVisibilityLocalOnly,
			Capability:   "opfs",
			InputSchema:  MustRawJSON(`{"type":"object","properties":{"path":{"type":"string"},"text":{"type":"string"}},"required":["path","text"]}`),
			OutputSchema: MustRawJSON(`{"type":"object","properties":{"path":{"type":"string"},"bytes_written":{"type":"integer"}},"required":["path","bytes_written"]}`),
		},
		{
			Name:         "wasm.run_task",
			Description:  "Run a named local WASM task in a dedicated worker.",
			Execution:    ToolExecutionClient,
			Visibility:   ToolVisibilityLocalOnly,
			Capability:   "wasm_worker",
			InputSchema:  MustRawJSON(`{"type":"object","properties":{"task":{"type":"string"},"args":{"type":"object"},"timeout_ms":{"type":"integer"}},"required":["task","args"]}`),
			OutputSchema: MustRawJSON(`{"type":"object","properties":{"summary":{"type":"string"}},"required":["summary"]}`),
		},
	}
}

func (s TurnResponse) String() string {
	parts := []string{fmt.Sprintf("session=%s", s.Session.ID)}
	if s.AssistantText != "" {
		parts = append(parts, fmt.Sprintf("assistant=%q", s.AssistantText))
	}
	if s.LastToolResult != nil {
		parts = append(parts, fmt.Sprintf("tool_ok=%t", s.LastToolResult.OK))
	}
	return strings.Join(parts, " ")
}
