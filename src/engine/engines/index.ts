// Importing each engine triggers its self-registration side effect.
import "./blob";
import "./grid";
import "./waves";
import "./orb";
// 3D/WebGL engine "orb3d" is intentionally NOT registered (hidden from the
// selector). The dormant code remains in src/engine/engines/orb3d.ts and
// src/components/canvas/WebGLStage.tsx if it's ever wanted back.
// import "./orb3d";
