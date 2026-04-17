export interface WorkerTaskRequest {
  id: string;
  task: string;
  args: Record<string, unknown>;
  timeout_ms?: number;
}

export interface WorkerTaskResponse {
  id: string;
  ok: boolean;
  output?: unknown;
  error?: { code: string; message: string };
  meta?: Record<string, unknown>;
}

export async function runWorkerTask(
  workerUrl: string | URL,
  request: WorkerTaskRequest,
  timeoutMs = 30_000,
): Promise<WorkerTaskResponse> {
  if (typeof Worker === "undefined") {
    return {
      id: request.id,
      ok: false,
      error: {
        code: "WORKER_UNAVAILABLE",
        message: "Web Workers are not available in this environment",
      },
    };
  }

  return await new Promise<WorkerTaskResponse>((resolve) => {
    const worker = new Worker(workerUrl, { type: "module" });
    const timer = window.setTimeout(() => {
      worker.terminate();
      resolve({
        id: request.id,
        ok: false,
        error: {
          code: "TIMEOUT",
          message: `Worker task ${request.task} exceeded ${timeoutMs}ms`,
        },
      });
    }, timeoutMs);

    worker.onmessage = (event: MessageEvent<WorkerTaskResponse>) => {
      window.clearTimeout(timer);
      worker.terminate();
      resolve(event.data);
    };

    worker.onerror = () => {
      window.clearTimeout(timer);
      worker.terminate();
      resolve({
        id: request.id,
        ok: false,
        error: {
          code: "WORKER_ERROR",
          message: `Worker task ${request.task} failed to initialize`,
        },
      });
    };

    worker.postMessage(request);
  });
}
