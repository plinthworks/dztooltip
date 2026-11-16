/**
 * @dztooltip/core/internal — the engine's pieces for this repository's own packages (the DzGrid bridge, the GSAP
 * entry). No semver promise: an application imports `@dztooltip/core`.
 */
export { place, reveal, hideBubble, tips, Tooltip, type TipControl, type TipFor } from './bubble.js';
export { closing, conceal, dress, enhance, forget, opening, play, shapeOf } from './engine.js';
export { FLOAT_CSS, dirAt, drawn, floatStyles, keyed, pageOf, schemeOf, wanted } from './float.js';
export { logicalBox, placementOf, type Dir } from './dir.js';
export { Scope } from './scope.js';
export { describe, setAttr, setPx } from './write.js';
export { cutText } from './tooltip.js';
export { absent, isAnchor, rootFor, track } from './follow.js';
