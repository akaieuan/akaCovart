import type { WebGLEngine } from "../types";
import { registerEngine } from "../registry";

// 3D (WebGL/Three.js) engine — DATA ONLY descriptor. No three / r3f imports
// here; the rendering lives in the dynamically-imported (ssr:false) WebGLStage,
// matched by `id`. P0 has no params yet (basic rotating sphere).
const orb3d: WebGLEngine = {
  id: "orb3d",
  label: "3D",
  kind: "webgl",
  params: [],
};

registerEngine(orb3d);

export default orb3d;
