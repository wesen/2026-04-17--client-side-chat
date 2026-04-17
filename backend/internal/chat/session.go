package chat

import (
	"fmt"
	"sync"
	"time"
)

type Store struct {
	mu       sync.RWMutex
	nextID   int
	sessions map[string]*Session
}

func NewStore() *Store {
	return &Store{sessions: make(map[string]*Session)}
}

func (s *Store) Create() *Session {
	s.mu.Lock()
	defer s.mu.Unlock()

	s.nextID++
	sessionID := fmt.Sprintf("sess_%04d", s.nextID)
	session := NewSession(sessionID)
	s.sessions[sessionID] = session
	return session
}

func (s *Store) Get(id string) (*Session, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	session, ok := s.sessions[id]
	return session, ok
}

type Session struct {
	mu           sync.RWMutex
	ID           string
	Messages     []ConversationMessage
	tools        map[string]ToolManifest
	Capabilities SessionCapabilities
	Pending      map[string]ToolRequestEnvelope
}

func NewSession(id string) *Session {
	return &Session{
		ID:      id,
		tools:   make(map[string]ToolManifest),
		Pending: make(map[string]ToolRequestEnvelope),
	}
}

func (s *Session) SetCapabilities(capabilities SessionCapabilities) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.Capabilities = capabilities
}

func (s *Session) UpsertTool(tool ToolManifest) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.tools[tool.Name] = tool
}

func (s *Session) LookupTool(name string) (ToolManifest, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	tool, ok := s.tools[name]
	return tool, ok
}

func (s *Session) Snapshot() SessionSnapshot {
	s.mu.RLock()
	defer s.mu.RUnlock()

	messages := make([]ConversationMessage, len(s.Messages))
	copy(messages, s.Messages)

	return SessionSnapshot{
		ID:           s.ID,
		Messages:     messages,
		Tools:        CopyAndSortTools(s.tools),
		Capabilities: s.Capabilities,
	}
}

func (s *Session) AppendUserMessage(content string) ConversationMessage {
	msg := ConversationMessage{
		Role:      RoleUser,
		Content:   content,
		CreatedAt: time.Now().UTC(),
	}

	s.mu.Lock()
	defer s.mu.Unlock()
	s.Messages = append(s.Messages, msg)
	return msg
}

func (s *Session) AppendAssistantMessage(content string) ConversationMessage {
	msg := ConversationMessage{
		Role:      RoleAssistant,
		Content:   content,
		CreatedAt: time.Now().UTC(),
	}

	s.mu.Lock()
	defer s.mu.Unlock()
	s.Messages = append(s.Messages, msg)
	return msg
}

func (s *Session) AppendToolCall(call MockToolCall) ConversationMessage {
	msg := ConversationMessage{
		Role:      RoleAssistant,
		ToolCall:  &call,
		CreatedAt: time.Now().UTC(),
	}

	s.mu.Lock()
	defer s.mu.Unlock()
	s.Messages = append(s.Messages, msg)
	s.Pending[call.ID] = ToolRequestEnvelope{ID: call.ID, Type: "tool.request", Tool: call.Tool, Args: call.Args}
	return msg
}

func (s *Session) AppendToolResult(toolName string, result ToolResultEnvelope) ConversationMessage {
	msg := ConversationMessage{
		Role:       RoleTool,
		ToolName:   toolName,
		ToolCallID: result.ID,
		ToolResult: &result,
		CreatedAt:  time.Now().UTC(),
	}

	s.mu.Lock()
	defer s.mu.Unlock()
	s.Messages = append(s.Messages, msg)
	delete(s.Pending, result.ID)
	return msg
}
