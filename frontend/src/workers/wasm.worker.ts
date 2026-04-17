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
  meta?: Record<string, unknown>;
}

type DocumentInput = {
  path: string;
  text: string;
};

self.addEventListener("message", async (event: MessageEvent<WasmWorkerRequest>) => {
  const request = event.data;

  try {
    const output = await runTask(request.task, request.args);
    self.postMessage({
      id: request.id,
      ok: true,
      output,
      meta: { backend: "wasm", task: request.task },
    } satisfies WasmWorkerResponse);
  } catch (error) {
    self.postMessage({
      id: request.id,
      ok: false,
      error: normalizeError(error),
    } satisfies WasmWorkerResponse);
  }
});

async function runTask(task: string, args: Record<string, unknown>): Promise<unknown> {
  switch (task) {
    case "grep":
      return grepDocuments(args);
    case "tokenize":
      return tokenizeText(args);
    case "embed":
      return embedText(args);
    case "transcode":
      return transcodeText(args);
    default:
      throw new Error(`Unsupported WASM task: ${task}`);
  }
}

function grepDocuments(args: Record<string, unknown>): unknown {
  const query = String(args.query ?? "TODO");
  const documents = normalizeDocuments(args.documents);
  const matches: Array<{ path: string; line: number; text: string }> = [];

  for (const document of documents) {
    const lines = document.text.split(/\r?\n/);
    lines.forEach((line, index) => {
      if (line.includes(query)) {
        matches.push({ path: document.path, line: index + 1, text: line.trim() });
      }
    });
  }

  return {
    task: "grep",
    query,
    matches,
    summary: matches.length === 0 ? `No ${query} matches found.` : `Found ${matches.length} ${query} match(es).`,
  };
}

function tokenizeText(args: Record<string, unknown>): unknown {
  const text = String(args.text ?? "");
  const tokens = text.trim() === "" ? [] : text.trim().split(/\s+/);
  return {
    task: "tokenize",
    tokens,
    count: tokens.length,
  };
}

function embedText(args: Record<string, unknown>): unknown {
  const text = String(args.text ?? "");
  const vector = Array.from(text.slice(0, 16)).map((char, index) => (char.charCodeAt(0) + index) % 17);
  return {
    task: "embed",
    dimensions: vector.length,
    vector,
  };
}

function transcodeText(args: Record<string, unknown>): unknown {
  const text = String(args.text ?? "");
  return {
    task: "transcode",
    summary: `Transcoded ${text.length} characters`,
    output: text.toUpperCase(),
  };
}

function normalizeDocuments(input: unknown): DocumentInput[] {
  if (!Array.isArray(input)) {
    return [];
  }

  return input
    .map((item) => {
      if (typeof item !== "object" || item === null) {
        return null;
      }
      const candidate = item as Partial<DocumentInput>;
      if (typeof candidate.path !== "string" || typeof candidate.text !== "string") {
        return null;
      }
      return { path: candidate.path, text: candidate.text };
    })
    .filter((item): item is DocumentInput => item !== null);
}

function normalizeError(error: unknown): { code: string; message: string } {
  if (error instanceof Error) {
    return { code: "WASM_ERROR", message: error.message };
  }
  return { code: "WASM_ERROR", message: "Unknown WASM failure" };
}

export {};
