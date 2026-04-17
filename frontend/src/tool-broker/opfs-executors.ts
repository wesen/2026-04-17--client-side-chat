import { runWorkerTask } from "./worker-client";

export interface ToolExecutionResult {
  output: unknown;
  meta?: Record<string, unknown>;
}

function asExecutionResult(response: Awaited<ReturnType<typeof runWorkerTask>>): ToolExecutionResult {
  return {
    output: response.output,
    meta: response.meta,
  };
}

export function createOpfsListDirExecutor() {
  return async (args: Record<string, unknown>): Promise<ToolExecutionResult> => {
    const request = {
      id: crypto.randomUUID(),
      task: "list_dir",
      args,
      timeout_ms: 10_000,
    };
    const response = await runWorkerTask(new URL("../workers/opfs.worker.js", import.meta.url), request, 10_000);
    if (!response.ok) {
      throw new Error(response.error?.message ?? "OPFS list_dir failed");
    }
    return asExecutionResult(response);
  };
}

export function createOpfsReadTextExecutor() {
  return async (args: Record<string, unknown>): Promise<ToolExecutionResult> => {
    const request = {
      id: crypto.randomUUID(),
      task: "read_text",
      args,
      timeout_ms: 10_000,
    };
    const response = await runWorkerTask(new URL("../workers/opfs.worker.js", import.meta.url), request, 10_000);
    if (!response.ok) {
      throw new Error(response.error?.message ?? "OPFS read_text failed");
    }
    return asExecutionResult(response);
  };
}

export function createOpfsWriteTextExecutor() {
  return async (args: Record<string, unknown>): Promise<ToolExecutionResult> => {
    const request = {
      id: crypto.randomUUID(),
      task: "write_text",
      args,
      timeout_ms: 10_000,
    };
    const response = await runWorkerTask(new URL("../workers/opfs.worker.js", import.meta.url), request, 10_000);
    if (!response.ok) {
      throw new Error(response.error?.message ?? "OPFS write_text failed");
    }
    return asExecutionResult(response);
  };
}
