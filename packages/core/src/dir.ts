import type { TipAlign, TipSide } from './types.js';

/**
 * The one file that names physical sides (a test guards it): everything else speaks of the line's start and end, and
 * of the block's start and end.
 */

/**
 * Where a tooltip or a popover opens (tooltips-popovers.md 4): a side — `top`, `bottom`, `start`, `end` (the line's
 * start and end: mirrored in right to left), or `left`, `right` (the screen's, whatever the direction) — and an
 * alignment along it (`-start`, `-end`; none: centred). `auto`: the default (below and centred).
 */
export type TooltipPlacement = 'auto' | `${'top' | 'bottom' | 'start' | 'end' | 'left' | 'right'}${'' | '-start' | '-end'}`;

/** The reading direction. */
export type Dir = 'ltr' | 'rtl';

/**
 * A box in the window's logical coordinates (tooltips-popovers.md 4): its inline start and end measured from the
 * window's start edge (the left in left to right, the right in right to left), its block start and end from the top.
 */
export function logicalBox(r: Pick<DOMRectReadOnly, 'left' | 'right' | 'top' | 'bottom'>, dir: Dir, windowInline: number): { is: number; ie: number; bs: number; be: number } {
  return dir === 'ltr' ? { is: r.left, ie: r.right, bs: r.top, be: r.bottom } : { is: windowInline - r.right, ie: windowInline - r.left, bs: r.top, be: r.bottom };
}

/**
 * A placement as a logical side and an alignment (tooltips-popovers.md 4): `left` and `right` are the screen's, so they
 * turn into the line's start or end by the direction here; `start` and `end` are the line's; `-start` / `-end` align the
 * bubble with the anchor's start or end along the other axis, none centres it.
 */
export function placementOf(p: TooltipPlacement | undefined, dir: Dir, auto: TooltipPlacement): readonly [TipSide, TipAlign] {
  const [s, a] = (!p || p === 'auto' ? auto : p).split('-') as [string, string | undefined];
  const side = s === 'left' ? (dir === 'ltr' ? 'start' : 'end') : s === 'right' ? (dir === 'ltr' ? 'end' : 'start') : s;
  return [side === 'top' ? 'block-start' : side === 'bottom' ? 'block-end' : (`inline-${side}` as TipSide), a === 'start' ? -1 : a === 'end' ? 1 : 0];
}
