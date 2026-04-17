import { createDefaultToolRegistry, type ToolRegistry } from "./registry";
import type {
  SessionCapabilitiesEnvelope,
  ToolError,
  ToolRequestEnvelope,
  ToolResultEnvelope,
} from "./contracts";

export interface ToolTransport {
  send(message: ToolResultEnvelope | SessionCapabilitiesEnvelope): void | Promise<void>;
}

export class FrontendToolBroker {
  private capabilities: SessionCapabilitiesEnvelope | null = null;

  constructor(
    private readonly transport: ToolTransport,
    private readonly registry: ToolRegistry = createDefaultToolRegistry(),
  ) {}

  setCapabilities(message: SessionCapabilitiesEnvelope): void {
    this.capabilities = message;
  }

  listTools() {
    return this.registry.list();
  }

  async handle(message: unknown): Promise<void> {
    if (isSessionCapabilitiesEnvelope(message)) {
      this.setCapabilities(message);
      return;
    }

    if (isToolRequestEnvelope(message)) {
      await this.handleToolRequest(message);
    }
  }

  private async handleToolRequest(message: ToolRequestEnvelope): Promise<void> {
    const definition = this.registry.get(message.tool);
    if (!definition) {
      await this.transport.send({
        id: message.id,
        type: "tool.result",
        ok: false,
        error: {
          code: "UNKNOWN_TOOL",
          message: `The browser broker does not know ${message.tool}`,
        },
      });
      return;
    }

    const started = performance.now();
    try {
      const output = await definition.execute(message.args);
      await this.transport.send({
        id: message.id,
        type: "tool.result",
        ok: true,
        output,
        meta: {
          duration_ms: performance.now() - started,
          tool: definition.manifest.name,
          visibility: definition.manifest.visibility,
        },
      });
    } catch (error) {
      await this.transport.send({
        id: message.id,
        type: "tool.result",
        ok: false,
        error: normalizeToolError(error),
      });
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
