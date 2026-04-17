export type ToolExecution = "server" | "client";

export type ToolVisibility = "local_only" | "model_visible" | "user_visible_only";

export interface ToolManifest {
  name: string;
  description: string;
  execution: ToolExecution;
  visibility: ToolVisibility;
  capability?: string;
  input_schema?: Record<string, unknown>;
  output_schema?: Record<string, unknown>;
  requires_confirmation?: boolean;
}

export interface ToolRequestEnvelope {
  id: string;
  type: "tool.request";
  tool: string;
  args: Record<string, unknown>;
}

export interface ToolError {
  code: string;
  message: string;
}

export interface ToolResultEnvelope {
  id: string;
  type: "tool.result";
  ok: boolean;
  output?: unknown;
  error?: ToolError;
  meta?: Record<string, unknown>;
}

export interface SessionCapabilities {
  opfs: boolean;
  wasm_worker: boolean;
  file_picker: boolean;
  max_local_read_bytes: number;
  supported_tools: string[];
}

export interface SessionCapabilitiesEnvelope {
  type: "session.capabilities";
  capabilities: SessionCapabilities;
}

export interface ConversationMessage {
  role: "user" | "assistant" | "tool";
  content?: string;
  tool_call_id?: string;
  tool_name?: string;
  tool_result?: ToolResultEnvelope;
  created_at: string;
}
