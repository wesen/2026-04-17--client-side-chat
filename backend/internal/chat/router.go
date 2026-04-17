package chat

import (
	"context"
	"encoding/json"
	"fmt"
)

type ServerToolRunner interface {
	Run(ctx context.Context, tool ToolManifest, callID string, args json.RawMessage) (ToolResultEnvelope, error)
}

type ClientBridge interface {
	Call(ctx context.Context, sessionID string, tool ToolManifest, callID string, args json.RawMessage) (ToolResultEnvelope, error)
}

type Router struct {
	ServerRunner ServerToolRunner
	ClientBridge ClientBridge
}

func NewRouter(serverRunner ServerToolRunner, clientBridge ClientBridge) Router {
	return Router{ServerRunner: serverRunner, ClientBridge: clientBridge}
}

func (r Router) RouteTool(ctx context.Context, sessionID string, tool ToolManifest, callID string, args json.RawMessage) (ToolResultEnvelope, error) {
	switch tool.Execution {
	case ToolExecutionServer:
		if r.ServerRunner == nil {
			return ToolResultEnvelope{ID: callID, Type: "tool.result", OK: false, Error: &ToolError{Code: "SERVER_UNAVAILABLE", Message: "no server runner was configured"}}, fmt.Errorf("server runner not configured")
		}
		return r.ServerRunner.Run(ctx, tool, callID, args)
	case ToolExecutionClient:
		if r.ClientBridge == nil {
			return ToolResultEnvelope{ID: callID, Type: "tool.result", OK: false, Error: &ToolError{Code: "CLIENT_UNAVAILABLE", Message: "no client bridge was configured"}}, fmt.Errorf("client bridge not configured")
		}
		return r.ClientBridge.Call(ctx, sessionID, tool, callID, args)
	default:
		return ToolResultEnvelope{ID: callID, Type: "tool.result", OK: false, Error: &ToolError{Code: "UNKNOWN_EXECUTION_MODE", Message: string(tool.Execution)}}, fmt.Errorf("unknown execution mode %q", tool.Execution)
	}
}
