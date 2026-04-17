import { runWorkerTask } from "./worker-client";

export function createWasmTaskExecutor() {
  return async (args: Record<string, unknown>) => {
    const request = {
      id: crypto.randomUUID(),
      task: String(args.task ?? "unknown"),
      args,
      timeout_ms: typeof args.timeout_ms === "number" ? args.timeout_ms : 10_000,
    };
    const response = await runWorkerTask(new URL("../workers/wasm.worker.ts", import.meta.url), request, request.timeout_ms);
    if (!response.ok) {
      throw new Error(response.error?.message ?? "WASM task failed");
    }
    return response.output;
  };
}
