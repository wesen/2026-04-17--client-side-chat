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

type DemoWasmRuntime = {
  instance: WebAssembly.Instance;
  moduleBytes: number;
  exports: string[];
  initMs: number;
};

const wasmRuntimePromise = initializeDemoWasmRuntime();

self.addEventListener("message", async (event: MessageEvent<WasmWorkerRequest>) => {
  const request = event.data;

  try {
    const runtime = await wasmRuntimePromise;
    const output = await runTask(request.task, request.args, runtime);
    self.postMessage({
      id: request.id,
      ok: true,
      output,
      meta: {
        backend: "wasm",
        task: request.task,
        wasm: runtimeSummary(runtime),
      },
    } satisfies WasmWorkerResponse);
  } catch (error) {
    self.postMessage({
      id: request.id,
      ok: false,
      error: normalizeError(error),
    } satisfies WasmWorkerResponse);
  }
});

async function initializeDemoWasmRuntime(): Promise<DemoWasmRuntime> {
  const started = performance.now();
  const bytes = createDemoWasmBytes();
  const { instance } = await WebAssembly.instantiate(bytes, {});
  const runtime: DemoWasmRuntime = {
    instance,
    moduleBytes: bytes.byteLength,
    exports: Object.keys(instance.exports),
    initMs: performance.now() - started,
  };
  console.info("[wasm.worker] demo wasm module initialized", runtimeSummary(runtime));
  return runtime;
}

async function runTask(task: string, args: Record<string, unknown>, runtime: DemoWasmRuntime): Promise<unknown> {
  switch (task) {
    case "grep":
      return grepDocuments(args, runtime);
    case "tokenize":
      return tokenizeText(args, runtime);
    case "embed":
      return embedText(args, runtime);
    case "transcode":
      return transcodeText(args, runtime);
    default:
      throw new Error(`Unsupported WASM task: ${task}`);
  }
}

function grepDocuments(args: Record<string, unknown>, runtime: DemoWasmRuntime): unknown {
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

  const add = getAddExport(runtime);
  const sample = add(matches.length, query.length);

  return {
    task: "grep",
    query,
    matches,
    summary: matches.length === 0 ? `No ${query} matches found.` : `Found ${matches.length} ${query} match(es).`,
    wasm_sample: sample,
  };
}

function tokenizeText(args: Record<string, unknown>, runtime: DemoWasmRuntime): unknown {
  const text = String(args.text ?? "");
  const tokens = text.trim() === "" ? [] : text.trim().split(/\s+/);
  const add = getAddExport(runtime);
  return {
    task: "tokenize",
    tokens,
    count: tokens.length,
    wasm_sample: add(tokens.length, text.length),
  };
}

function embedText(args: Record<string, unknown>, runtime: DemoWasmRuntime): unknown {
  const text = String(args.text ?? "");
  const vector = Array.from(text.slice(0, 16)).map((char, index) => (char.charCodeAt(0) + index) % 17);
  const add = getAddExport(runtime);
  return {
    task: "embed",
    dimensions: vector.length,
    vector,
    wasm_sample: add(vector.length, text.length),
  };
}

function transcodeText(args: Record<string, unknown>, runtime: DemoWasmRuntime): unknown {
  const text = String(args.text ?? "");
  const add = getAddExport(runtime);
  return {
    task: "transcode",
    summary: `Transcoded ${text.length} characters`,
    output: text.toUpperCase(),
    wasm_sample: add(text.length, 1),
  };
}

function getAddExport(runtime: DemoWasmRuntime): (left: number, right: number) => number {
  const add = runtime.instance.exports["add"];
  if (typeof add !== "function") {
    throw new Error("demo wasm module is missing the add export");
  }
  return add as (left: number, right: number) => number;
}

function runtimeSummary(runtime: DemoWasmRuntime): Record<string, unknown> {
  return {
    module_bytes: runtime.moduleBytes,
    exports: runtime.exports,
    init_ms: Number(runtime.initMs.toFixed(2)),
  };
}

function createDemoWasmBytes(): Uint8Array {
  return new Uint8Array([
    0x00, 0x61, 0x73, 0x6d,
    0x01, 0x00, 0x00, 0x00,
    0x01, 0x07, 0x01, 0x60, 0x02, 0x7f, 0x7f, 0x01, 0x7f,
    0x03, 0x02, 0x01, 0x00,
    0x07, 0x07, 0x01, 0x03, 0x61, 0x64, 0x64, 0x00, 0x00,
    0x0a, 0x09, 0x01, 0x07, 0x00, 0x20, 0x00, 0x20, 0x01, 0x6a, 0x0b,
  ]);
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
