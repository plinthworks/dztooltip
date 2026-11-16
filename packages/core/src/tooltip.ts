import { Tooltip, type TipLook, type TipTone } from './bubble.js';
import { enhance } from './engine.js';
import { dirAt, drawn, floatStyles, keyed, pageOf, schemeOf, wanted, type TipContent } from './float.js';
import { isAnchor } from './follow.js';

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
  /** Where the bubble goes in the page (30). @default the anchor's open `<dialog>`, or the page's end */
  readonly root?: HTMLElement;
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
const waits = new WeakMap<Document, HTMLElement>();
/** Each anchor's delay group (29): a name, its parent, or none. */
const groups = new WeakMap<Element, () => unknown>();
/** The tooltip on screen, or the one that hid less than 300 ms ago, is in the same group as `el` (29). */
const warm = (t: Tooltip | undefined, el: HTMLElement): boolean => {
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
 * Gives `el` a tooltip: after `delayMs` on hover (never on touch alone), at once on a keyboard focus; the pointer may
 * move onto it; Escape, a press, a scroll or the pointer leaving hide it. `aria-describedby` on `el` while shown.
 */
export function tooltip(el: HTMLElement, options: TooltipOptions): TooltipHandle {
  // Not an element (a virtual anchor): reported, a handle that does nothing (28).
  if (!isAnchor(el, 'tooltip(el)')) return { show() {}, hide() {}, update() {}, shown: false, destroy() {} };
  const doc = el.ownerDocument;
  let o = options;
  const page = pageOf(doc);
  const ac = new AbortController();
  const on = (t: EventTarget, type: string, fn: (e: Event) => void, capture = false): void => t.addEventListener(type, fn, { signal: ac.signal, capture, passive: true });
  const tip = (): Tooltip => bubbleOf(doc, o.nonce);
  const mine = (): boolean => bubbles.get(doc)?.anchor === el;
  groups.set(el, () => (o.group === false ? null : o.group ?? el.parentElement));
  const show = (delay: number): void => {
    // An open popover's trigger shows none (tooltips-popovers.md 14).
    if (o.disabled || el.matches('[aria-haspopup][aria-expanded=true]') || (o.when === 'truncated' && !cutText(el))) return;
    const t = tip();
    const look = o;
    t.look = () => look;
    const c = drawn(look.content, doc);
    if (!c.text && !c.node) return void c.gone?.();
    // Its words read in the anchor's direction, and its logical place measured in it.
    const d = dirAt(el);
    t.el.dir = d;
    schemeOf(t.el, el);
    waits.set(doc, el);
    // Its group warm: at once, in place of the one shown (29).
    if (delay > 0 && warm(t, el)) delay = 0;
    t.showFor(el, { text: c.text, node: c.node, ...(c.gone && { gone: c.gone }), tone: look.tone, root: look.root }, d, delay);
  };
  // A show waiting for this anchor dropped too (tooltips-popovers.md 18).
  const hide = (): void => {
    if (waits.get(doc) === el) bubbles.get(doc)?.drop();
    if (mine()) bubbles.get(doc)!.hide();
  };
  on(el, 'pointerenter', (e) => void ((e as PointerEvent).pointerType !== 'touch' && show(o.delayMs ?? 500)));
  on(el, 'pointerleave', (e) => {
    const t = bubbles.get(doc);
    if (t && !t.el.contains((e as PointerEvent).relatedTarget as Node | null)) t.hideSoon();
  });
  on(el, 'focusin', () => void (keyed(doc) && show(0)));
  on(el, 'focusout', hide);
  on(el, 'pointerdown', hide);
  on(el, 'click', hide);
  on(doc, 'scroll', hide, true);
  const escape = (): void => hide();
  page.escape.add(escape);
  return {
    show: () => show(0),
    hide,
    update(n) {
      o = { ...o, ...n };
      if (o.disabled) hide();
      else if (mine()) show(0);
    },
    get shown() {
      return mine() && !bubbles.get(doc)!.el.hidden;
    },
    destroy() {
      hide();
      ac.abort();
      page.escape.delete(escape);
    },
  };
}

export type { TipContent, TipTone };
