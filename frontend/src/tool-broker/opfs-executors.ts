import { runWorkerTask } from "./worker-client";

export function createOpfsListDirExecutor() {
  return async (args: Record<string, unknown>) => {
    const request = {
      id: crypto.randomUUID(),
      task: "list_dir",
      args,
      timeout_ms: 10_000,
    };
    const response = await runWorkerTask(new URL("../workers/opfs.worker.ts", import.meta.url), request, 10_000);
    if (!response.ok) {
      throw new Error(response.error?.message ?? "OPFS list_dir failed");
    }
    return response.output;
  };
}

export function createOpfsReadTextExecutor() {
  return async (args: Record<string, unknown>) => {
    const request = {
      id: crypto.randomUUID(),
      task: "read_text",
      args,
      timeout_ms: 10_000,
    };
    const response = await runWorkerTask(new URL("../workers/opfs.worker.ts", import.meta.url), request, 10_000);
    if (!response.ok) {
      throw new Error(response.error?.message ?? "OPFS read_text failed");
    }
    return response.output;
  };
}

export function createOpfsWriteTextExecutor() {
  return async (args: Record<string, unknown>) => {
    const request = {
      id: crypto.randomUUID(),
      task: "write_text",
      args,
      timeout_ms: 10_000,
    };
    const response = await runWorkerTask(new URL("../workers/opfs.worker.ts", import.meta.url), request, 10_000);
    if (!response.ok) {
      throw new Error(response.error?.message ?? "OPFS write_text failed");
    }
    return response.output;
  };
}
