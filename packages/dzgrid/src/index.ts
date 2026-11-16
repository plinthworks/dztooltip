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
import type { TipLook, TipTone, TipAnimation, TooltipPlacement } from '@dztooltip/core';
import { safeHtml } from '@dztooltip/core';
import { absent, closing, conceal, dress, floatStyles, forget, opening, place, placementOf, play, reveal, tips, track, wanted, type TipControl } from '@dztooltip/core/internal';

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

/** DzGrid's cell and header tooltips drawn by DzTooltip (the feature's id is `tooltips`, the one DzGrid's warnings name). */
export function dzTooltips(options: DzTooltipsOptions = {}): DzTooltipsFeature {
  const o = options;
  return {
    id: 'tooltips',
    setup() {
      let hide: () => void = () => {};
      let report: (e: unknown) => void = () => {};
      // Following the shown bubble's anchor (27); the header button it was on, 300 ms after it hid (29).
      let untrack: () => void = () => {};
      let recent: Element | null = null;
      let recentTimer: ReturnType<typeof setTimeout> | undefined;
      const forgetRecent = (): void => void (clearTimeout(recentTimer), (recent = null));
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
        tipFor: (t) => (o.header && t.matches(BUTTON) ? { text: t.getAttribute('aria-label')!, said: true, ...(warm(t) && { delayMs: 0 }) } : undefined),
        ok: (a) => wanted(a),
        ...(o.html && { html: (h: string, doc: Document) => safeHtml(h, doc) }),
        show(s) {
          const { el, anchor, tip, dir } = s;
          const doc = el.ownerDocument;
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
          place(el, anchor, dir, ...at);
          // Followed while shown (every frame with `everyFrame`, 39); its anchor gone: hidden the grid's way (27, 28).
          untrack();
          untrack = track(anchor, el, () => (absent(anchor) ? s.hide() : void place(el, anchor, dir, ...at)), undefined, [], !!o.everyFrame);
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
      return { tooltips, destroy: () => (untrack(), forgetRecent(), forget(ctl)) };
    },
  };
}
