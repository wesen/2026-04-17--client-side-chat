import { mountBrowserChatDemo } from "./demo";

async function bootstrap(): Promise<void> {
  const root = document.getElementById("app");
  if (!root) {
    throw new Error("Expected #app root element");
  }

  await mountBrowserChatDemo(root);
}

void bootstrap();
