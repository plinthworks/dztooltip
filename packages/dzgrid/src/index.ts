/**
 * @dztooltip/dzgrid — the bridge (docs/behaviors/tooltips-popovers.md 21–24): a DzGrid's cell and header tooltips drawn
 * by DzTooltip — placements, tones, shapes, CSS animations or the app's own, cleaned HTML, the header's buttons saying
 * their name, one tooltip on screen at a time with the page's.
 *
 * ```ts
 * import { dzTooltips } from '@dztooltip/dzgrid';
 * createGrid(host, { …, features: [dzTooltips({ tone: 'neutral', placement: 'top', animation: 'morph' })] });
 * ```
 *
 * DzGrid still decides when a tooltip shows (its hover delay, a keyboard focus, Escape, a press, a scroll) and what it
 * says (a column's `tooltip`, `headerTooltip`, a failed save's reason, a part); this feature decides where and how,
 * through DzGrid's tooltip seam (`FeatureHandle.tooltips`, DzGrid 1.12.0). A column's or a cell's own look (`tone`,
 * `placement`, `animation`, `shape`, `style`, `maxWidth`) wins over these options.
 *
 * The types below are the part of `@dzgrid/dom`'s seam this bridge uses, written structurally: the bridge has no
 * import of DzGrid, and `dzTooltips()` fits in a DzGrid's `features` list.
 */
import type { TipLook, TipTone, TipAnimation, TooltipPlacement, VirtualAnchor } from '@dztooltip/core';
import { safeHtml } from '@dztooltip/core';
import {
  absent, boxOfRect, closing, conceal, dress, floatStyles, forget, opening, place, placementOf, play, pointOf, rectOfBox, reveal, tips, track, wanted,
  type Box, type Pt, type TipControl,
} from '@dztooltip/core/internal';

/** A grid tooltip about to show, as DzGrid hands it: its words and the column's or the cell's own look. */
export interface GridTipLike {
  readonly text: string;
  readonly said?: boolean | undefined;
  readonly tone?: TipTone | undefined;
  readonly placement?: TooltipPlacement | undefined;
  readonly animation?: TipAnimation | undefined;
  readonly shape?: string | undefined;
  readonly style?: Readonly<Record<`--${string}`, string>> | undefined;
  readonly maxWidth?: number | string | undefined;
}

/** A target's own tooltip, answered before the grid reads it (a header button's name). */
export interface GridTipAnswer {
  readonly text: string;
  readonly said?: boolean;
  /** Its own hover delay: 0 while the header buttons' group is warm (tooltips-popovers.md 29). */
  readonly delayMs?: number;
}

/** What DzGrid's seam is told when a tooltip shows: its element (filled), the anchor, the tip, the direction, its hide. */
export interface GridTipShowLike {
  readonly el: HTMLElement;
  readonly anchor: HTMLElement;
  readonly tip: GridTipLike;
  readonly dir: 'ltr' | 'rtl';
  readonly hide: () => void;
}

/** DzGrid's tooltip seam (`FeatureHandle.tooltips`, 1.12.0). */
export interface GridTooltipSeamLike {
  targets?(): string;
  tipFor?(target: HTMLElement): GridTipAnswer | null | undefined;
  ok?(anchor: HTMLElement): boolean;
  html?(html: string, doc: Document): DocumentFragment;
  show(s: GridTipShowLike): void;
  hide(el: HTMLElement, done: () => void): () => void;
}

/** The grid's tooltips' look and what they cover (a column's own look wins). */
export interface DzTooltipsOptions extends TipLook {
  /** The header's buttons (sort, filter, menu) say their name as a tooltip. @default false */
  readonly header?: boolean;
  /** A column's tooltip may be HTML (`{ html }`), cleaned by `safeHtml`; otherwise its `text`, or nothing. @default false */
  readonly html?: boolean;
  /** The page's nonce for the one `<style>` DzTooltip adds (a strict CSP). */
  readonly nonce?: string;
}

/** The feature, as a DzGrid `features` list takes it. */
export interface DzTooltipsFeature {
  readonly id: 'tooltips';
  setup(g: unknown): { readonly tooltips: GridTooltipSeamLike; destroy(): void };
}

const BUTTON = '.dzg-header button[aria-label]';

/** Words a cell holds in a control or hidden from assistive technology: counted only when it has no others (41). */
const ASIDE = 'button,[role=button],input,select,textarea,[aria-hidden=true]';
/** What is drawn with no words: its own box, nothing inside it read. */
const DRAWN = 'svg,img,canvas,video,picture,input,select,textarea,progress,meter,[role=img]';
/** Never what a cell shows: a header's resize handle. */
const NEVER = '.dzg-resize';

const meet = (a: Box, b: Box | null): Box | null => {
  if (!b) return a;
  const r = { is: Math.max(a.is, b.is), ie: Math.min(a.ie, b.ie), bs: Math.max(a.bs, b.bs), be: Math.min(a.be, b.be) };
  return r.ie > r.is && r.be > r.bs ? r : null;
};
const join = (a: Box, b: Box): Box => ({ is: Math.min(a.is, b.is), ie: Math.max(a.ie, b.ie), bs: Math.min(a.bs, b.bs), be: Math.max(a.be, b.be) });
/** On one line: their block ranges overlap by half the smaller (as an inline anchor's pieces, 37). */
const oneLine = (a: Box, b: Box): boolean => Math.min(a.be, b.be) - Math.max(a.bs, b.bs) >= Math.min(a.be - a.bs, b.be - b.bs) / 2;
const far = (b: Box, p: Pt): number => Math.hypot(Math.max(b.is - p.i, 0, p.i - b.ie), Math.max(b.bs - p.b, 0, p.b - b.be));
const px = (v: string): number => parseFloat(v) || 0;

/**
 * What `cell` shows, line by line (tooltips-popovers.md 41): its words' line boxes — else its words in controls or
 * hidden ones, else what is drawn (an icon, an image, a box with no content) —, each cut to what its clipping
 * ancestors up to the grid let be seen (an ellipsis's: the content box). Empty: nothing seen.
 */
function linesOf(cell: Element): Box[] {
  const doc = cell.ownerDocument;
  const win = doc.defaultView;
  const top = cell.closest('.dzg') ?? cell;
  const seen = new Map<Element, Box | null>();
  /** The box an element lets its content be seen in: its own clip (padding box, or content box with an ellipsis), met with its parents'. */
  const clipOf = (el: Element | null): Box | null => {
    if (!el || !win) return null;
    if (seen.has(el)) return seen.get(el)!;
    const up = el === top ? null : clipOf(el.parentElement ?? ((el.getRootNode() as ShadowRoot).host || null));
    const cs = win.getComputedStyle(el);
    // Each axis's own value, or the shorthand's (an engine may answer only one of them).
    const [ox, oy = ox] = (cs.overflow || '').split(' ');
    const clips = (...v: (string | undefined)[]): boolean => v.some((w) => !!w && w !== 'visible');
    const x = clips(cs.overflowX, ox);
    const y = clips(cs.overflowY, oy);
    let own: Box | null = null;
    const r = (x || y) && boxOfRect(el.getBoundingClientRect());
    if (r) {
      // The screen's start side is the line's start in a left-to-right element, its end otherwise.
      const ltr = cs.direction !== 'rtl';
      const pad = cs.textOverflow === 'ellipsis';
      const s = px(ltr ? cs.borderInlineStartWidth : cs.borderInlineEndWidth) + (pad ? px(ltr ? cs.paddingInlineStart : cs.paddingInlineEnd) : 0);
      const e = px(ltr ? cs.borderInlineEndWidth : cs.borderInlineStartWidth) + (pad ? px(ltr ? cs.paddingInlineEnd : cs.paddingInlineStart) : 0);
      const bs = px(cs.borderBlockStartWidth);
      const be = px(cs.borderBlockEndWidth);
      own = { is: x ? r.is + s : -Infinity, ie: x ? r.ie - e : Infinity, bs: y ? r.bs + bs : -Infinity, be: y ? r.be - be : Infinity };
    }
    const b = own && up ? meet(own, up) ?? { is: 0, ie: 0, bs: 0, be: 0 } : own ?? up;
    seen.set(el, b);
    return b;
  };
  const tiers: [Box[], Box[], Box[]] = [[], [], []];
  const add = (tier: 0 | 1 | 2, rects: ArrayLike<unknown>, at: Element | null): void => {
    for (const r of Array.from(rects)) {
      const b = boxOfRect(r);
      const m = b && meet(b, clipOf(at));
      if (m) tiers[tier].push(m);
    }
  };
  const walk = (n: Node, aside: boolean): void => {
    for (const k of Array.from(n.childNodes)) {
      if (k.nodeType === 3) {
        if (!k.textContent?.trim()) continue;
        const range = doc.createRange();
        range.selectNodeContents(k);
        if (typeof range.getClientRects === 'function') add(aside ? 1 : 0, range.getClientRects(), k.parentElement);
      } else if (k.nodeType === 1) {
        const e = k as Element;
        if (e.matches(NEVER)) continue;
        const inside = aside || e.matches(ASIDE);
        if (e.matches(DRAWN) || !(e.shadowRoot ?? e).childNodes.length) add(2, e.getClientRects(), e);
        if (!e.matches(DRAWN)) walk(e.shadowRoot ?? e, inside);
      }
    }
  };
  walk(cell.shadowRoot ?? cell, false);
  const found = tiers.find((t) => t.length) ?? [];
  // One box per line, in their order down the cell.
  const lines: Box[] = [];
  for (const b of found) {
    const i = lines.findIndex((l) => oneLine(l, b));
    if (i >= 0) lines[i] = join(lines[i]!, b);
    else lines.push(b);
  }
  return lines.sort((a, b) => a.bs - b.bs);
}

/**
 * A cell's or a header's bubble anchor (41): the line of what it shows under the pointer — the first with no pointer
 * over the cell (a keyboard focus) —, read again at each placing; the cell when it shows nothing.
 */
function textAnchor(cell: HTMLElement, point: () => Pt | null): VirtualAnchor {
  return {
    contextElement: cell,
    getBoundingClientRect: () => {
      const own = boxOfRect(cell.getBoundingClientRect()) ?? { is: 0, ie: 0, bs: 0, be: 0 };
      const lines = linesOf(cell);
      const p = point();
      const over = p && p.i >= own.is && p.i <= own.ie && p.b >= own.bs && p.b <= own.be ? p : null;
      const line = over && lines.length ? lines.reduce((x, l) => (far(l, over) < far(x, over) ? l : x)) : lines[0];
      return rectOfBox(line ?? own);
    },
  };
}

/** DzGrid's cell and header tooltips drawn by DzTooltip (the feature's id is `tooltips`, the one DzGrid's warnings name). */
export function dzTooltips(options: DzTooltipsOptions = {}): DzTooltipsFeature {
  const o = options;
  return {
    id: 'tooltips',
    setup(g) {
      let hide: () => void = () => {};
      let report: (e: unknown) => void = () => {};
      // Following the shown bubble's anchor (27); the header button it was on, 300 ms after it hid (29).
      let untrack: () => void = () => {};
      let recent: Element | null = null;
      let recentTimer: ReturnType<typeof setTimeout> | undefined;
      const forgetRecent = (): void => void (clearTimeout(recentTimer), (recent = null));
      // The pointer's last point in the grid's document (41: the line it is on), heard before the grid hears it: from
      // the start when DzGrid hands its document (`g.doc`), else from the first target it asks about.
      let point: Pt | null = null;
      let heard: Document | null = null;
      const at = (e: Event): void => void (point = pointOf(e as PointerEvent));
      const hear = (doc: Document): void => {
        if (heard) return;
        heard = doc;
        for (const t of ['pointerover', 'pointermove']) doc.addEventListener(t, at, { capture: true, passive: true });
      };
      const unhear = (): void => {
        for (const t of ['pointerover', 'pointermove']) heard?.removeEventListener(t, at, { capture: true });
        heard = null;
      };
      const gd = (g as { doc?: unknown } | null)?.doc;
      if (gd && typeof gd === 'object' && (gd as Node).nodeType === 9) hear(gd as Document);
      /** A header button's tooltip on screen, or hidden less than 300 ms ago, in the same grid: the next at once. */
      const warm = (t: Element): boolean => {
        const was = ctl.anchor ?? recent;
        return !!was && was.matches(BUTTON) && was.closest('.dzg') === t.closest('.dzg');
      };
      // The grid's bubble as a popover opening and the page's tooltips see it: one control for the grid's life.
      const ctl: TipControl & { anchor: Element | null } = { anchor: null, drop: () => {}, hide: () => hide(), ok: wanted };
      const tooltips: GridTooltipSeamLike = {
        targets: () => `${o.header ? `${BUTTON},` : ''}.dzg-hcell,.dzg-cell`,
        // Its name already: not described twice.
        tipFor: (t) => (hear(t.ownerDocument), o.header && t.matches(BUTTON) ? { text: t.getAttribute('aria-label')!, said: true, ...(warm(t) && { delayMs: 0 }) } : undefined),
        ok: (a) => wanted(a),
        ...(o.html && { html: (h: string, doc: Document) => safeHtml(h, doc) }),
        show(s) {
          const { el, anchor, tip, dir } = s;
          const doc = el.ownerDocument;
          hear(anchor.ownerDocument);
          // Placed by what the cell shows, not the whole cell (41); a header button by itself.
          const by = anchor.matches(BUTTON) ? anchor : textAnchor(anchor, () => point);
          floatStyles(doc, o.nonce);
          report = (e) => void doc.defaultView?.reportError?.(e);
          // DzTooltip's bubble from now on: the grid's own look and place no longer apply to it.
          el.classList.remove('dzg-tooltip');
          el.classList.add('dzt-tooltip', 'dzt-float');
          hide = s.hide;
          ctl.anchor = anchor;
          forgetRecent();
          tips.set(el, ctl);
          // Dressed (its preset, shape, variables; the column's over the grid's) before it shows, then placed.
          reveal(el, o, tip.tone, () => dress(el, o, tip));
          const p = tip.placement ?? o.placement;
          const at = [...placementOf(p, dir, 'bottom-start'), o.flip !== false, p === 'auto', o] as const;
          place(el, by, dir, ...at);
          // Followed while shown (every frame with `everyFrame`, 39); its anchor gone: hidden the grid's way (27, 28).
          untrack();
          untrack = track(by, el, () => (absent(anchor) ? s.hide() : void place(el, by, dir, ...at)), undefined, [], !!o.everyFrame);
          // An opening (not a move to another cell): the page's tooltip hidden, the app's animation told.
          if (opening(ctl)) play(el, o, 'open', report);
        },
        hide(el, done) {
          closing(ctl);
          untrack();
          untrack = () => {};
          forgetRecent();
          recent = ctl.anchor;
          recentTimer = setTimeout(forgetRecent, 300);
          ctl.anchor = null;
          return conceal(el, o, done, report);
        },
      };
      return { tooltips, destroy: () => (untrack(), forgetRecent(), unhear(), forget(ctl)) };
    },
  };
}
