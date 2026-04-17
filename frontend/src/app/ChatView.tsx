import type { ConversationMessage } from "../tool-broker/contracts";

export interface ChatViewProps {
  sessionId: string;
  messages: ConversationMessage[];
  onSend: (content: string) => void;
}

export function ChatView({ sessionId, messages, onSend }: ChatViewProps): HTMLElement {
  const section = document.createElement("section");

  const header = document.createElement("header");
  const title = document.createElement("h1");
  title.textContent = `Session ${sessionId}`;
  header.append(title);

  const list = document.createElement("ol");
  for (const message of messages) {
    const item = document.createElement("li");
    const role = document.createElement("strong");
    role.textContent = `${message.role}: `;
    item.append(role, document.createTextNode(message.content ?? message.tool_name ?? ""));
    list.append(item);
  }

  const button = document.createElement("button");
  button.textContent = "Send demo prompt";
  button.addEventListener("click", () => {
    onSend("Search my local project for TODOs.");
  });

  section.append(header, list, button);
  return section;
}
