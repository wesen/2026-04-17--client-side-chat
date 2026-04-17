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
  meta?: Record<string, unknown>;
}

self.addEventListener("message", async (event: MessageEvent<ParserWorkerRequest>) => {
  const request = event.data;

  try {
    const output = runParserTask(request.task, request.args);
    self.postMessage({
      id: request.id,
      ok: true,
      output,
      meta: { backend: "parser", task: request.task },
    } satisfies ParserWorkerResponse);
  } catch (error) {
    self.postMessage({
      id: request.id,
      ok: false,
      error: normalizeError(error),
    } satisfies ParserWorkerResponse);
  }
});

function runParserTask(task: ParserWorkerRequest["task"], args: Record<string, unknown>): unknown {
  const text = String(args.text ?? "");

  switch (task) {
    case "tokenize":
      return {
        task,
        tokens: text.trim() === "" ? [] : text.trim().split(/\s+/),
      };
    case "parse":
      return {
        task,
        lines: text.split(/\r?\n/).map((line, index) => ({ line: index + 1, text: line })),
      };
    case "index":
      return {
        task,
        lines: text
          .split(/\r?\n/)
          .flatMap((line, index) => (line.includes(args.query as string) ? [{ line: index + 1, text: line }] : [])),
      };
    default:
      throw new Error(`Unsupported parser task: ${task}`);
  }
}

function normalizeError(error: unknown): { code: string; message: string } {
  if (error instanceof Error) {
    return { code: "PARSER_ERROR", message: error.message };
  }
  return { code: "PARSER_ERROR", message: "Unknown parser failure" };
}

export {};
