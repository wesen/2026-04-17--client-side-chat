import type { ToolManifest } from "./contracts";
import {
  createOpfsListDirExecutor,
  createOpfsReadTextExecutor,
  createOpfsWriteTextExecutor,
} from "./opfs-executors";
import { createWasmTaskExecutor } from "./wasm-executors";

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

function withSummary(toolName: string, executor: ToolExecutor): ToolExecutor {
  return async (args) => {
    const output = await executor(args);
    if (typeof output === "object" && output !== null) {
      return output;
    }
    return {
      tool: toolName,
      value: output,
    };
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
    execute: withSummary("opfs.list_dir", createOpfsListDirExecutor()),
  });

  registry.register({
    manifest: {
      name: "opfs.read_text",
      description: "Read a UTF-8 file from OPFS.",
      execution: "client",
      visibility: "model_visible",
      capability: "opfs",
    },
    execute: withSummary("opfs.read_text", createOpfsReadTextExecutor()),
  });

  registry.register({
    manifest: {
      name: "opfs.write_text",
      description: "Write a UTF-8 file into OPFS.",
      execution: "client",
      visibility: "local_only",
      capability: "opfs",
    },
    execute: withSummary("opfs.write_text", createOpfsWriteTextExecutor()),
  });

  registry.register({
    manifest: {
      name: "wasm.run_task",
      description: "Run a deterministic local WASM task.",
      execution: "client",
      visibility: "local_only",
      capability: "wasm_worker",
    },
    execute: withSummary("wasm.run_task", createWasmTaskExecutor()),
  });

  return registry;
}
