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
  meta?: Record<string, unknown>;
}

self.addEventListener("message", async (event: MessageEvent<OpfsWorkerRequest>) => {
  const request = event.data;

  try {
    const output = await runOpfsTask(request.task, request.args);
    self.postMessage({
      id: request.id,
      ok: true,
      output,
      meta: { backend: "opfs", task: request.task },
    } satisfies OpfsWorkerResponse);
  } catch (error) {
    self.postMessage({
      id: request.id,
      ok: false,
      error: normalizeError(error),
    } satisfies OpfsWorkerResponse);
  }
});

async function runOpfsTask(task: OpfsWorkerRequest["task"], args: Record<string, unknown>): Promise<unknown> {
  const root = await getRootDirectory();

  switch (task) {
    case "list_dir":
      return await listDirectory(root, String(args.path ?? "/"), toNumber(args.limit, 100));
    case "read_text":
      return await readTextFile(root, String(args.path ?? ""), toNumber(args.max_bytes, 1_048_576));
    case "write_text":
      return await writeTextFile(root, String(args.path ?? ""), String(args.text ?? ""));
    default:
      throw new Error(`Unsupported OPFS task: ${task}`);
  }
}

async function getRootDirectory(): Promise<FileSystemDirectoryHandle> {
  const storage = navigator.storage;
  if (!storage || typeof storage.getDirectory !== "function") {
    throw new Error("OPFS is not available in this browser context");
  }
  return await storage.getDirectory();
}

async function listDirectory(root: FileSystemDirectoryHandle, path: string, limit: number): Promise<unknown> {
  const dir = await resolveDirectory(root, path);
  const entries: string[] = [];
  const iterable = dir as unknown as AsyncIterable<[string, FileSystemHandle]>;
  for await (const [name] of iterable) {
    entries.push(String(name));
    if (entries.length >= limit) {
      break;
    }
  }

  return {
    path: normalizePath(path),
    entries,
    truncated: entries.length >= limit,
    opfs: {
      root: "navigator.storage.getDirectory",
      listed: entries.length,
    },
  };
}

async function readTextFile(root: FileSystemDirectoryHandle, path: string, maxBytes: number): Promise<unknown> {
  const fileHandle = await resolveFile(root, path);
  const file = await fileHandle.getFile();
  const bytes = file.slice(0, maxBytes);
  const text = await bytes.text();

  return {
    path: normalizePath(path),
    text,
    truncated: file.size > maxBytes,
    opfs: {
      root: "navigator.storage.getDirectory",
      bytes_read: Math.min(file.size, maxBytes),
      file_size: file.size,
    },
  };
}

async function writeTextFile(root: FileSystemDirectoryHandle, path: string, text: string): Promise<unknown> {
  const fileHandle = await resolveFile(root, path, true);
  const writable = await fileHandle.createWritable();
  await writable.write(text);
  await writable.close();

  return {
    path: normalizePath(path),
    bytes_written: new TextEncoder().encode(text).byteLength,
    opfs: {
      root: "navigator.storage.getDirectory",
      created_or_updated: true,
      write_path: normalizePath(path),
    },
  };
}

async function resolveDirectory(root: FileSystemDirectoryHandle, path: string): Promise<FileSystemDirectoryHandle> {
  let current = root;
  for (const segment of splitPath(path)) {
    current = await current.getDirectoryHandle(segment, { create: true });
  }
  return current;
}

async function resolveFile(root: FileSystemDirectoryHandle, path: string, create = false): Promise<FileSystemFileHandle> {
  const segments = splitPath(path);
  const fileName = segments.pop();
  if (!fileName) {
    throw new Error(`Invalid OPFS file path: ${path}`);
  }

  const dir = await resolveDirectory(root, segments.join("/"));
  return await dir.getFileHandle(fileName, { create });
}

function splitPath(path: string): string[] {
  return normalizePath(path)
    .split("/")
    .filter(Boolean);
}

function normalizePath(path: string): string {
  if (!path) {
    return "/";
  }
  return path.startsWith("/") ? path : `/${path}`;
}

function toNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function normalizeError(error: unknown): { code: string; message: string } {
  if (error instanceof Error) {
    return { code: "OPFS_ERROR", message: error.message };
  }
  return { code: "OPFS_ERROR", message: "Unknown OPFS failure" };
}

export {};
