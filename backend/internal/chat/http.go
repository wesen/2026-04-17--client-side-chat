package chat

import (
	"encoding/json"
	"net/http"
	"strings"
)

type HTTPServer struct {
	svc    *Service
	bridge *BrowserBridge
}

func NewHTTPServer(svc *Service, bridge *BrowserBridge) *HTTPServer {
	return &HTTPServer{svc: svc, bridge: bridge}
}

func (h *HTTPServer) Handler() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("/healthz", h.handleHealth)
	mux.HandleFunc("/api/sessions", h.handleSessions)
	mux.HandleFunc("/api/sessions/", h.handleSession)
	return mux
}

func (h *HTTPServer) handleHealth(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

func (h *HTTPServer) handleSessions(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodPost:
		session := h.svc.CreateSession()
		writeJSON(w, http.StatusCreated, session)
	default:
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
	}
}

func (h *HTTPServer) handleSession(w http.ResponseWriter, r *http.Request) {
	path := strings.TrimPrefix(r.URL.Path, "/api/sessions/")
	parts := strings.Split(path, "/")
	if len(parts) < 1 || parts[0] == "" {
		http.NotFound(w, r)
		return
	}

	sessionID := parts[0]
	if len(parts) == 1 {
		switch r.Method {
		case http.MethodGet:
			snapshot, ok := h.svc.Session(sessionID)
			if !ok {
				http.NotFound(w, r)
				return
			}
			writeJSON(w, http.StatusOK, snapshot)
		default:
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		}
		return
	}

	switch parts[1] {
	case "messages":
		if r.Method != http.MethodPost {
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}
		var payload struct {
			Content string `json:"content"`
		}
		if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}
		turn, err := h.svc.HandleUserMessage(r.Context(), sessionID, payload.Content)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		writeJSON(w, http.StatusOK, turn)
	case "ws":
		h.handleBrowserWebSocket(w, r, sessionID)
	default:
		http.NotFound(w, r)
	}
}

func writeJSON(w http.ResponseWriter, status int, payload any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(payload)
}
