// Importing each engine triggers its self-registration side effect.
// Registration order here is the order shown in the engine selector.
// Art focus (abstract field engines):
import "./blob";
import "./grid";
import "./contours";
import "./signal";
// TxT focus (type-driven engines):
import "./dither";
import "./lines";
import "./blur";
