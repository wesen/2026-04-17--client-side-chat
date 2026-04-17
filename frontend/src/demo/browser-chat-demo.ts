import { ChatView } from "../app/ChatView";
import { FrontendToolBroker, type ToolBrokerObserver, type ToolTransport } from "../tool-broker/broker";
import type { ConversationMessage, SessionSnapshot, SessionCapabilitiesEnvelope, ToolRequestEnvelope, ToolResultEnvelope, TurnResponse } from "../tool-broker/contracts";
import { WebSocketSessionClient } from "../session/websocket-session-client";

interface BrowserChatDemoOptions {
  root: HTMLElement;
  backendBaseUrl?: string;
}

type DiagnosticEntry = {
  timestamp: string;
  source: string;
  event: string;
  data?: unknown;
};

export class BrowserChatDemo {
  private readonly backendBaseUrl: string;
  private readonly root: HTMLElement;
  private session: SessionSnapshot | null = null;
  private broker: FrontendToolBroker | null = null;
  private sessionClient: WebSocketSessionClient | null = null;
  private statusText = "idle";
  private readonly diagnostics: DiagnosticEntry[] = [];

  private readonly promptInput = document.createElement("textarea");
  private readonly logPanel = document.createElement("div");
  private readonly statusPanel = document.createElement("div");
  private readonly sessionPanel = document.createElement("div");
  private readonly dialog = document.createElement("dialog");
  private readonly dialogPre = document.createElement("pre");

  constructor(options: BrowserChatDemoOptions) {
    this.root = options.root;
    this.backendBaseUrl = options.backendBaseUrl ?? window.location.origin;
  }

  async start(): Promise<void> {
    this.renderShell();
    this.recordDiagnostic("demo", "starting", { backendBaseUrl: this.backendBaseUrl });
    this.updateStatus("creating session");

    const session = await this.createSession();
    this.session = session;
    this.recordDiagnostic("demo", "session_created", { sessionId: session.id });
    this.renderSession();

    const websocketClient = new WebSocketSessionClient({
      sessionUrl: this.websocketUrl(session.id),
    });

    const transport: ToolTransport = {
      send: async (message) => {
        this.recordOutgoing(message);
        await websocketClient.send(message);
      },
    };

    const observer: ToolBrokerObserver = {
      onIncoming: (message) => {
        this.recordIncoming(message);
      },
    };

    const broker = new FrontendToolBroker(transport, undefined, observer);
    websocketClient.bindBroker(broker);
    this.sessionClient = websocketClient;
    this.broker = broker;

    await websocketClient.connect();
    this.updateStatus("connected");
    this.recordDiagnostic("demo", "websocket_connected", { sessionId: session.id });
    this.recordDiagnostic("demo", "browser_capabilities_sent", { sessionId: session.id });
    this.appendLog(`Connected websocket session for ${session.id}`);

    await this.refreshSession();
    this.renderDiagnostics();
  }

  destroy(): void {
    this.sessionClient?.close();
    this.sessionClient = null;
    this.broker = null;
    this.session = null;
    this.statusText = "closed";
    this.updateStatus(this.statusText);
  }

  private renderShell(): void {
    this.root.innerHTML = "";

    const toolbar = document.createElement("div");
    const sendButton = document.createElement("button");
    sendButton.textContent = "Send prompt";
    sendButton.addEventListener("click", () => {
      void this.submitPrompt();
    });

    const sampleButton = document.createElement("button");
    sampleButton.textContent = "Load demo prompt";
    sampleButton.addEventListener("click", () => {
      this.promptInput.value = "Search my local project for TODOs.";
    });

    const browseButton = document.createElement("button");
    browseButton.textContent = "Browse OPFS";
    browseButton.addEventListener("click", () => {
      this.promptInput.value = "Browse OPFS /notes";
    });

    const diagnosticsButton = document.createElement("button");
    diagnosticsButton.textContent = "Diagnostics";
    diagnosticsButton.addEventListener("click", () => {
      this.openDiagnosticsModal();
    });

    toolbar.append(sendButton, sampleButton, browseButton, diagnosticsButton);

    this.promptInput.rows = 4;
    this.promptInput.cols = 80;
    this.promptInput.placeholder = "Ask the chat to inspect local files, search TODOs, or summarize the conversation.";

    this.dialog.addEventListener("click", (event) => {
      if (event.target === this.dialog) {
        this.dialog.close();
      }
    });

    this.dialog.append(this.dialogPre);
    this.root.append(this.statusPanel, this.sessionPanel, this.promptInput, toolbar, this.logPanel, this.dialog);
  }

  private renderSession(): void {
    if (!this.session) {
      return;
    }

    this.sessionPanel.innerHTML = "";
    const view = ChatView({
      sessionId: this.session.id,
      messages: this.session.messages,
      onSend: (content) => {
        void this.sendPrompt(content);
      },
    });
    this.sessionPanel.append(view);

    const toolList = document.createElement("ul");
    for (const tool of this.session.tools) {
      const item = document.createElement("li");
      item.textContent = `${tool.name} (${tool.execution}, ${tool.visibility})`;
      toolList.append(item);
    }

    const toolHeading = document.createElement("h3");
    toolHeading.textContent = "Available tools";
    this.sessionPanel.append(toolHeading, toolList);
  }

  private async submitPrompt(): Promise<void> {
    await this.sendPrompt(this.promptInput.value.trim());
  }

  private async sendPrompt(content: string): Promise<void> {
    if (!content) {
      return;
    }

    const sessionID = this.session?.id;
    if (!sessionID) {
      throw new Error("No active session");
    }

    this.updateStatus("sending prompt");
    this.recordDiagnostic("demo", "prompt_sent", { sessionId: sessionID, content });
    this.appendLog(`POST /api/sessions/${sessionID}/messages`);

    const response = await fetch(`${this.backendBaseUrl}/api/sessions/${sessionID}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
    });

    if (!response.ok) {
      const body = await response.text();
      this.updateStatus("error");
      this.recordDiagnostic("demo", "backend_error", { status: response.status, body });
      this.appendLog(`backend error ${response.status}: ${body}`);
      throw new Error(`Failed to send prompt: ${response.status}`);
    }

    const turn = (await response.json()) as TurnResponse;
    this.session = turn.session;
    this.promptInput.value = "";
    this.updateStatus(turn.assistant_text ? "assistant replied" : "waiting");
    this.recordDiagnostic("demo", "assistant_reply", {
      assistantText: turn.assistant_text,
      lastToolResult: turn.last_tool_result,
    });
    this.appendLog(turn.assistant_text ?? "turn completed");
    this.renderSession();
    this.renderDiagnostics();
  }

  private async createSession(): Promise<SessionSnapshot> {
    const response = await fetch(`${this.backendBaseUrl}/api/sessions`, { method: "POST" });
    if (!response.ok) {
      throw new Error(`Failed to create session: ${response.status}`);
    }
    return (await response.json()) as SessionSnapshot;
  }

  private async refreshSession(): Promise<void> {
    if (!this.session) {
      return;
    }

    const response = await fetch(`${this.backendBaseUrl}/api/sessions/${this.session.id}`);
    if (!response.ok) {
      throw new Error(`Failed to refresh session: ${response.status}`);
    }

    this.session = (await response.json()) as SessionSnapshot;
    this.renderSession();
  }

  private openDiagnosticsModal(): void {
    this.renderDiagnostics();
    if (typeof this.dialog.showModal === "function") {
      this.dialog.showModal();
    }
  }

  private renderDiagnostics(): void {
    const payload = {
      status: this.statusText,
      sessionId: this.session?.id ?? null,
      entries: this.diagnostics.slice(-12),
    };
    this.dialogPre.textContent = JSON.stringify(payload, null, 2);
  }

  private updateStatus(text: string): void {
    this.statusText = text;
    this.statusPanel.textContent = `Status: ${text}`;
  }

  private appendLog(text: string): void {
    const line = document.createElement("div");
    line.textContent = text;
    this.logPanel.append(line);
  }

  private recordIncoming(message: SessionCapabilitiesEnvelope | ToolRequestEnvelope): void {
    this.recordDiagnostic("broker", "incoming", message);
    if (isToolRequestEnvelope(message)) {
      this.appendLog(`tool.request -> ${message.tool}`);
    } else if (isSessionCapabilitiesEnvelope(message)) {
      this.appendLog("session.capabilities received from backend");
    }
    this.renderDiagnostics();
  }

  private recordOutgoing(message: SessionCapabilitiesEnvelope | ToolResultEnvelope): void {
    this.recordDiagnostic("broker", "outgoing", message);
    if (isToolResultEnvelope(message)) {
      this.appendLog(`tool.result -> ${message.ok ? "ok" : "error"}`);
      if (message.ok && message.meta) {
        this.recordDiagnostic("worker", "tool_meta", message.meta);
      }
    }
    this.renderDiagnostics();
  }

  private recordDiagnostic(source: string, event: string, data?: unknown): void {
    this.diagnostics.push({
      timestamp: new Date().toISOString(),
      source,
      event,
      data,
    });
    if (this.diagnostics.length > 100) {
      this.diagnostics.shift();
    }
  }

  private websocketUrl(sessionID: string): string {
    const url = new URL(`${this.backendBaseUrl}/api/sessions/${sessionID}/ws`);
    url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
    return url.toString();
  }
}

function isToolRequestEnvelope(value: SessionCapabilitiesEnvelope | ToolRequestEnvelope): value is ToolRequestEnvelope {
  return (value as ToolRequestEnvelope).type === "tool.request";
}

function isSessionCapabilitiesEnvelope(value: SessionCapabilitiesEnvelope | ToolRequestEnvelope): value is SessionCapabilitiesEnvelope {
  return (value as SessionCapabilitiesEnvelope).type === "session.capabilities";
}

function isToolResultEnvelope(value: SessionCapabilitiesEnvelope | ToolResultEnvelope): value is ToolResultEnvelope {
  return (value as ToolResultEnvelope).type === "tool.result";
}

export async function mountBrowserChatDemo(root: HTMLElement, backendBaseUrl?: string): Promise<BrowserChatDemo> {
  const demo = new BrowserChatDemo({ root, backendBaseUrl });
  await demo.start();
  return demo;
}
