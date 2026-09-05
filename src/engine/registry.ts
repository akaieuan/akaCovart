import type { EngineFocus, FieldEngine } from "./types";

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

// Engines for a given creative focus, in registration order. Untagged engines
// count as "art" so the default roster is unaffected. Takes EngineFocus, not
// Focus: "stack" is a composite lane with no engines of its own — ask
// `enginesFor("stack")` (components/studio/focus.ts) for that roster instead.
export function listEnginesByFocus(focus: EngineFocus): FieldEngine[] {
  return listEngines().filter((e) => (e.focus ?? "art") === focus);
}
