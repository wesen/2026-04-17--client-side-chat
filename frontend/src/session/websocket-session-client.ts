import type { FrontendToolBroker } from "../tool-broker/broker";
import type { SessionCapabilities, SessionCapabilitiesEnvelope, ToolResultEnvelope } from "../tool-broker/contracts";

export interface BrowserSessionClientOptions {
  sessionUrl: string;
  capabilities?: SessionCapabilities;
}

export class WebSocketSessionClient {
  private socket: WebSocket | null = null;
  private broker: FrontendToolBroker | null = null;
  private readonly capabilities: SessionCapabilities;

  constructor(private readonly options: BrowserSessionClientOptions) {
    this.capabilities = options.capabilities ?? detectBrowserCapabilities();
  }

  bindBroker(broker: FrontendToolBroker): void {
    this.broker = broker;
  }

  async connect(): Promise<void> {
    if (this.socket) {
      return;
    }

    await new Promise<void>((resolve, reject) => {
      const socket = new WebSocket(this.options.sessionUrl);
      this.socket = socket;

      socket.onopen = () => {
        void this.sendCapabilities(this.capabilities);
        resolve();
      };

      socket.onmessage = (event) => {
        void this.handleIncoming(event.data);
      };

      socket.onerror = () => {
        reject(new Error(`WebSocket error while connecting to ${this.options.sessionUrl}`));
      };

      socket.onclose = () => {
        this.socket = null;
      };
    });
  }

  close(): void {
    this.socket?.close();
    this.socket = null;
  }

  async send(message: SessionCapabilitiesEnvelope | ToolResultEnvelope): Promise<void> {
    this.ensureSocket();
    this.socket!.send(JSON.stringify(message));
  }

  async sendCapabilities(capabilities: SessionCapabilities = this.capabilities): Promise<void> {
    await this.send({ type: "session.capabilities", capabilities });
  }

  private async handleIncoming(raw: MessageEvent["data"]): Promise<void> {
    if (!this.broker) {
      return;
    }

    const message = typeof raw === "string" ? JSON.parse(raw) : JSON.parse(String(raw));
    await this.broker.handle(message);
  }

  private ensureSocket(): void {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      throw new Error("WebSocket session is not connected");
    }
  }
}

function detectBrowserCapabilities(): SessionCapabilities {
  return {
    opfs: typeof navigator !== "undefined" && !!navigator.storage && typeof navigator.storage.getDirectory === "function",
    wasm_worker: typeof Worker !== "undefined",
    file_picker: typeof window !== "undefined" && typeof (window as Window & { showOpenFilePicker?: unknown }).showOpenFilePicker === "function",
    max_local_read_bytes: 1_048_576,
    supported_tools: ["opfs.list_dir", "opfs.read_text", "opfs.write_text", "wasm.run_task"],
  };
}
