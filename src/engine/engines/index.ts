// Importing each engine triggers its self-registration side effect.
import "./blob";
import "./grid";
import "./waves";
import "./orb";
// WebGL engine — registers a DATA-ONLY descriptor (no three import here).
import "./orb3d";
