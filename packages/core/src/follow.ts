import { logicalBox } from './dir.js';

/**
 * Following a bubble's anchor while it is on screen (tooltips-popovers.md 27, 28): what can move or hide the anchor with
 * no scroll is watched — its size and the bubble's (`ResizeObserver`), its place (an `IntersectionObserver` fitted to its
 * box, fitted again after each change), the window's size, a scroll anywhere, nodes added to or taken from the page —
 * and `changed` is called once at the next frame however many things moved. Made when the bubble shows, taken down
 * when it closes: nothing runs while it is closed.
 */

/** The ratios an anchor's move crosses: its box leaving the fitted one by a pixel is a crossing. */
const STEPS = Array.from({ length: 101 }, (_, i) => i / 100);

/** The anchor left the page or is no longer drawn (`display: none` on it or around it, `visibility: hidden`). */
export const absent = (a: Element): boolean =>
  !a.isConnected || (typeof a.checkVisibility === 'function' && !a.checkVisibility({ visibilityProperty: true }));

/** What a bubble was last placed by (`place()` writes it): its anchor's box, its size, the window's. */
export interface Placed {
  readonly box: DOMRectReadOnly;
  readonly w: number;
  readonly h: number;
  readonly W: number;
  readonly H: number;
}
export const placed = new WeakMap<HTMLElement, Placed>();

const same = (p: Placed | undefined, anchor: Element, bubble: HTMLElement, win: Window): boolean => {
  if (!p) return false;
  const [r, q] = [anchor.getBoundingClientRect(), p.box].map((x) => logicalBox(x, 'ltr', 0)) as [ReturnType<typeof logicalBox>, ReturnType<typeof logicalBox>];
  return r.bs === q.bs && r.be === q.be && r.is === q.is && r.ie === q.ie &&
    bubble.offsetWidth === p.w && bubble.offsetHeight === p.h && win.innerWidth === p.W && win.innerHeight === p.H;
};

/**
 * Watches `anchor` and `bubble` (call it right after placing the bubble); `changed()` at the next frame after a change
 * — the anchor's box, the bubble's size or the window's no longer what it was placed by, the anchor gone, or `stale()`
 * (a grid row recycled; `attrs`: the attributes whose change is watched for it, a row's `aria-rowindex`). Nothing is measured when it is placed (the box it was placed by is
 * kept), so following costs no layout of its own. Returns the stop.
 */
export function track(anchor: Element, bubble: HTMLElement, changed: () => void, stale?: () => boolean, attrs: readonly string[] = []): () => void {
  const doc = bubble.ownerDocument;
  const win = doc.defaultView;
  if (!win) return () => {};
  let live = true;
  let frame = 0;
  let io: IntersectionObserver | null = null;
  let fitted = '';
  const ac = new AbortController();
  const run = (): void => {
    frame = 0;
    if (!live) return;
    if (stale?.() || absent(anchor) || !same(placed.get(bubble), anchor, bubble, win)) changed();
    if (live) fit();
  };
  const soon = (): void => {
    if (live && !frame) frame = win.requestAnimationFrame(run);
  };
  /** An observer whose root is the anchor's box: any move of the anchor changes how much of it is inside. */
  const fit = (): void => {
    const IO = win.IntersectionObserver;
    const r = placed.get(bubble)?.box;
    if (!IO || !r || !anchor.isConnected) return;
    const de = doc.documentElement;
    const W = de.clientWidth || win.innerWidth;
    const H = de.clientHeight || win.innerHeight;
    // The screen's own sides (left to right whatever the page's direction), rounded outward.
    const x = logicalBox(r, 'ltr', W);
    const [t, s, b, e] = [Math.floor(x.bs), Math.floor(x.is), Math.ceil(x.be), Math.ceil(x.ie)];
    // Its insets in CSS's order: block start, the screen's end, block end, its start.
    const margin = `${-t}px ${-(W - e)}px ${-(H - b)}px ${-s}px`;
    if (io && margin === fitted) return;
    io?.disconnect();
    io = null;
    if (r.width <= 0 && r.height <= 0) return;
    fitted = margin;
    // Its first report says how it is now: not a change.
    let first = true;
    io = new IO(() => (first ? (first = false) : soon()), { rootMargin: margin, threshold: STEPS });
    io.observe(anchor);
  };
  const opts = { signal: ac.signal, passive: true };
  win.addEventListener('resize', soon, opts);
  doc.addEventListener('scroll', soon, { ...opts, capture: true });
  const RO = win.ResizeObserver;
  const ro = RO ? new RO(soon) : null;
  ro?.observe(anchor);
  ro?.observe(bubble);
  const MO = win.MutationObserver;
  // Nodes added or taken (the anchor's own removal), a watched attribute changed.
  const mo = MO ? new MO(soon) : null;
  mo?.observe(doc.documentElement, { subtree: true, childList: true, ...(attrs.length && { attributeFilter: [...attrs] }) });
  fit();
  return () => {
    live = false;
    if (frame) win.cancelAnimationFrame(frame);
    frame = 0;
    ac.abort();
    ro?.disconnect();
    mo?.disconnect();
    io?.disconnect();
    io = null;
  };
}

/** A bubble's anchor that is an element; anything else is refused (28: virtual anchors later, owner B), reported once. */
export function isAnchor(el: unknown, path: string): el is HTMLElement {
  const ok = !!el && typeof el === 'object' && (el as Node).nodeType === 1 && !!(el as Node).ownerDocument;
  if (!ok) {
    const err = new TypeError(`dztooltip: not-an-element — ${path} takes an element (a virtual anchor is not supported yet)`);
    const g = globalThis as { reportError?: (e: unknown) => void; console?: { error(e: unknown): void } };
    if (typeof g.reportError === 'function') g.reportError(err);
    else g.console?.error(err);
  }
  return ok;
}

/** Where a bubble goes in the page (30): the root given, the open `<dialog>` its anchor sits in, or the page's end. */
export const rootFor = (anchor: Element, root: Element | null | undefined): Element =>
  root ?? anchor.closest('dialog[open]') ?? anchor.ownerDocument.body;
