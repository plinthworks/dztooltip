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

/** A box on the screen, its own sides whatever the reading direction: inline start and end from the screen's left. */
export interface Box {
  readonly is: number;
  readonly ie: number;
  readonly bs: number;
  readonly be: number;
}

/** A point on the screen (a pointer's), the same way. */
export interface Pt {
  readonly i: number;
  readonly b: number;
}

const num = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/**
 * A rectangle as a screen box (tooltips-popovers.md 38): a `DOMRect`, or a virtual anchor's plain object (`left`/`top`
 * with `right`/`bottom` or `width`/`height`, or `x`/`y`). Null when it is not one (missing or not finite numbers).
 */
export function boxOfRect(r: unknown): Box | null {
  if (!r || typeof r !== 'object') return null;
  const o = r as Partial<Record<'left' | 'top' | 'right' | 'bottom' | 'width' | 'height' | 'x' | 'y', unknown>>;
  const is = num(o.left) ? o.left : o.x;
  const bs = num(o.top) ? o.top : o.y;
  if (!num(is) || !num(bs)) return null;
  const ie = num(o.right) ? o.right : num(o.width) ? is + o.width : null;
  const be = num(o.bottom) ? o.bottom : num(o.height) ? bs + o.height : null;
  return ie === null || be === null ? null : { is, ie: Math.max(is, ie), bs, be: Math.max(bs, be) };
}

/** A screen box as a `DOMRect`-like object (what a virtual anchor's `getBoundingClientRect()` answers). */
export function rectOfBox(b: Box): DOMRectReadOnly {
  const r = { left: b.is, right: b.ie, top: b.bs, bottom: b.be, x: b.is, y: b.bs, width: b.ie - b.is, height: b.be - b.bs };
  return { ...r, toJSON: () => r } as DOMRectReadOnly;
}

/** A pointer event's point on the screen of its own window. */
export const pointOf = (e: { readonly clientX: number; readonly clientY: number }): Pt => ({ i: e.clientX, b: e.clientY });

/** A screen box in a direction's logical terms (its inline start measured from the window's start edge). */
export const logicalOf = (b: Box, dir: Dir, windowInline: number): Box => (dir === 'ltr' ? b : { is: windowInline - b.ie, ie: windowInline - b.is, bs: b.bs, be: b.be });

/**
 * Where a frame's content starts in its parent's window (34): the frame's box, its border and its padding. The
 * content's coordinates plus this are the parent's.
 */
export function frameStart(frame: Element): Pt {
  const r = frame.getBoundingClientRect();
  const cs = frame.ownerDocument.defaultView?.getComputedStyle(frame);
  return { i: r.left + frame.clientLeft + (parseFloat(cs?.paddingLeft ?? '') || 0), b: r.top + frame.clientTop + (parseFloat(cs?.paddingTop ?? '') || 0) };
}
