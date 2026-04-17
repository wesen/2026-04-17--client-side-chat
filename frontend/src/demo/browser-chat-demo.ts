import { ChatView } from "../app/ChatView";
import { FrontendToolBroker } from "../tool-broker/broker";
import type { ConversationMessage, SessionSnapshot, TurnResponse } from "../tool-broker/contracts";
import { WebSocketSessionClient } from "../session/websocket-session-client";

interface BrowserChatDemoOptions {
  root: HTMLElement;
  backendBaseUrl?: string;
}

export class BrowserChatDemo {
  private readonly backendBaseUrl: string;
  private readonly root: HTMLElement;
  private session: SessionSnapshot | null = null;
  private broker: FrontendToolBroker | null = null;
  private sessionClient: WebSocketSessionClient | null = null;
  private statusText = "idle";

  private readonly promptInput = document.createElement("textarea");
  private readonly logPanel = document.createElement("div");
  private readonly statusPanel = document.createElement("div");
  private readonly sessionPanel = document.createElement("div");

  constructor(options: BrowserChatDemoOptions) {
    this.root = options.root;
    this.backendBaseUrl = options.backendBaseUrl ?? window.location.origin;
  }

  async start(): Promise<void> {
    this.renderShell();
    this.updateStatus("creating session");

    const session = await this.createSession();
    this.session = session;
    this.renderSession();

    const websocketClient = new WebSocketSessionClient({
      sessionUrl: this.websocketUrl(session.id),
    });
    const broker = new FrontendToolBroker(websocketClient);
    websocketClient.bindBroker(broker);
    this.sessionClient = websocketClient;
    this.broker = broker;

    await websocketClient.connect();
    this.updateStatus("connected");
    this.appendLog(`Connected websocket session for ${session.id}`);

    await this.refreshSession();
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
    this.root.append(this.statusPanel, this.sessionPanel, this.promptInput, this.logPanel);

    this.promptInput.rows = 4;
    this.promptInput.cols = 80;
    this.promptInput.placeholder = "Ask the chat to inspect local files, search TODOs, or summarize the conversation.";

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

    this.root.append(sendButton, sampleButton);
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
    this.appendLog(`POST /api/sessions/${sessionID}/messages`);

    const response = await fetch(`${this.backendBaseUrl}/api/sessions/${sessionID}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
    });

    if (!response.ok) {
      const body = await response.text();
      this.updateStatus("error");
      this.appendLog(`backend error ${response.status}: ${body}`);
      throw new Error(`Failed to send prompt: ${response.status}`);
    }

    const turn = (await response.json()) as TurnResponse;
    this.session = turn.session;
    this.promptInput.value = "";
    this.updateStatus(turn.assistant_text ? "assistant replied" : "waiting");
    this.appendLog(turn.assistant_text ?? "turn completed");
    this.renderSession();
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

  private updateStatus(text: string): void {
    this.statusText = text;
    this.statusPanel.textContent = `Status: ${text}`;
  }

  private appendLog(text: string): void {
    const line = document.createElement("div");
    line.textContent = text;
    this.logPanel.append(line);
  }

  private websocketUrl(sessionID: string): string {
    const url = new URL(`${this.backendBaseUrl}/api/sessions/${sessionID}/ws`);
    url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
    return url.toString();
  }
}

export async function mountBrowserChatDemo(root: HTMLElement, backendBaseUrl?: string): Promise<BrowserChatDemo> {
  const demo = new BrowserChatDemo({ root, backendBaseUrl });
  await demo.start();
  return demo;
}
