export interface OpfsWorkerRequest {
  id: string;
  task: "list_dir" | "read_text" | "write_text";
  args: Record<string, unknown>;
}

export interface OpfsWorkerResponse {
  id: string;
  ok: boolean;
  output?: unknown;
  error?: { code: string; message: string };
}

self.addEventListener("message", async (event: MessageEvent<OpfsWorkerRequest>) => {
  const request = event.data;

  // Scaffold only: this worker defines the message contract and the
  // execution boundary for OPFS operations. The real adapter will call the
  // browser's file APIs here.
  const response: OpfsWorkerResponse = {
    id: request.id,
    ok: false,
    error: {
      code: "NOT_IMPLEMENTED",
      message: `OPFS task ${request.task} is not wired yet`,
    },
  };

  self.postMessage(response);
});

export {};
