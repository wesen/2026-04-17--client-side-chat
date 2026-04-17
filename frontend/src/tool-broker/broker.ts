import { createDefaultToolRegistry, type ToolRegistry, type ToolExecutor } from "./registry";
import type {
  SessionCapabilitiesEnvelope,
  ToolError,
  ToolRequestEnvelope,
  ToolResultEnvelope,
} from "./contracts";

export interface ToolTransport {
  send(message: ToolResultEnvelope | SessionCapabilitiesEnvelope): void | Promise<void>;
}

export interface ToolBrokerObserver {
  onIncoming?(message: SessionCapabilitiesEnvelope | ToolRequestEnvelope): void;
  onOutgoing?(message: SessionCapabilitiesEnvelope | ToolResultEnvelope): void;
}

export class FrontendToolBroker {
  private capabilities: SessionCapabilitiesEnvelope | null = null;

  constructor(
    private readonly transport: ToolTransport,
    private readonly registry: ToolRegistry = createDefaultToolRegistry(),
    private readonly observer: ToolBrokerObserver = {},
  ) {}

  setCapabilities(message: SessionCapabilitiesEnvelope): void {
    this.capabilities = message;
  }

  listTools() {
    return this.registry.list();
  }

  async handle(message: unknown): Promise<void> {
    if (isSessionCapabilitiesEnvelope(message)) {
      this.observer.onIncoming?.(message);
      this.setCapabilities(message);
      return;
    }

    if (isToolRequestEnvelope(message)) {
      this.observer.onIncoming?.(message);
      await this.handleToolRequest(message);
    }
  }

  private async handleToolRequest(message: ToolRequestEnvelope): Promise<void> {
    const definition = this.registry.get(message.tool);
    if (!definition) {
      const response: ToolResultEnvelope = {
        id: message.id,
        type: "tool.result",
        ok: false,
        error: {
          code: "UNKNOWN_TOOL",
          message: `The browser broker does not know ${message.tool}`,
        },
      };
      this.observer.onOutgoing?.(response);
      await this.transport.send(response);
      return;
    }

    const started = performance.now();
    try {
      const execution = await definition.execute(message.args);
      const response: ToolResultEnvelope = {
        id: message.id,
        type: "tool.result",
        ok: true,
        output: execution.output,
        meta: {
          duration_ms: performance.now() - started,
          tool: definition.manifest.name,
          visibility: definition.manifest.visibility,
          ...execution.meta,
        },
      };
      this.observer.onOutgoing?.(response);
      await this.transport.send(response);
    } catch (error) {
      const response: ToolResultEnvelope = {
        id: message.id,
        type: "tool.result",
        ok: false,
        error: normalizeToolError(error),
        meta: {
          duration_ms: performance.now() - started,
          tool: definition.manifest.name,
          visibility: definition.manifest.visibility,
        },
      };
      this.observer.onOutgoing?.(response);
      await this.transport.send(response);
    }
  }
}

function normalizeToolError(error: unknown): ToolError {
  if (error instanceof Error) {
    return { code: "TOOL_FAILED", message: error.message };
  }
  return { code: "TOOL_FAILED", message: "Unknown tool execution failure" };
}

function isToolRequestEnvelope(value: unknown): value is ToolRequestEnvelope {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const candidate = value as Partial<ToolRequestEnvelope>;
  return candidate.type === "tool.request" && typeof candidate.id === "string" && typeof candidate.tool === "string";
}

function isSessionCapabilitiesEnvelope(value: unknown): value is SessionCapabilitiesEnvelope {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const candidate = value as Partial<SessionCapabilitiesEnvelope>;
  return candidate.type === "session.capabilities" && typeof candidate.capabilities === "object";
}
