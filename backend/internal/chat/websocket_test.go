package chat

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"nhooyr.io/websocket"
)

func TestWebSocketBrowserTransportRoundTrip(t *testing.T) {
	t.Parallel()

	bridge := NewBrowserBridge()
	svc := NewService(NewRouter(NewMockServerRunner(), bridge))
	server := NewHTTPServer(svc, bridge)
	ts := httptest.NewServer(server.Handler())
	defer ts.Close()

	session := svc.CreateSession()
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	wsURL := "ws" + strings.TrimPrefix(ts.URL, "http") + "/api/sessions/" + session.ID + "/ws"
	wsConn, _, err := websocket.Dial(ctx, wsURL, nil)
	if err != nil {
		t.Fatalf("websocket.Dial() error = %v", err)
	}
	defer wsConn.Close(websocket.StatusNormalClosure, "")

	_, initialData, err := wsConn.Read(ctx)
	if err != nil {
		t.Fatalf("initial ws.Read() error = %v", err)
	}
	var initialCaps SessionCapabilitiesEnvelope
	if err := json.Unmarshal(initialData, &initialCaps); err != nil {
		t.Fatalf("json.Unmarshal() initial caps error = %v", err)
	}
	if initialCaps.Type != "session.capabilities" {
		t.Fatalf("initial message type = %s, want session.capabilities", initialCaps.Type)
	}

	localCaps := SessionCapabilitiesEnvelope{
		Type: "session.capabilities",
		Capabilities: SessionCapabilities{
			OPFS:              true,
			WASMWorker:        true,
			FilePicker:        false,
			MaxLocalReadBytes: 2048,
			SupportedTools: []string{
				"opfs.list_dir",
				"opfs.read_text",
				"opfs.write_text",
				"wasm.run_task",
			},
		},
	}
	capBytes, err := json.Marshal(localCaps)
	if err != nil {
		t.Fatalf("json.Marshal() local caps error = %v", err)
	}
	if err := wsConn.Write(ctx, websocket.MessageText, capBytes); err != nil {
		t.Fatalf("wsConn.Write() local caps error = %v", err)
	}

	responseCh := make(chan turnResult, 1)
	go func() {
		resp, err := http.Post(ts.URL+"/api/sessions/"+session.ID+"/messages", "application/json", strings.NewReader(`{"content":"Search my local project for TODOs."}`))
		if err != nil {
			responseCh <- turnResult{err: err}
			return
		}
		defer resp.Body.Close()
		body, err := io.ReadAll(resp.Body)
		responseCh <- turnResult{status: resp.StatusCode, body: string(body), err: err}
	}()

	_, requestData, err := wsConn.Read(ctx)
	if err != nil {
		t.Fatalf("tool request ws.Read() error = %v", err)
	}
	var request ToolRequestEnvelope
	if err := json.Unmarshal(requestData, &request); err != nil {
		t.Fatalf("json.Unmarshal() request error = %v", err)
	}
	if request.Type != "tool.request" || request.Tool != "wasm.run_task" {
		t.Fatalf("request = %#v, want wasm.run_task tool request", request)
	}

	resultBytes, err := json.Marshal(ToolResultEnvelope{
		ID:   request.ID,
		Type: "tool.result",
		OK:   true,
		Output: map[string]any{
			"summary": "Found 2 TODO matches in the mock project.",
		},
		Meta: map[string]any{"tool": request.Tool},
	})
	if err != nil {
		t.Fatalf("json.Marshal() result error = %v", err)
	}
	if err := wsConn.Write(ctx, websocket.MessageText, resultBytes); err != nil {
		t.Fatalf("wsConn.Write() result error = %v", err)
	}

	select {
	case res := <-responseCh:
		if res.err != nil {
			t.Fatalf("POST request error = %v", res.err)
		}
		if res.status != http.StatusOK {
			t.Fatalf("POST status = %d, want %d body=%s", res.status, http.StatusOK, res.body)
		}
		if !strings.Contains(res.body, "Found 2 TODO matches") {
			t.Fatalf("POST body = %s, want TODO summary", res.body)
		}
	case <-ctx.Done():
		t.Fatalf("timed out waiting for POST response")
	}
}

type turnResult struct {
	status int
	body   string
	err    error
}
