import { boxOfRect, frameStart, rectOfBox, type Box, type Pt } from './dir.js';
import { describe, setAttr } from './write.js';

/**
 * What a bubble is placed by (tooltips-popovers.md 34, 37, 38): an element, or a virtual anchor — a rectangle with no
 * element (a cursor's point, a chart's mark, a `Range` of selected text). Its box is read on the screen of the
 * bubble's document: one line piece of an anchor broken over lines, moved by the frames between an iframe's anchor and
 * a bubble in the page above it.
 */

/** A rectangle-like answer: a `DOMRect`, or a plain object with `left`/`top` and `right`/`bottom` or `width`/`height`. */
export interface VirtualRect {
  readonly left?: number;
  readonly top?: number;
  readonly right?: number;
  readonly bottom?: number;
  readonly width?: number;
  readonly height?: number;
  readonly x?: number;
  readonly y?: number;
}

/**
 * An anchor that is not an element (tooltips-popovers.md 38): its rectangle in the window (`getBoundingClientRect`),
 * its pieces when it breaks over lines (`getClientRects`, optional), and the element it belongs to (`contextElement`:
 * its document, dialog, direction and scheme; gone when it leaves the page). A `Range` works as it is.
 */
export interface VirtualAnchor {
  getBoundingClientRect(): VirtualRect;
  getClientRects?(): ArrayLike<VirtualRect>;
  readonly contextElement?: Element | null;
}

export type Anchor = Element | VirtualAnchor;

export const isElement = (a: unknown): a is Element => !!a && typeof a === 'object' && (a as Node).nodeType === 1 && !!(a as Node).ownerDocument;

/** A virtual anchor's element: its `contextElement`, a `Range`'s container, or none. An element is its own. */
export function contextOf(a: Anchor): Element | null {
  if (isElement(a)) return a;
  const c = a.contextElement;
  if (isElement(c)) return c;
  const n = (a as { commonAncestorContainer?: Node }).commonAncestorContainer;
  return n ? (n.nodeType === 1 ? (n as Element) : n.parentElement) : null;
}

/** The anchor's document: its element's, else the page's (none outside a browser). */
export const docOf = (a: Anchor): Document | null => contextOf(a)?.ownerDocument ?? (globalThis as { document?: Document }).document ?? null;

/** Anchors whose unreadable rectangle was reported already: once each. */
const told = new WeakSet<object>();
function tell(a: object, doc: Document | null, what: string): void {
  if (told.has(a)) return;
  told.add(a);
  // The kind of fault only: nothing of the app's value.
  const err = new TypeError(`dztooltip: not-a-rect — a virtual anchor's ${what} did not answer a rectangle`);
  const w = doc?.defaultView as (Window & { reportError?: (e: unknown) => void }) | null | undefined;
  if (typeof w?.reportError === 'function') w.reportError(err);
  else (globalThis as { console?: { error(e: unknown): void } }).console?.error(err);
}

/** Its line pieces, one per line (pieces on one line joined), in order; empty when it has none or one. */
function pieces(a: Anchor): Box[] {
  if (typeof a.getClientRects !== 'function') return [];
  const list = a.getClientRects();
  const out: Box[] = [];
  for (const r of Array.from(list ?? [])) {
    const b = boxOfRect(r);
    if (!b || (b.ie - b.is <= 0 && b.be - b.bs <= 0)) continue;
    const last = out[out.length - 1];
    // On the same line as the one before (their block ranges overlap by half the smaller): one piece.
    if (last && Math.min(last.be, b.be) - Math.max(last.bs, b.bs) >= Math.min(last.be - last.bs, b.be - b.bs) / 2) {
      out[out.length - 1] = { is: Math.min(last.is, b.is), ie: Math.max(last.ie, b.ie), bs: Math.min(last.bs, b.bs), be: Math.max(last.be, b.be) };
    } else out.push(b);
  }
  return out.length > 1 ? out : [];
}

const far = (b: Box, p: Pt): number => Math.hypot(Math.max(b.is - p.i, 0, p.i - b.ie), Math.max(b.bs - p.b, 0, p.b - b.be));

/**
 * The anchor's box on its own window's screen (37): broken over lines, the piece under `point` or the nearest to it,
 * the first with no point; else its whole box. Null when a virtual anchor's rectangle cannot be read (reported once).
 */
export function ownBox(a: Anchor, point?: Pt | null): Box | null {
  let b: Box | null = null;
  // A virtual anchor is the app's code: any throw in it (a getter of its rectangle too) is an unreadable box.
  try {
    const ps = pieces(a);
    if (ps.length) return point ? ps.reduce((x, p) => (far(p, point) < far(x, point) ? p : x)) : ps[0]!;
    b = boxOfRect(a.getBoundingClientRect());
  } catch {
    b = null;
  }
  if (!b && !isElement(a)) tell(a, docOf(a), 'getBoundingClientRect()');
  return b;
}

/** The frames from `from`'s window up to `to`'s, innermost first; null when `to` is not up the frames (or another origin). */
export function framesUp(from: Document, to: Document): Element[] | null {
  const out: Element[] = [];
  let w: Window | null = from.defaultView;
  for (let n = 0; w && n < 32; n++) {
    if (w.document === to) return out;
    let f: Element | null = null;
    try {
      f = w.frameElement;
    } catch {
      return null;
    }
    if (!f) return null;
    out.push(f);
    w = f.ownerDocument.defaultView;
  }
  return null;
}

/** What to add to a point of `from`'s screen to have it on `to`'s (34); null when there is no way up. */
export function shiftTo(from: Document, to: Document): Pt | null {
  const fs = from === to ? [] : framesUp(from, to);
  if (!fs) return null;
  let i = 0;
  let b = 0;
  for (const f of fs) {
    const s = frameStart(f);
    i += s.i;
    b += s.b;
  }
  return { i, b };
}

/** The anchor's box on `doc`'s screen (its piece, moved by the frames between them). Null: unreadable. */
export function boxOf(a: Anchor, doc: Document, point?: Pt | null): Box | null {
  const b = ownBox(a, point);
  const own = contextOf(a)?.ownerDocument;
  if (!b || !own || own === doc) return b;
  const s = shiftTo(own, doc);
  return s ? { is: b.is + s.i, ie: b.ie + s.i, bs: b.bs + s.b, be: b.be + s.b } : b;
}

/**
 * The anchor as a point of the pointer's (38: following the cursor; 37: the piece it is on) — a virtual anchor of the
 * element: `both` a point, `inline` the point's place along the line with the element's block, `block` the other way.
 */
export function pointed(el: Element, point: () => Pt | null, axis: 'piece' | 'both' | 'inline' | 'block'): VirtualAnchor {
  return {
    contextElement: el,
    getBoundingClientRect: () => {
      const p = point();
      const b = ownBox(el, p) ?? { is: 0, ie: 0, bs: 0, be: 0 };
      if (!p || axis === 'piece') return rectOfBox(b);
      const i = axis === 'block' ? [b.is, b.ie] : [p.i, p.i];
      const k = axis === 'inline' ? [b.bs, b.be] : [p.b, p.b];
      return rectOfBox({ is: i[0]!, ie: i[1]!, bs: k[0]!, be: k[1]! });
    },
  };
}

/** `outer` holds `inner`, shadow roots crossed (an anchor inside a component's shadow root). */
export function holds(outer: Node, inner: Node | null): boolean {
  for (let n: Node | null = inner; n; n = n.parentNode ?? ((n as ShadowRoot).host || null)) if (n === outer) return true;
  return false;
}

/** The nearest element matching `sel` around `el`, shadow roots crossed. */
export function closestOut(el: Element, sel: string): Element | null {
  for (let n: Element | null = el; n; n = (n.getRootNode() as ShadowRoot).host ?? null) {
    const m = n.closest(sel);
    if (m) return m;
  }
  return null;
}

/** The shadow hosts around an element, innermost first (none: it is in its document's own tree). */
export function hostsOf(el: Element): Element[] {
  const out: Element[] = [];
  for (let r = el.getRootNode(); (r as ShadowRoot).host; r = (r as ShadowRoot).host.getRootNode()) out.push((r as ShadowRoot).host);
  return out;
}

/**
 * Where a bubble goes in the page (30, 34): the root given — in the anchor's document or one up the frames —, else the
 * open `<dialog>` its anchor sits in (shadow roots crossed), else the page's end.
 */
export function rootFor(anchor: Element | null, root: Element | null | undefined, doc: Document = anchor!.ownerDocument): Element {
  const own = anchor?.ownerDocument ?? doc;
  if (isElement(root) && (root.ownerDocument === own || framesUp(own, root.ownerDocument))) return root;
  return (anchor && closestOut(anchor, 'dialog[open]')) ?? own.body;
}

/** The anchor's own `aria-description` before a tooltip's words took its place (33, 34): given back after. */
const ownDescription = new WeakMap<Element, string | null>();
type Reflecting = Element & { ariaDescribedByElements?: Element[] | null; ariaControlsElements?: Element[] | null };

/**
 * Links an anchor to its bubble, or unlinks it (33, 34): `describedby` (a tooltip) or `controls` (a popover). In one
 * tree by id; the bubble in a tree around the anchor's (a shadow root's) by ARIA element reflection where the browser
 * has it; otherwise a tooltip's words in the anchor's `aria-description` while it shows (another document, no
 * reflection), and a popover's `controls` not said.
 */
export function tie(anchor: Element, bubble: HTMLElement, rel: 'describedby' | 'controls', on: boolean, text = ''): void {
  const prop = rel === 'describedby' ? 'ariaDescribedByElements' : 'ariaControlsElements';
  const a = anchor as Reflecting;
  // Unlinked whatever the trees are now (an anchor taken out of the page has a tree of its own): every way undone.
  if (!on) {
    if (rel === 'describedby') describe(anchor, bubble.id, false);
    else if (anchor.getAttribute('aria-controls') === bubble.id) anchor.removeAttribute('aria-controls');
    const kept = prop in anchor ? a[prop] : null;
    if (kept?.includes(bubble)) a[prop] = kept.length > 1 ? kept.filter((x) => x !== bubble) : null;
    if (ownDescription.has(anchor)) {
      setAttr(anchor, 'aria-description', ownDescription.get(anchor) ?? null);
      ownDescription.delete(anchor);
    }
    return;
  }
  if (anchor.getRootNode() === bubble.getRootNode()) {
    if (rel === 'describedby') describe(anchor, bubble.id, true);
    else setAttr(anchor, 'aria-controls', bubble.id);
    return;
  }
  if (anchor.ownerDocument === bubble.ownerDocument && prop in anchor && holds(bubble.getRootNode(), anchor)) {
    a[prop] = [...(a[prop] ?? []).filter((x) => x !== bubble), bubble];
    return;
  }
  if (rel !== 'describedby') return;
  if (!ownDescription.has(anchor)) ownDescription.set(anchor, anchor.getAttribute('aria-description'));
  setAttr(anchor, 'aria-description', text || null);
}
