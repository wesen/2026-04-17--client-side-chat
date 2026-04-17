export interface ParserWorkerRequest {
  id: string;
  task: "tokenize" | "parse" | "index";
  args: Record<string, unknown>;
}

export interface ParserWorkerResponse {
  id: string;
  ok: boolean;
  output?: unknown;
  error?: { code: string; message: string };
}

self.addEventListener("message", async (event: MessageEvent<ParserWorkerRequest>) => {
  const request = event.data;

  // Scaffold only: the parser worker will eventually host document parsing,
  // text scanning, and indexing transforms that are too heavy for the UI thread.
  self.postMessage({
    id: request.id,
    ok: false,
    error: {
      code: "NOT_IMPLEMENTED",
      message: `Parser task ${request.task} is not wired yet`,
    },
  } satisfies ParserWorkerResponse);
});

export {};
