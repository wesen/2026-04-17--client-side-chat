import type { ToolManifest } from "./contracts";

export type ToolExecutor = (args: Record<string, unknown>) => Promise<unknown>;

export interface ToolDefinition {
  manifest: ToolManifest;
  execute: ToolExecutor;
}

export class ToolRegistry {
  private readonly tools = new Map<string, ToolDefinition>();

  register(definition: ToolDefinition): void {
    this.tools.set(definition.manifest.name, definition);
  }

  get(name: string): ToolDefinition | undefined {
    return this.tools.get(name);
  }

  list(): ToolManifest[] {
    return [...this.tools.values()].map((definition) => definition.manifest);
  }
}

function notImplemented(toolName: string): ToolExecutor {
  return async () => {
    throw new Error(`${toolName} is scaffolded but not yet wired to browser capabilities`);
  };
}

export function createDefaultToolRegistry(): ToolRegistry {
  const registry = new ToolRegistry();

  registry.register({
    manifest: {
      name: "opfs.list_dir",
      description: "List a directory in OPFS.",
      execution: "client",
      visibility: "model_visible",
      capability: "opfs",
    },
    execute: notImplemented("opfs.list_dir"),
  });

  registry.register({
    manifest: {
      name: "opfs.read_text",
      description: "Read a UTF-8 file from OPFS.",
      execution: "client",
      visibility: "model_visible",
      capability: "opfs",
    },
    execute: notImplemented("opfs.read_text"),
  });

  registry.register({
    manifest: {
      name: "opfs.write_text",
      description: "Write a UTF-8 file into OPFS.",
      execution: "client",
      visibility: "local_only",
      capability: "opfs",
    },
    execute: notImplemented("opfs.write_text"),
  });

  registry.register({
    manifest: {
      name: "wasm.run_task",
      description: "Run a deterministic local WASM task.",
      execution: "client",
      visibility: "local_only",
      capability: "wasm_worker",
    },
    execute: notImplemented("wasm.run_task"),
  });

  return registry;
}
