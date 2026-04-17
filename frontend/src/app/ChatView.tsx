import type { ConversationMessage } from "../tool-broker/contracts";

export interface ChatViewProps {
  sessionId: string;
  messages: ConversationMessage[];
  onSend: (content: string) => void;
}

export function ChatView({ sessionId, messages, onSend }: ChatViewProps) {
  return (
    <section>
      <header>
        <h1>Session {sessionId}</h1>
      </header>

      <ol>
        {messages.map((message) => (
          <li key={`${message.created_at}-${message.role}`}>
            <strong>{message.role}:</strong> {message.content ?? message.tool_name ?? ""}
          </li>
        ))}
      </ol>

      <button onClick={() => onSend("Search my local project for TODOs.")}>Send demo prompt</button>
    </section>
  );
}
