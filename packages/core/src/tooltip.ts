import { Tooltip, type TipLook, type TipTone } from './bubble.js';
import { enhance } from './engine.js';
import { dirAt, drawn, floatStyles, keyed, pageOf, schemeOf, wanted, type TipContent } from './float.js';
import { isAnchor } from './follow.js';
import { boxOf, contextOf, docOf, isElement, pointed, rootFor, type Anchor, type VirtualAnchor } from './anchor.js';
import { pointOf, type Pt } from './dir.js';
import { safeZone } from './safe.js';
import { Ears } from './write.js';

/** Its text cut (an ellipsis): wider than its box, itself or a box in it (an inline one has no box: client width 0). */
export const cutText = (el: Element): boolean => (el.clientWidth > 0 && el.scrollWidth > el.clientWidth) || [...el.children].some(cutText);

/** A tooltip on any element of the page (tooltips-popovers.md 1–9). */
export interface TooltipOptions extends TipLook {
  readonly content: TipContent;
  /** Before it shows on hover, ms. @default 500 */
  readonly delayMs?: number;
  /** The grace after the pointer leaves, ms. @default 150 */
  readonly hideDelayMs?: number;
  readonly disabled?: boolean;
  /** `truncated`: only while the anchor's text is cut (an ellipsis). @default 'always' */
  readonly when?: 'always' | 'truncated';
  /** The page's nonce for the one `<style>` it adds (a strict CSP). */
  readonly nonce?: string;
  /**
   * Its delay group (29): once a tooltip of the group is on screen (or hid less than 300 ms ago), resting on another
   * anchor of the group shows its tooltip at once. A name shared by anchors anywhere; `false`: none, its own delay always.
   * @default the anchor's parent (the buttons of one toolbar)
   */
  readonly group?: string | false;
  /**
   * Where the bubble goes in the page (30); an element of the page above an iframe holding the anchor puts it there,
   * over the iframe (34). @default the anchor's open `<dialog>`, or the page's end
   */
  readonly root?: HTMLElement;
  /**
   * Placed by the pointer's point over the anchor and moved with it (38): `true` both ways, `'inline'` along the line
   * only, `'block'` the other way. A keyboard focus places it by the anchor. @default false
   */
  readonly followCursor?: boolean | 'inline' | 'block';
}

export interface TooltipHandle {
  /** Shows it now (as a keyboard focus would). */
  show(): void;
  hide(): void;
  /** New options, merged; a shown tooltip shows the new content at once. */
  update(o: Partial<TooltipOptions>): void;
  readonly shown: boolean;
  destroy(): void;
}

/** One bubble per document: one tooltip on screen at a time (3). */
const bubbles = new WeakMap<Document, Tooltip>();
/** The anchor whose show waits for its delay, per document (18). */
const waits = new WeakMap<Document, Anchor>();
/** Each anchor's delay group (29): a name, its parent, or none. */
const groups = new WeakMap<Element, () => unknown>();
/** The way to the shown bubble kept, per document (35): ended by any show (the pointer reached another anchor). */
const zones = new WeakMap<Document, () => void>();
/** The tooltip on screen, or the one that hid less than 300 ms ago, is in the same group as `el` (29). */
const warm = (t: Tooltip | undefined, el: Element): boolean => {
  const k = groups.get(el)?.();
  const was = t && (t.anchor && !t.el.hidden ? t.anchor : t.recent);
  return k != null && !!was && groups.get(was)?.() === k;
};
function bubbleOf(doc: Document, nonce: string | undefined): Tooltip {
  let t = bubbles.get(doc);
  // A page that emptied its body (a single-page app's view swap) gets it back.
  if (t) return t.el.isConnected || doc.body.append(t.el), t;
  floatStyles(doc, nonce);
  const el = doc.createElement('div');
  el.className = 'dzt-tooltip dzt-float';
  el.setAttribute('role', 'tooltip');
  el.hidden = true;
  doc.body.append(el);
  // The page's content: an app's nodes in place of the words, told when they go (a view destroyed).
  let gone: (() => void) | undefined;
  t = new Tooltip(el, pageOf(doc).scope, (tip) => {
    const g = gone;
    gone = tip?.gone;
    g?.();
    if (tip?.node) el.replaceChildren(tip.node);
    // Words after nodes: the nodes go (the base then writes the words).
    else el.replaceChildren();
    // Hidden for good: back at the page's end, so a dialog or a root taken out later is not kept alive by it (30).
    if (!tip && el.parentNode !== doc.body && doc.body) doc.body.append(el);
    return !!tip?.node;
  });
  t.report = (e) => void doc.defaultView?.reportError?.(e);
  t.ok = wanted;
  // Below and centred unless placed; the app's animation, the fade awaited, one at a time with the grids'.
  enhance(t, 'bottom', t.report);
  bubbles.set(doc, t);
  return t;
}

/**
 * Gives `anchor` a tooltip: after `delayMs` on hover (never on touch alone), at once on a keyboard focus; the pointer
 * may move onto it, on the way the safe triangle keeps it (35); Escape, a press, a scroll or the pointer leaving hide
 * it. `aria-describedby` on the anchor while shown (across a shadow root or a frame: 33, 34). A virtual anchor (38) has
 * no events: shown and hidden by code.
 */
export function tooltip(anchor: HTMLElement | VirtualAnchor, options: TooltipOptions): TooltipHandle {
  // Neither an element nor a virtual anchor: reported, a handle that does nothing (28).
  if (!isAnchor(anchor, 'tooltip(el)')) return { show() {}, hide() {}, update() {}, shown: false, destroy() {} };
  const el = isElement(anchor) ? (anchor as HTMLElement) : null;
  const ctx = contextOf(anchor);
  const doc = docOf(anchor)!;
  let o = options;
  const page = pageOf(doc);
  const ears = new Ears();
  const on = (t: EventTarget, type: string, fn: (e: Event) => void, capture = false): void => ears.on(t, type, fn, { capture, passive: true });
  /** The bubble's document: the anchor's, or the page's above it that `root` names (34). */
  const home = (): Document => rootFor(ctx, o.root, doc).ownerDocument;
  const tip = (): Tooltip => bubbleOf(home(), o.nonce);
  const mine = (): boolean => bubbles.get(home())?.current === anchor;
  if (el) groups.set(el, () => (o.group === false ? null : o.group ?? el.parentElement));
  /** Destroyed: shows nothing more. */
  let dead = false;
  /** The look this anchor gave the page's bubble at its last show: taken back at destroy (it holds the app's content). */
  let lent: (() => TooltipOptions) | null = null;
  /** The pointer's last point over the anchor (37, 38): none after a keyboard focus. */
  let point: Pt | null = null;
  let frame = 0;
  const endZone = (): void => {
    const h = home();
    zones.get(h)?.();
    zones.delete(h);
  };
  const show = (delay: number): void => {
    // An open popover's trigger shows none (tooltips-popovers.md 14).
    if (dead || o.disabled || (el && (el.matches('[aria-haspopup][aria-expanded=true]') || (o.when === 'truncated' && !cutText(el))))) return;
    endZone();
    const t = tip();
    // Escape heard in the bubble's document too (an iframe's anchor, its bubble above, 34).
    const p = pageOf(t.el.ownerDocument);
    if (!pages.has(p)) pages.add(p), p.escape.add(escape);
    const look = o;
    t.look = lent = () => look;
    const c = drawn(look.content, doc);
    if (!c.text && !c.node) return void c.gone?.();
    // Its words read in the anchor's direction, and its logical place measured in it.
    const d = ctx ? dirAt(ctx) : t.el.ownerDocument.dir === 'rtl' ? 'rtl' : 'ltr';
    t.el.dir = d;
    if (ctx) schemeOf(t.el, ctx);
    waits.set(doc, anchor);
    // Its group warm: at once, in place of the one shown (29).
    if (el && delay > 0 && warm(t, el)) delay = 0;
    // By the pointer's point (followed), or by the piece of the anchor it is on (37).
    const f = look.followCursor;
    const by = el && point ? pointed(el, () => point, f === true ? 'both' : f === 'inline' || f === 'block' ? f : 'piece') : undefined;
    t.showFor(anchor, { text: c.text, node: c.node, ...(c.gone && { gone: c.gone }), tone: look.tone, root: look.root, by }, d, delay);
  };
  // A show waiting for this anchor dropped too (tooltips-popovers.md 18).
  const hide = (): void => {
    endZone();
    const h = home();
    if (waits.get(doc) === anchor) bubbles.get(h)?.drop();
    if (mine()) bubbles.get(h)!.hide();
  };
  if (el) {
    const at = (e: Event): void => void (point = pointOf(e as PointerEvent));
    on(el, 'pointerenter', (e) => {
      if ((e as PointerEvent).pointerType === 'touch') return;
      at(e);
      show(o.delayMs ?? 500);
    });
    // The point followed (38): placed again at most once a frame.
    on(el, 'pointermove', (e) => {
      if ((e as PointerEvent).pointerType === 'touch') return;
      at(e);
      const win = doc.defaultView;
      if (!o.followCursor || !mine() || frame || !win) return;
      frame = win.requestAnimationFrame(() => void ((frame = 0), mine() && tip().replace()));
    });
    on(el, 'pointerleave', (e) => {
      const t = bubbles.get(home());
      const p = e as PointerEvent;
      if (!t || t.el.contains(p.relatedTarget as Node | null)) return;
      // Shown: the way to the bubble kept (35), then its grace; else its grace now.
      endZone();
      if (mine() && !t.el.hidden && !o.followCursor) {
        const h = t.el.ownerDocument;
        // Its end may come at once (no way to the bubble's screen): told after it is kept.
        let stop: (() => void) | null = null;
        const out = (): void => void (zones.get(h) === stop && zones.delete(h), mine() && t.hideSoon());
        stop = safeZone(pointOf(p), doc, t.el, () => boxOf(el, h), out);
        zones.set(h, stop);
      } else t.hideSoon();
    });
    on(el, 'focusin', () => void (keyed(doc) && ((point = null), show(0))));
    on(el, 'focusout', hide);
    on(el, 'pointerdown', hide);
    on(el, 'click', hide);
  }
  on(doc, 'scroll', hide, true);
  const escape = (): void => hide();
  const pages = new Set([page]);
  page.escape.add(escape);
  return {
    show: () => ((point = null), show(0)),
    hide,
    update(n) {
      o = { ...o, ...n };
      if (o.disabled) hide();
      else if (mine()) show(0);
    },
    get shown() {
      return mine() && !bubbles.get(home())!.el.hidden;
    },
    destroy() {
      hide();
      dead = true;
      ears.off();
      if (frame) doc.defaultView?.cancelAnimationFrame(frame);
      for (const p of pages) p.escape.delete(escape);
      if (el) groups.delete(el);
      // Nothing of a destroyed anchor kept by the page's bubble: not the anchor, not its options (an app's template or
      // component and the view that made it).
      if (waits.get(doc) === anchor) waits.delete(doc);
      const t = bubbles.get(home());
      if (t && lent && t.look === lent) t.look = () => ({});
      lent = null;
    },
  };
}

export type { TipContent, TipTone, VirtualAnchor };
