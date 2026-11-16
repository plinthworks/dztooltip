import { boxOfRect, pointOf, type Box, type Pt } from './dir.js';
import { shiftTo } from './anchor.js';
import { Ears } from './write.js';

/**
 * The way from an anchor to its bubble (tooltips-popovers.md 35, a safe triangle): once the pointer has left the
 * anchor at `from`, the bubble stays while the pointer is in the smallest shape holding that point and the bubble's
 * box (a few pixels wider) — any straight way to any point of the bubble lies in it. `out()` when the pointer leaves
 * it, leaves the window, or rests in it 400 ms without reaching the bubble; reaching the bubble or the anchor (`back`)
 * just ends it. Points are moved to the bubble's screen when the anchor is in a frame below it (34). Returns the stop;
 * nothing is listened to once it ended.
 */
export function safeZone(from: Pt, fromDoc: Document, bubble: HTMLElement, back: () => Box | null, out: () => void): () => void {
  const bdoc = bubble.ownerDocument;
  const win = bdoc.defaultView;
  if (!win) return (out(), () => {});
  const ears = new Ears();
  let rest = 0;
  let live = true;
  const stop = (): void => {
    if (!live) return;
    live = false;
    ears.off();
    win.clearTimeout(rest);
  };
  const leave = (): void => {
    if (!live) return;
    stop();
    out();
  };
  const onScreen = (p: Pt, d: Document): Pt | null => {
    const s = shiftTo(d, bdoc);
    return s ? { i: p.i + s.i, b: p.b + s.b } : null;
  };
  const p0 = onScreen(from, fromDoc);
  if (!p0) return (leave(), () => {});
  const restart = (): void => {
    win.clearTimeout(rest);
    rest = win.setTimeout(leave, 400);
  };
  const move = (e: Event): void => {
    if (!live) return;
    if (bubble.hidden || !bubble.isConnected) return stop();
    const d = (e.target as Node | null)?.ownerDocument ?? bdoc;
    const q = onScreen(pointOf(e as PointerEvent), d);
    if (!q) return;
    const b = boxOfRect(bubble.getBoundingClientRect());
    const a = back();
    if (!b || inBox(b, q, 0) || (a && inBox(a, q, 0))) return stop();
    if (inHull(p0, grow(b, 4), q)) restart();
    else leave();
  };
  const opts = { passive: true, capture: true };
  for (const d of new Set([fromDoc, bdoc])) ears.on(d, 'pointermove', move, opts);
  // Out of the window (nothing under the pointer any more): of the bubble's own window only — leaving an iframe for
  // the page around it says the same.
  ears.on(bdoc, 'pointerout', (e) => void (!(e as PointerEvent).relatedTarget && leave()), opts);
  restart();
  return stop;
}

const grow = (b: Box, by: number): Box => ({ is: b.is - by, ie: b.ie + by, bs: b.bs - by, be: b.be + by });
const inBox = (b: Box, p: Pt, by: number): boolean => p.i >= b.is - by && p.i <= b.ie + by && p.b >= b.bs - by && p.b <= b.be + by;
const cross = (o: Pt, a: Pt, p: Pt): number => (a.i - o.i) * (p.b - o.b) - (a.b - o.b) * (p.i - o.i);

/** In the triangle `a b c`, its edges included. */
function inTriangle(a: Pt, b: Pt, c: Pt, p: Pt): boolean {
  const d1 = cross(a, b, p);
  const d2 = cross(b, c, p);
  const d3 = cross(c, a, p);
  return !((d1 < 0 || d2 < 0 || d3 < 0) && (d1 > 0 || d2 > 0 || d3 > 0));
}

/** In the smallest shape holding `p0` and the box: the box, or one of the triangles from `p0` to two corners side by side. */
export function inHull(p0: Pt, b: Box, q: Pt): boolean {
  if (inBox(b, q, 0)) return true;
  const c: Pt[] = [{ i: b.is, b: b.bs }, { i: b.ie, b: b.bs }, { i: b.ie, b: b.be }, { i: b.is, b: b.be }];
  return c.some((x, k) => inTriangle(p0, x, c[(k + 1) % 4]!, q));
}
