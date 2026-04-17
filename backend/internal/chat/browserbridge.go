package chat

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"sync"
)

type BrowserBridge struct {
	mu       sync.Mutex
	sessions map[string]*browserSession
}

type browserSession struct {
	connected    bool
	capabilities SessionCapabilities
	requests     chan ToolRequestEnvelope
	responses    map[string]chan ToolResultEnvelope
}

type BrowserConnection struct {
	bridge    *BrowserBridge
	sessionID string
	Requests  <-chan ToolRequestEnvelope
}

func NewBrowserBridge() *BrowserBridge {
	return &BrowserBridge{sessions: make(map[string]*browserSession)}
}

func (b *BrowserBridge) Connect(sessionID string) *BrowserConnection {
	b.mu.Lock()
	defer b.mu.Unlock()

	session := b.ensureSessionLocked(sessionID)
	session.connected = true

	return &BrowserConnection{
		bridge:    b,
		sessionID: sessionID,
		Requests:  session.requests,
	}
}

func (c *BrowserConnection) PublishCapabilities(capabilities SessionCapabilities) error {
	return c.bridge.PublishCapabilities(c.sessionID, capabilities)
}

func (c *BrowserConnection) SubmitResult(result ToolResultEnvelope) error {
	return c.bridge.SubmitResult(c.sessionID, result)
}

func (c *BrowserConnection) Disconnect() {
	c.bridge.Disconnect(c.sessionID)
}

func (b *BrowserBridge) PublishCapabilities(sessionID string, capabilities SessionCapabilities) error {
	b.mu.Lock()
	defer b.mu.Unlock()

	session := b.ensureSessionLocked(sessionID)
	session.capabilities = capabilities
	return nil
}

func (b *BrowserBridge) Disconnect(sessionID string) {
	b.mu.Lock()
	session, ok := b.sessions[sessionID]
	if !ok {
		b.mu.Unlock()
		return
	}
	session.connected = false
	pending := session.responses
	session.responses = make(map[string]chan ToolResultEnvelope)
	b.mu.Unlock()

	for _, responseCh := range pending {
		close(responseCh)
	}
}

func (b *BrowserBridge) SessionCapabilities(sessionID string) (SessionCapabilities, bool) {
	b.mu.Lock()
	defer b.mu.Unlock()

	session, ok := b.sessions[sessionID]
	if !ok {
		return SessionCapabilities{}, false
	}
	return session.capabilities, true
}

func (b *BrowserBridge) Call(ctx context.Context, sessionID string, tool ToolManifest, callID string, args json.RawMessage) (ToolResultEnvelope, error) {
	request := ToolRequestEnvelope{
		ID:   callID,
		Type: "tool.request",
		Tool: tool.Name,
		Args: args,
	}

	b.mu.Lock()
	session, ok := b.sessions[sessionID]
	if !ok || !session.connected {
		b.mu.Unlock()
		return unavailableToolResult(callID, tool.Name), errors.New("no browser client is connected for this session")
	}
	resultCh := make(chan ToolResultEnvelope, 1)
	session.responses[callID] = resultCh
	requestCh := session.requests
	b.mu.Unlock()

	defer func() {
		b.mu.Lock()
		if sess, ok := b.sessions[sessionID]; ok {
			delete(sess.responses, callID)
		}
		b.mu.Unlock()
	}()

	select {
	case requestCh <- request:
	case <-ctx.Done():
		return timeoutToolResult(callID, tool.Name, ctx.Err())
	}

	select {
	case result, ok := <-resultCh:
		if !ok {
			return unavailableToolResult(callID, tool.Name), errors.New("browser session disconnected while awaiting a tool result")
		}
		return result, nil
	case <-ctx.Done():
		return timeoutToolResult(callID, tool.Name, ctx.Err())
	}
}

func (b *BrowserBridge) SubmitResult(sessionID string, result ToolResultEnvelope) error {
	b.mu.Lock()
	session, ok := b.sessions[sessionID]
	if !ok {
		b.mu.Unlock()
		return fmt.Errorf("unknown browser session %q", sessionID)
	}
	resultCh, ok := session.responses[result.ID]
	if !ok {
		b.mu.Unlock()
		return fmt.Errorf("no pending browser request with id %q", result.ID)
	}
	delete(session.responses, result.ID)
	b.mu.Unlock()

	select {
	case resultCh <- result:
		return nil
	default:
		return fmt.Errorf("browser response channel for %q is full", result.ID)
	}
}

func (b *BrowserBridge) ensureSessionLocked(sessionID string) *browserSession {
	session, ok := b.sessions[sessionID]
	if !ok {
		session = &browserSession{
			requests:  make(chan ToolRequestEnvelope, 16),
			responses: make(map[string]chan ToolResultEnvelope),
		}
		b.sessions[sessionID] = session
	}
	return session
}

func unavailableToolResult(callID, toolName string) ToolResultEnvelope {
	return ToolResultEnvelope{
		ID:   callID,
		Type: "tool.result",
		OK:   false,
		Error: &ToolError{
			Code:    "CLIENT_UNAVAILABLE",
			Message: fmt.Sprintf("No active browser client is connected for local tool %s.", toolName),
		},
		Meta: map[string]any{"tool": toolName},
	}
}

func timeoutToolResult(callID, toolName string, err error) (ToolResultEnvelope, error) {
	if err == nil {
		err = context.DeadlineExceeded
	}
	return ToolResultEnvelope{
		ID:   callID,
		Type: "tool.result",
		OK:   false,
		Error: &ToolError{
			Code:    "TIMEOUT",
			Message: fmt.Sprintf("Browser tool %s did not complete before the context deadline.", toolName),
		},
		Meta: map[string]any{"tool": toolName},
	}, err
}
