import type { AnyEngine } from "./types";

// Holds the union of 2D field engines and WebGL engines. 2D engines keep
// registering exactly as before — FieldEngine is assignable to AnyEngine.
const registry = new Map<string, AnyEngine>();

export function registerEngine(e: AnyEngine): void {
  registry.set(e.id, e);
}

export function getEngine(id: string): AnyEngine | undefined {
  return registry.get(id);
}

export function listEngines(): AnyEngine[] {
  return Array.from(registry.values());
}
