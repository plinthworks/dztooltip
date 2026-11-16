import type { TipAlign, TipAnimation, TipSide, TipTone, TooltipPlacement } from './types.js';
import { logicalOf, type Dir } from './dir.js';
import { setAttr, setPx } from './write.js';
import type { Scope } from './scope.js';
import { absent, placed, rootFor, track } from './follow.js';
import { boxOf, contextOf, holds, isElement, tie, type Anchor } from './anchor.js';

let ids = 0;

/** What a popover opening asks of a tooltip bubble (tooltips-popovers.md 18): the page's, or a grid's through the bridge. */
export interface TipControl {
  readonly anchor: Element | null;
  /** Drops a show waiting for its delay. */
  drop(): void;
  hide(): void;
  /** Asked when a delay ends: false drops the show. */
  ok?: ((anchor: Element) => boolean) | undefined;
}

/** Each bubble's control: a popover opening drops the shows waiting and hides one about its trigger (18). */
export const tips = new WeakMap<Element, TipControl>();

export type { TipAlign, TipAnimation, TipSide, TipTone };
/**
 * The application's own animation (D-4; owner 2026-11-14 « CSS normal, ou GSAP pour du morphing »): called once the
 * bubble is placed (`open`) and before it is hidden (`close`); a closing bubble is hidden when what it returns settles
 * (a promise, a WAAPI `animation.finished`, a GSAP tween or timeline), at once otherwise. `info` gives the side it opened
 * on, its tone, the reading direction, whether reduced motion is asked (`reduced`: the app decides — an instant or a
 * fade-only version), and the app's shape (`shape`: the `<path>` drawn from `TipLook.shape`, to morph). Shown again
 * while its closing runs, it is told `open` again (stop the closing there). Never called inside `[data-motion=off]` (a
 * DzGrid with `motion: false`). While given, the CSS presets are off (`data-animation="custom"`).
 */
export type TipAnimate = (el: HTMLElement, phase: 'open' | 'close', info: TipAnimateInfo) => void | PromiseLike<unknown> | TipThenable;

/** Anything with a `then` the closing can wait on: a GSAP tween or timeline (their `then` takes one callback). */
export interface TipThenable {
  then(onDone: (value: unknown) => unknown): unknown;
}

/** What the app's animation is told. */
export interface TipAnimateInfo {
  readonly side: TipSide;
  readonly tone: TipTone;
  readonly dir: Dir;
  readonly reduced: boolean;
  readonly shape: SVGPathElement | null;
}

/** How a bubble opens, closes and where it goes. */
export interface TipLook {
  readonly tone?: TipTone;
  readonly animation?: TipAnimation;
  readonly animate?: TipAnimate;
  /** Under reduced motion: no animation (`none`, the default) or a short fade, opacity only (`fade`). */
  readonly reducedMotion?: 'none' | 'fade';
  /** Where it opens (12 placements and `auto`); left and right resolved by the reading direction. */
  readonly placement?: TooltipPlacement;
  /** False: never moved to the opposite side when it does not fit. @default true */
  readonly flip?: boolean;
  /**
   * A ready-made shape of `@dztooltip/theme` (`bubble`, `ticket`, `pill`; 20), or the bubble drawn as the app's
   * shape instead of a box and an arrow (opt-in entries): SVG path data (`d`) in a 100 × 100 box stretched over the
   * bubble, filled and edged in the tone's colours. Path commands and numbers only — anything else and the box is kept.
   */
  readonly shape?: string;
  /** Its look through variables only (23): custom properties (`--…`) written on the bubble while it shows; others ignored. */
  readonly style?: Readonly<Record<`--${string}`, string>>;
  /** Its widest: px, or a CSS length (23). */
  readonly maxWidth?: number | string;
  /**
   * The gap and a slide of the app's (31): a number is the gap between the anchor and the arrow's tip (default 4); an
   * object adds a slide along the other axis; a function answers either at each placement, for each side tried.
   */
  readonly offset?: number | TipOffset | ((s: TipOffsetState) => number | TipOffset);
  /**
   * Sliding along the other axis to stay in the window (32): `true` (default), `'attached'` (never so far that it
   * leaves its anchor: the arrow stays on it), `false` (never).
   */
  readonly shift?: boolean | 'attached';
  /** The anchor's box checked at every frame while shown (39): an anchor moved by an animation or a transform. */
  readonly everyFrame?: boolean;
}

/** An offset's parts (31): px. */
export interface TipOffset {
  /** The gap between the anchor and the arrow's tip. @default 4 */
  readonly mainAxis?: number;
  /** A slide along the other axis: towards the line's end (a bubble above or below) or the block's end (beside). */
  readonly crossAxis?: number;
  /** For an aligned placement (`-start`, `-end`) only: replaces `crossAxis`, a slide inwards from the aligned edge. */
  readonly alignmentAxis?: number | null;
}

/** What an offset function is told (31): the side tried, the alignment, the anchor's and the bubble's sizes. */
export interface TipOffsetState {
  readonly side: TipSide;
  readonly align: TipAlign;
  readonly anchor: { readonly inlineSize: number; readonly blockSize: number };
  readonly bubble: { readonly inlineSize: number; readonly blockSize: number };
}

/** How a bubble is placed beyond its side (31, 32). */
export type PlaceHow = Pick<TipLook, 'offset' | 'shift'>;

const fin = (v: unknown, d: number): number => (typeof v === 'number' && Number.isFinite(v) ? v : d);

/** What a tooltip shows: its words (what a screen reader hears), and its own look over the bubble's. */
export interface TipFor {
  readonly text: string;
  /** Already the anchor's description or name (a button saying its name): no `aria-describedby`. */
  readonly said?: boolean | undefined;
  readonly tone?: TipTone | undefined;
  readonly placement?: TooltipPlacement | undefined;
  /** Its own look over the bubble's (21). */
  readonly animation?: TipAnimation | undefined;
  readonly shape?: string | undefined;
  readonly style?: TipLook['style'] | undefined;
  readonly maxWidth?: number | string | undefined;
  readonly delayMs?: number | undefined;
  /** Drawn instead of the text (cleaned HTML, an app's nodes); `gone()` when it is taken out (the page's fill). */
  readonly node?: Node | null | undefined;
  readonly gone?: (() => void) | undefined;
  /** Where the bubble goes in the page (30, 34): this element; none, the anchor's open `<dialog>` or the page's end. */
  readonly root?: Element | null | undefined;
  /** Placed by this instead of the anchor (37, 38): the piece the pointer is on, the pointer's point. */
  readonly by?: Anchor | undefined;
}

const OPPOSITE: Record<TipSide, TipSide> = { 'block-end': 'block-start', 'block-start': 'block-end', 'inline-end': 'inline-start', 'inline-start': 'inline-end' };
/** The sides across (26): asked above or below, the line's end then its start; asked at the start or the end, below then above. */
const ACROSS: Record<'b' | 'i', readonly TipSide[]> = { b: ['inline-end', 'inline-start'], i: ['block-end', 'block-start'] };
const ALL: readonly TipSide[] = ['block-end', 'block-start', 'inline-end', 'inline-start'];

/**
 * Places a fixed bubble by its anchor (tooltips-popovers.md 4, 25, 26, 31, 32, 37, 38): on `side` when it fits there
 * whole; otherwise — `flip` — its opposite, then the two sides across, the first where it fits; fitting nowhere, where
 * the most of it is seen. `auto`: among the sides where it fits, the one with the most room left around it. Along the
 * other axis at the anchor's start, middle or end, slid by the offset, kept in the window (`shift`; `'attached'`: never
 * off its anchor). The gap is the offset's (4 px by default) and the bubble's block-start margin (the arrow's size),
 * which the written inset gives back; `--dzt-viewport-padding` (px) keeps it from the window's edges. Writes
 * `data-side`, the arrow's place (`--dzt-tip-at`), and the room it has (`--dzt-available-block-size`, `-inline-size`;
 * a popover's body its own block room; a tooltip taller than its room `data-overflow`, to scroll). Sizes from the layout
 * box: a running `scale` does not count. The anchor is an element (its line piece, 37) or a virtual one (38), read on
 * the bubble's screen (34); unreadable, nothing is written.
 */
export function place(el: HTMLElement, anchor: Anchor, dir: Dir, side: TipSide, align: TipAlign, flip = true, auto = false, how: PlaceHow = {}): TipSide {
  const win = el.ownerDocument.defaultView!;
  // A fixed bubble's room is the viewport less its scrollbars (`right: 0` sits against a classic scrollbar, not under
  // it): the root's client size, the window's where there is no layout.
  const de = el.ownerDocument.documentElement;
  const W = de.clientWidth || win.innerWidth;
  const H = de.clientHeight || win.innerHeight;
  const box = boxOf(anchor, el.ownerDocument);
  if (!box) return side;
  const a = logicalOf(box, dir, W);
  const cs = getComputedStyle(el);
  const pad = Math.max(0, parseFloat(cs.getPropertyValue('--dzt-viewport-padding')) || 0);
  const body = el.querySelector<HTMLElement>(':scope > .dzt-popover-body');
  // Measured at the window's start, where its width is not squeezed by a place near the end, as wide as the window lets
  // it, and at its whole height: a tooltip uncapped, a popover's body by what it hides.
  setPx(el, 'inset-inline-start', 0);
  setPx(el, '--dzt-available-inline-size', W - 2 * pad);
  if (!body) el.style.removeProperty('--dzt-available-block-size');
  const w = el.offsetWidth;
  const h = el.offsetHeight + (body ? body.scrollHeight - body.clientHeight : 0);
  const m = parseFloat(cs.marginTop) || 0;
  /** The offset on a side (31): the gap and the slide; a function asked once per side, its throw reported. */
  const offs = new Map<TipSide, { main: number; cross: number }>();
  const off = (s: TipSide): { main: number; cross: number } => {
    let o = offs.get(s);
    if (o) return o;
    let v: unknown = how.offset;
    if (typeof v === 'function') {
      try {
        v = v({ side: s, align, anchor: { inlineSize: a.ie - a.is, blockSize: a.be - a.bs }, bubble: { inlineSize: w, blockSize: h } });
      } catch (err) {
        win.reportError?.(err);
        v = undefined;
      }
    }
    const x = v && typeof v === 'object' ? (v as TipOffset) : null;
    const along = x && align && x.alignmentAxis != null ? fin(x.alignmentAxis, 0) * -align : null;
    o = { main: fin(x ? x.mainAxis : v, 4), cross: along ?? fin(x?.crossAxis, 0) };
    offs.set(s, o);
    return o;
  };
  const g = (s: TipSide): number => off(s).main + m;
  /** The room on a side: along its axis, from the gap to the window's edge; across, the window's. */
  const room = (s: TipSide): { b: number; i: number } => {
    const along = s === 'block-end' ? H - pad - a.be - g(s) : s === 'block-start' ? a.bs - g(s) - pad : s === 'inline-end' ? W - pad - a.ie - g(s) : a.is - g(s) - pad;
    return s[0] === 'b' ? { b: along, i: W - 2 * pad } : { b: H - 2 * pad, i: along };
  };
  const fits = (s: TipSide): boolean => room(s).b >= h && room(s).i >= w;
  const seen = (s: TipSide): number => Math.min(w, Math.max(0, room(s).i)) * Math.min(h, Math.max(0, room(s).b));
  const best = (xs: readonly TipSide[], by: (s: TipSide) => number): TipSide => xs.reduce((x, s) => (by(s) > by(x) ? s : x));
  let used = side;
  if (auto) {
    const ok = ALL.filter(fits);
    used = ok.length ? best(ok, (s) => (s[0] === 'b' ? room(s).b - h : room(s).i - w)) : best(ALL, seen);
  } else if (flip && !fits(side)) {
    const order = [side, OPPOSITE[side], ...ACROSS[side[0] as 'b' | 'i']];
    used = order.find(fits) ?? best(order, seen);
  }
  // Held to the room there, then measured again.
  const r = room(used);
  setPx(el, '--dzt-available-inline-size', Math.max(0, r.i));
  setPx(el, '--dzt-available-block-size', Math.max(0, r.b));
  if (body) setPx(body, '--dzt-available-block-size', Math.max(0, r.b - (el.offsetHeight - body.offsetHeight)));
  else setAttr(el, 'data-overflow', h > r.b ? '' : null);
  const ws = el.offsetWidth;
  const hs = el.offsetHeight;
  const block = used[0] === 'b';
  const end = used.endsWith('d');
  const [lo, hi, size] = block ? [a.bs, a.be, hs] : [a.is, a.ie, ws];
  const main = end ? hi + g(used) : lo - g(used) - size;
  const [clo, chi, csize, croom] = block ? [a.is, a.ie, ws, W] : [a.bs, a.be, hs, H];
  let cross = (align < 0 ? clo : align ? chi - csize : (clo + chi - csize) / 2) + off(used).cross;
  // Kept in the window (32), unless asked not to slide.
  if (how.shift !== false) cross = Math.max(pad, Math.min(cross, croom - csize - pad));
  // Attached: never so far that its arrow leaves the anchor — 12 px from its corner and some of the anchor beside it.
  if (how.shift === 'attached') {
    const e = 12 + Math.min(8, (chi - clo) / 2);
    if (clo + e - csize <= chi - e) cross = Math.max(clo + e - csize, Math.min(cross, chi - e));
  }
  setPx(el, 'inset-block-start', (block ? main : cross) - m);
  setPx(el, 'inset-inline-start', block ? cross : main);
  setAttr(el, 'data-side', used);
  el.style.setProperty('--dzt-tip-at', `${Math.round(Math.min(Math.max(12, (clo + chi) / 2 - cross), csize - 12))}px`);
  // What it was placed by, for the follower (27): placed again only when this changes.
  placed.set(el, { box, w: ws, h: hs, W: win.innerWidth, H: win.innerHeight });
  return used;
}

type Popoverish = HTMLElement & { showPopover?: () => void; hidePopover?: () => void };

/**
 * Shows a bubble in the top layer where the browser has one (no ancestor clips it); its tone and animation marked, then
 * `dress` (its own preset, shape, variables) — all before it shows: showing it reads its style, and its opening starts
 * from what it reads (owner 2026-11-14: a grid's preset shown first, a column's `morph` a moment late).
 */
export function reveal(el: HTMLElement, look: TipLook, tone: TipTone | undefined, dress?: () => void): void {
  setAttr(el, 'data-tone', tone ?? look.tone ?? null);
  setAttr(el, 'data-animation', look.animation ?? null);
  setAttr(el, 'data-reduced', look.reducedMotion ?? null);
  dress?.();
  el.hidden = false;
  if ((el as Popoverish).showPopover) {
    el.setAttribute('popover', 'manual');
    try {
      (el as Popoverish).showPopover!();
    } catch {
      /* already shown */
    }
  }
}

/** Hidden now (its CSS closing runs on `[hidden]`), out of the top layer. */
export function hideBubble(el: HTMLElement): void {
  el.hidden = true;
  try {
    (el as Popoverish).hidePopover?.();
  } catch {
    /* not a popover, or already hidden */
  }
}

/**
 * One tooltip element (WCAG 1.4.13; tooltips-popovers.md): shown after a delay on hover or at once on keyboard focus;
 * the pointer may move onto it; Escape dismisses it; it stays until then. The page's (`tooltip()`, one per document) is
 * this class; `enhance()` gives it its placements, its app animation and its awaited closing through the seams below.
 */
export class Tooltip implements TipControl {
  readonly el: HTMLElement;
  /** What it shows about (an element or a virtual anchor, 38), and what it is placed by (the same, a piece, a point). */
  #anchor: Anchor | null = null;
  #by: Anchor | null = null;
  #cancelShow: (() => void) | null = null;
  #cancelHide: (() => void) | null = null;
  #closing: (() => void) | null = null;
  /** Following its anchor while shown (27); its place there, kept for each placement again. */
  #untrack: (() => void) | null = null;
  #placed: readonly [Dir, TipSide, TipAlign, boolean?, boolean?] | null = null;
  #cancelRecent: (() => void) | null = null;
  /**
   * The anchor it was shown on, for 300 ms after it hid (29: a delay group stays warm that long); null after, or while
   * it is shown.
   */
  recent: HTMLElement | null = null;
  readonly #scope: Scope;
  /** A part's (or the page's) turn to draw the content (true: it did); told null when the content goes. */
  fill: ((t: TipFor | null) => boolean) | undefined;
  /** How it opens and closes, read at each show and hide. */
  look: () => TipLook & { readonly hideDelayMs?: number } = () => ({});
  report: (e: unknown) => void = () => {};
  /**
   * Its side, alignment and flip (below, at the anchor's start, unless `enhance()` gives another). Asked before it is
   * measured: `enhance()` dresses the bubble there (its preset, shape and variables).
   */
  at: (tip: TipFor, dir: Dir) => readonly [TipSide, TipAlign, boolean?, boolean?] = () => ['block-end', -1];
  /** Its closing: hidden at once here; the app's animation and the end of the fade awaited with `enhance()`. */
  close: (el: HTMLElement, look: TipLook, done: () => void) => () => void = (el, _l, done) => (hideBubble(el), done(), () => {});
  /** Told each show (one tooltip at a time in a page and the app's opening animation, `enhance()`). */
  onShow?: (t: Tooltip) => void;
  /** Asked when a delay ends: false drops the show (an anchor disabled, or holding an open popover's trigger; 18). */
  ok?: ((anchor: Element) => boolean) | undefined;

  constructor(el: HTMLElement, scope: Scope, fill?: (t: TipFor | null) => boolean) {
    this.el = el;
    this.el.id ||= `dzt-tip-${++ids}`;
    this.#scope = scope;
    this.fill = fill;
    tips.set(el, this);
    scope.on(el, 'pointerenter', () => this.#keep());
    scope.on(el, 'pointerleave', (e: PointerEvent) => {
      const a = this.anchor;
      if (!a || !holds(a, e.relatedTarget as Node | null)) this.hideSoon();
    });
  }

  /** The element it shows about (none for a virtual anchor, 38). */
  get anchor(): HTMLElement | null {
    return isElement(this.#anchor) ? (this.#anchor as HTMLElement) : null;
  }

  /** What it shows about: an element or a virtual anchor. */
  get current(): Anchor | null {
    return this.#anchor;
  }

  /** After `delay` ms (0: now), unless something else is shown or hidden first. */
  showFor(anchor: Anchor, tip: TipFor, dir: Dir, delay: number): void {
    this.#keep();
    this.drop();
    if (delay <= 0) return this.#show(anchor, tip, dir);
    this.#cancelShow = this.#scope.timeout(() => {
      this.#cancelShow = null;
      // Still on the page, and still wanted (18).
      if (!absent(anchor) && (!isElement(anchor) || this.ok?.(anchor) !== false)) this.#show(anchor, tip, dir);
    }, delay);
  }

  /** Drops a show waiting for its delay (18). */
  drop(): void {
    this.#cancelShow?.();
    this.#cancelShow = null;
  }

  /** A short grace (`hideDelayMs`, 150), so the pointer can cross the gap onto the tooltip. */
  hideSoon(): void {
    this.drop();
    if (this.#cancelHide || this.el.hidden || !this.#anchor) return;
    this.#cancelHide = this.#scope.timeout(() => {
      this.#cancelHide = null;
      this.hide();
    }, this.look().hideDelayMs ?? 150);
  }

  hide(): void {
    this.drop();
    this.#keep();
    if (this.anchor) tie(this.anchor, this.el, 'describedby', false);
    const was = this.anchor;
    const had = this.#anchor;
    this.#anchor = this.#by = null;
    this.#untrack?.();
    this.#untrack = null;
    // A hidden tooltip keeps no content: it goes once the closing is over.
    if (!had || this.el.hidden) return void ((this.el.hidden = true), this.fill?.(null));
    // Its group warm a while (29).
    this.#cancelRecent?.();
    this.recent = was;
    this.#cancelRecent = this.#scope.timeout(() => ((this.recent = null), (this.#cancelRecent = null)), 300);
    this.#closing = this.close(this.el, this.look(), () => {
      this.#closing = null;
      this.fill?.(null);
    });
  }

  #keep(): void {
    this.#cancelHide?.();
    this.#cancelHide = null;
  }

  /** Places it again now, where it was asked (a pointer followed, 38). */
  replace(): void {
    if (this.#by && this.#placed && !this.el.hidden) this.#place();
  }

  #place(): void {
    const [dir, side, align, flip = true, auto = false] = this.#placed!;
    place(this.el, this.#by!, dir, side, align, flip, auto, this.look());
  }

  #show(anchor: Anchor, tip: TipFor, dir: Dir): void {
    // Gone already (its element left the page, a virtual rectangle unreadable): nothing shown.
    if (absent(anchor)) return;
    this.#closing?.();
    this.#closing = null;
    if (this.anchor && this.#anchor !== anchor) tie(this.anchor, this.el, 'describedby', false);
    this.#anchor = anchor;
    this.#by = tip.by ?? anchor;
    this.#cancelRecent?.();
    this.#cancelRecent = null;
    this.recent = null;
    // In the anchor's open dialog, or the root given (30, 34): inert nowhere.
    const root = rootFor(contextOf(anchor), tip.root, this.el.ownerDocument);
    if (this.el.parentNode !== root) root.append(this.el);
    // Drawn before it is measured: its size is the part's. Cleaned HTML: its nodes.
    if (!this.fill?.(tip)) {
      if (tip.node) this.el.replaceChildren(tip.node);
      else this.el.textContent = tip.text;
    }
    // Dressed (`at`) before it shows, then measured and placed in the same task: its first frame is its opening's.
    let at!: ReturnType<Tooltip['at']>;
    reveal(this.el, this.look(), tip.tone, () => void (at = this.at(tip, dir)));
    // A button's tooltip that is its name already: not twice. Across a shadow root or a frame: as it can (33, 34).
    if (this.anchor) tie(this.anchor, this.el, 'describedby', !tip.said, tip.text);
    this.#placed = [dir, ...at];
    this.#place();
    // Followed while shown (27, 39); gone with its anchor (28).
    this.#untrack?.();
    this.#untrack = track(this.#by, this.el, () => {
      const a = this.#anchor;
      if (!a || !this.#placed) return;
      if (absent(a)) return this.hide();
      this.#place();
    }, undefined, [], !!this.look().everyFrame);
    this.onShow?.(this);
  }
}
