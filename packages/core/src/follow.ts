import { boxOfRect, type Box } from './dir.js';
import { Ears } from './write.js';
import { boxOf, contextOf, docOf, framesUp, isElement, ownBox, rootFor, type Anchor } from './anchor.js';

/**
 * Following a bubble's anchor while it is on screen (tooltips-popovers.md 27, 28, 34, 39): what can move or hide the
 * anchor with no scroll is watched — its size and the bubble's (`ResizeObserver`), its place (an `IntersectionObserver`
 * fitted to its box, fitted again after each change), the window's size, a scroll anywhere, nodes added to or taken
 * from the page; with `everyFrame`, its box at every frame — and `changed` is called once at the next frame however
 * many things moved. Made when the bubble shows, taken down when it closes: nothing runs while it is closed.
 */

/** The ratios an anchor's move crosses: its box leaving the fitted one by a pixel is a crossing. */
const STEPS = Array.from({ length: 101 }, (_, i) => i / 100);

/**
 * The anchor left the page or is no longer drawn (`display: none` on it or around it, `visibility: hidden`); a virtual
 * one (38): its element did, or its rectangle can no longer be read.
 */
export const absent = (a: Anchor): boolean => {
  const c = contextOf(a);
  if (c && (!c.isConnected || (typeof c.checkVisibility === 'function' && !c.checkVisibility({ visibilityProperty: true })))) return true;
  return !isElement(a) && !ownBox(a);
};

/** What a bubble was last placed by (`place()` writes it): its anchor's box on the bubble's screen, its size, the window's. */
export interface Placed {
  readonly box: Box;
  readonly w: number;
  readonly h: number;
  readonly W: number;
  readonly H: number;
}
export const placed = new WeakMap<HTMLElement, Placed>();

const same = (p: Placed | undefined, anchor: Anchor, bubble: HTMLElement, win: Window): boolean => {
  if (!p) return false;
  const r = boxOf(anchor, bubble.ownerDocument);
  const q = p.box;
  return !!r && r.bs === q.bs && r.be === q.be && r.is === q.is && r.ie === q.ie &&
    bubble.offsetWidth === p.w && bubble.offsetHeight === p.h && win.innerWidth === p.W && win.innerHeight === p.H;
};

/**
 * Watches `anchor` and `bubble` (call it right after placing the bubble); `changed()` at the next frame after a change
 * — the anchor's box, the bubble's size or the window's no longer what it was placed by, the anchor gone, or `stale()`
 * (a grid row recycled; `attrs`: the attributes whose change is watched for it, a row's `aria-rowindex`). Nothing is
 * measured when it is placed (the box it was placed by is kept), so following costs no layout of its own; `every`:
 * the anchor's box read at every frame too (39). An anchor in a frame under the bubble's document (34): both documents
 * and the frames between are heard. Returns the stop.
 */
export function track(anchor: Anchor, bubble: HTMLElement, changed: () => void, stale?: () => boolean, attrs: readonly string[] = [], every = false): () => void {
  const doc = bubble.ownerDocument;
  const win = doc.defaultView;
  if (!win) return () => {};
  const ctx = contextOf(anchor);
  const own = ctx?.ownerDocument ?? doc;
  const frames = own === doc ? [] : (framesUp(own, doc) ?? []);
  let live = true;
  let frame = 0;
  let loop = 0;
  let io: IntersectionObserver | null = null;
  let fitted = '';
  const ears = new Ears();
  const check = (): void => {
    if (stale?.() || absent(anchor) || !same(placed.get(bubble), anchor, bubble, win)) changed();
  };
  const run = (): void => {
    frame = 0;
    if (!live) return;
    check();
    if (live) fit();
  };
  const soon = (): void => {
    if (live && !frame) frame = win.requestAnimationFrame(run);
  };
  /** An observer whose root is the anchor's element's box: any move of it changes how much of it is inside. */
  const fit = (): void => {
    const IO = win.IntersectionObserver;
    // Its element's box: the one it was placed by, or (a piece, a point, a virtual anchor) read here.
    const r = !ctx || own !== doc ? null : ctx === anchor ? placed.get(bubble)?.box : boxOfRect(ctx.getBoundingClientRect());
    if (!IO || !r || !ctx?.isConnected) return;
    const de = doc.documentElement;
    const W = de.clientWidth || win.innerWidth;
    const H = de.clientHeight || win.innerHeight;
    // The screen's own sides (left to right whatever the page's direction), rounded outward.
    const [t, s, b, e] = [Math.floor(r.bs), Math.floor(r.is), Math.ceil(r.be), Math.ceil(r.ie)];
    // Its insets in CSS's order: block start, the screen's end, block end, its start.
    const margin = `${-t}px ${-(W - e)}px ${-(H - b)}px ${-s}px`;
    if (io && margin === fitted) return;
    io?.disconnect();
    io = null;
    if (r.ie - r.is <= 0 && r.be - r.bs <= 0) return;
    fitted = margin;
    // Its first report says how it is now: not a change.
    let first = true;
    io = new IO(() => (first ? (first = false) : soon()), { rootMargin: margin, threshold: STEPS });
    io.observe(ctx);
  };
  const opts = { passive: true };
  const docs = new Set<Document>([doc, own, ...frames.map((f) => f.ownerDocument)]);
  const stops: { disconnect(): void }[] = [];
  for (const d of docs) {
    const w = d.defaultView;
    if (!w) continue;
    ears.on(w, 'resize', soon, opts);
    ears.on(d, 'scroll', soon, { ...opts, capture: true });
    const RO = w.ResizeObserver;
    const ro = RO ? new RO(soon) : null;
    for (const e of [d === own ? ctx : null, d === doc ? bubble : null, ...frames.filter((f) => f.ownerDocument === d)]) if (e && ro) ro.observe(e);
    const MO = w.MutationObserver;
    // Nodes added or taken (the anchor's own removal), a watched attribute changed.
    const mo = MO ? new MO(soon) : null;
    mo?.observe(d.documentElement, { subtree: true, childList: true, ...(attrs.length && { attributeFilter: [...attrs] }) });
    for (const o of [ro, mo]) if (o) stops.push(o);
  }
  // Every frame while shown (39): one box read, placed only when it moved.
  const tick = (): void => {
    loop = 0;
    if (!live) return;
    check();
    if (live) loop = win.requestAnimationFrame(tick);
  };
  if (every) loop = win.requestAnimationFrame(tick);
  fit();
  return () => {
    live = false;
    if (frame) win.cancelAnimationFrame(frame);
    if (loop) win.cancelAnimationFrame(loop);
    frame = loop = 0;
    ears.off();
    for (const o of stops) o.disconnect();
    io?.disconnect();
    io = null;
  };
}

/**
 * A bubble's anchor (28, 38): an element, or a virtual anchor (an object with `getBoundingClientRect`) in a page;
 * anything else is refused, reported once.
 */
export function isAnchor(el: unknown, path: string): el is Anchor {
  const ok = isElement(el) || (!!el && typeof el === 'object' && typeof (el as { getBoundingClientRect?: unknown }).getBoundingClientRect === 'function' && !!docOf(el as Anchor)?.defaultView);
  if (!ok) {
    const err = new TypeError(`dztooltip: not-an-element — ${path} takes an element or a virtual anchor`);
    const g = globalThis as { reportError?: (e: unknown) => void; console?: { error(e: unknown): void } };
    if (typeof g.reportError === 'function') g.reportError(err);
    else g.console?.error(err);
  }
  return ok;
}

export { rootFor };
