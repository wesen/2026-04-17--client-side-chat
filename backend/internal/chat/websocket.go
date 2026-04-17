package chat

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"

	"nhooyr.io/websocket"
)

func (h *HTTPServer) handleBrowserWebSocket(w http.ResponseWriter, r *http.Request, sessionID string) {
	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	if _, ok := h.svc.Session(sessionID); !ok {
		http.NotFound(w, r)
		return
	}

	conn, err := websocket.Accept(w, r, &websocket.AcceptOptions{InsecureSkipVerify: true})
	if err != nil {
		return
	}
	defer conn.Close(websocket.StatusNormalClosure, "")

	browserConn := h.bridge.Connect(sessionID)
	defer browserConn.Disconnect()

	ctx, cancel := context.WithCancel(r.Context())
	defer cancel()

	go func() {
		defer cancel()

		caps, _ := h.bridge.SessionCapabilities(sessionID)
		if err := writeWebSocketJSON(ctx, conn, SessionCapabilitiesEnvelope{Type: "session.capabilities", Capabilities: caps}); err != nil {
			return
		}

		for {
			select {
			case req := <-browserConn.Requests:
				if err := writeWebSocketJSON(ctx, conn, req); err != nil {
					return
				}
			case <-ctx.Done():
				return
			}
		}
	}()

	for {
		_, data, err := conn.Read(ctx)
		if err != nil {
			if websocket.CloseStatus(err) != websocket.StatusNormalClosure && !errors.Is(err, context.Canceled) {
				return
			}
			return
		}

		if err := h.handleBrowserWebSocketMessage(sessionID, browserConn, data); err != nil {
			return
		}
	}
}

func (h *HTTPServer) handleBrowserWebSocketMessage(sessionID string, browserConn *BrowserConnection, data []byte) error {
	var envelope struct {
		Type string `json:"type"`
	}
	if err := json.Unmarshal(data, &envelope); err != nil {
		return err
	}

	switch envelope.Type {
	case "session.capabilities":
		var msg SessionCapabilitiesEnvelope
		if err := json.Unmarshal(data, &msg); err != nil {
			return err
		}
		return browserConn.PublishCapabilities(msg.Capabilities)
	case "tool.result":
		var msg ToolResultEnvelope
		if err := json.Unmarshal(data, &msg); err != nil {
			return err
		}
		return browserConn.SubmitResult(msg)
	default:
		return nil
	}
}

func writeWebSocketJSON(ctx context.Context, conn *websocket.Conn, payload any) error {
	data, err := json.Marshal(payload)
	if err != nil {
		return err
	}
	return conn.Write(ctx, websocket.MessageText, data)
}
