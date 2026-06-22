import type { FieldEngine } from "./types";

// Holds the registered 2D field engines, keyed by id.
const registry = new Map<string, FieldEngine>();

export function registerEngine(e: FieldEngine): void {
  registry.set(e.id, e);
}

export function getEngine(id: string): FieldEngine | undefined {
  return registry.get(id);
}

export function listEngines(): FieldEngine[] {
  return Array.from(registry.values());
}
