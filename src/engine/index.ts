// Public API of the internal engine module. Framework-agnostic, no React deps.
export * from "./types";
export * from "./registry";
export * from "./prng";
export * from "./palettes";
export * from "./color";
export * from "./sharedParams";
export * from "./effects";
export * from "./render";

// Self-register the built-in engines (blob/grid/waves/orb).
import "./engines";
