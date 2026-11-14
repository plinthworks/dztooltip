export type { TooltipPlacement } from './dir.js';

/** A bubble's tone (tooltips-popovers.md 6): `info` is the plain dark bubble. */
export type TipTone = 'info' | 'neutral' | 'success' | 'warning' | 'danger';
/** Its opening and closing (7): CSS presets of `@dztooltip/theme`; `pop`, `rise` and `morph` the richer ones. */
export type TipAnimation = 'fade' | 'scale' | 'slide' | 'pop' | 'rise' | 'none' | 'morph';
/** The side it opens on, logical (4). */
export type TipSide = 'block-end' | 'block-start' | 'inline-end' | 'inline-start';
/** Along the other axis: at the anchor's start (-1), its middle (0), its end (1). */
export type TipAlign = -1 | 0 | 1;
