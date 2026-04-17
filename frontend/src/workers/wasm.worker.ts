export interface WasmWorkerRequest {
  id: string;
  task: string;
  args: Record<string, unknown>;
  timeout_ms?: number;
}

export interface WasmWorkerResponse {
  id: string;
  ok: boolean;
  output?: unknown;
  error?: { code: string; message: string };
}

self.addEventListener("message", async (event: MessageEvent<WasmWorkerRequest>) => {
  const request = event.data;

  // Scaffold only: this worker exists to mark the execution boundary for
  // deterministic browser-side compute. A future version will load a WASM
  // module and dispatch tasks such as grep, tokenize, and embed.
  self.postMessage({
    id: request.id,
    ok: false,
    error: {
      code: "NOT_IMPLEMENTED",
      message: `WASM task ${request.task} is not wired yet`,
    },
  } satisfies WasmWorkerResponse);
});

export {};
