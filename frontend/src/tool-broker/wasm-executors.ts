import { runWorkerTask } from "./worker-client";
import type { ToolExecutionResult } from "./opfs-executors";

export function createWasmTaskExecutor() {
  return async (args: Record<string, unknown>): Promise<ToolExecutionResult> => {
    const request = {
      id: crypto.randomUUID(),
      task: String(args.task ?? "unknown"),
      args,
      timeout_ms: typeof args.timeout_ms === "number" ? args.timeout_ms : 10_000,
    };
    const response = await runWorkerTask(new URL("../workers/wasm.worker.js", import.meta.url), request, request.timeout_ms);
    if (!response.ok) {
      throw new Error(response.error?.message ?? "WASM task failed");
    }
    return {
      output: response.output,
      meta: response.meta,
    };
  };
}
