import { place, reveal, tips, type TipLook } from './bubble.js';
import { conceal, dress, play } from './engine.js';
import { logicalBox, placementOf, pointOf, type Pt } from './dir.js';
import { dirAt, drawn, floatStyles, keyed, pageOf, schemeOf, wanted, type TipContent } from './float.js';
import { absent, isAnchor, track } from './follow.js';
import { boxOf, contextOf, docOf, holds, hostsOf, isElement, pointed, rootFor, tie, type VirtualAnchor } from './anchor.js';
import { FOCUSABLE, controlsIn, firstFocus, guards, hasInert, shut } from './focus.js';
import { safeZone } from './safe.js';
import { Ears } from './write.js';

/** Why a popover closed (tooltips-popovers.md 10, 13, 14, 40: `leave`, the pointer left a hover card). */
export type PopoverCloseReason = 'escape' | 'outside' | 'focus' | 'trigger' | 'code' | 'group' | 'gone' | 'leave';

/** A popover: the bubble that stays (tooltips-popovers.md 10–15, 36, 40). */
export interface PopoverOptions extends TipLook {
  /** Drawn at each opening (a function is called then; its `gone()` when it closes). */
  readonly content: TipContent;
  /** Its accessible name; the trigger's own name otherwise (`aria-labelledby`). */
  readonly label?: string;
  /** One open at a time in a group, nesting aside. @default 'default' */
  readonly group?: string;
  /**
   * `click`: the trigger toggles it; `hover`: a hover card — opened by the pointer resting on the trigger or a keyboard
   * focus, closed when the pointer leaves both (40); `manual`: only code. @default 'click'
   */
  readonly openOn?: 'click' | 'hover' | 'manual';
  /** A hover card's delay before it opens on hover, ms (40). @default 500 */
  readonly delayMs?: number;
  /** A hover card's grace after the pointer leaves it and its trigger, ms (40). @default 150 */
  readonly hideDelayMs?: number;
  /**
   * A modal dialog (36): the rest of the page inert while it is open, Tab kept inside, the focus back to the trigger on
   * every close. Never for a hover card. @default false
   */
  readonly modal?: boolean;
  /**
   * Where the focus goes when it opens (36): an element, a function given the bubble, or `false` (none moved; a modal's
   * bubble itself). @default the element marked `autofocus`, else the first control (else, modal: the bubble)
   */
  readonly initialFocus?: HTMLElement | ((bubble: HTMLElement) => HTMLElement | null | undefined) | false;
  /** Where the focus goes back when it closes (36): the trigger (`true`), this element, or nowhere (`false`). @default true */
  readonly returnFocus?: boolean | HTMLElement;
  /** The page's nonce for the one `<style>` it adds (a strict CSP). */
  readonly nonce?: string;
  /**
   * Where the bubble goes in the page (30); an element of the page above an iframe holding the trigger puts it there,
   * over the iframe (34). @default the trigger's open `<dialog>`, or the page's end
   */
  readonly root?: HTMLElement;
  readonly onOpen?: () => void;
  readonly onClose?: (reason: PopoverCloseReason) => void;
}

export interface PopoverHandle {
  open(): void;
  close(): void;
  toggle(): void;
  readonly isOpen: boolean;
  /** The bubble while open. */
  readonly el: HTMLElement | null;
  /** Places it again (its content changed size, a virtual anchor moved). */
  reposition(): void;
  update(o: Partial<PopoverOptions>): void;
  destroy(): void;
}

interface Open {
  readonly bubble: HTMLElement;
  readonly group: string;
  readonly kids: Set<Open>;
  parent: Open | null;
  has(n: Node | null): boolean;
  close(reason: PopoverCloseReason): void;
}
/** The open popovers of a page. */
const opened = new Set<Open>();
/** The open modal popovers, the newest last: only it keeps the focus (36) — two traps never fight. */
const modals: Open[] = [];

let ids = 0;

/**
 * Gives `trigger` a popover: a non-modal dialog opened by a click (or by code; a hover card, 40), closed by Escape
 * (focus back to the trigger), a press outside, the focus leaving, the trigger again, or code; a modal one with
 * `modal` (36). Placed like a tooltip, in the top layer, followed while open (27); closed when its trigger leaves the
 * page or the window, stops being drawn, or its grid row is recycled. A virtual anchor (38) opens by code only.
 */
export function popover(anchor: HTMLElement | VirtualAnchor, options: PopoverOptions): PopoverHandle {
  // Neither an element nor a virtual anchor: reported, a handle that does nothing (28).
  if (!isAnchor(anchor, 'popover(trigger)')) return { open() {}, close() {}, toggle() {}, isOpen: false, el: null, reposition() {}, update() {}, destroy() {} };
  const trigger = isElement(anchor) ? (anchor as HTMLElement) : null;
  const ctx = contextOf(anchor);
  const doc = docOf(anchor)!;
  const win = doc.defaultView;
  let o = options;
  let cur: Open | null = null;
  let stop: Ears | null = null;
  let gone: (() => void) | undefined;
  /** A closing still running: what ends it (a destroy ends it at once). */
  let pending: (() => void) | null = null;
  /** Destroyed: opens nothing more. */
  let dead = false;
  /** What a modal opening shut and set up (36): given back on its close. */
  let unshut: (() => void) | null = null;
  /** The focus going back to the trigger as it closes: not a focus that opens a hover card (40). */
  let returning = false;
  /** Its following, stopped when it closes. */
  let stopTrack: (() => void) | null = null;
  /** The element that had the focus before it opened: a virtual popover's focus goes back there (38). */
  let before: HTMLElement | null = null;
  /** The pointer's point on the trigger that opened it (37): its piece placed by. */
  let point: Pt | null = null;
  const life = new Ears();
  if (trigger) {
    trigger.id ||= `dzt-pt-${++ids}`;
    trigger.setAttribute('aria-haspopup', 'dialog');
    trigger.setAttribute('aria-expanded', 'false');
  }
  const report = (e: unknown): void => void win?.reportError?.(e);
  // A trigger in a grid's row: the row it shows when the popover opened (a recycled row shows another).
  const rowOf = (): string | null => trigger?.closest('[aria-rowindex]')?.getAttribute('aria-rowindex') ?? null;
  let row: string | null = null;
  const hover = (): boolean => !!trigger && o.openOn === 'hover';
  const modal = (): boolean => !!o.modal && !hover();
  /** What this opening is placed by: the trigger's piece the pointer was on (37), or the anchor. */
  let by: HTMLElement | VirtualAnchor = anchor;

  /** Where it goes (`placement`, below and centred by default; `flip` false: the side asked; `'auto'`: the most room). */
  const placeIt = (): void => {
    if (!cur) return;
    const dir = ctx ? dirAt(ctx) : cur.bubble.dir === 'rtl' ? 'rtl' : 'ltr';
    const [side, align] = placementOf(o.placement, dir, 'bottom');
    place(cur.bubble, by, dir, side, align, o.flip !== false, o.placement === 'auto', o);
  };
  /** The trigger still seen: inside the window and every scrolling box around it (it is clipped there otherwise). */
  const seen = (): boolean => {
    if (!trigger) return true;
    const W = win?.innerWidth ?? 0;
    const r = logicalBox(trigger.getBoundingClientRect(), 'ltr', W);
    if (!win || r.be < 0 || r.bs > win.innerHeight || r.ie < 0 || r.is > W) return false;
    for (let p = trigger.parentElement; p && p !== doc.body; p = p.parentElement) {
      if (!/auto|scroll|hidden|clip/.test(getComputedStyle(p).overflow)) continue;
      const c = logicalBox(p.getBoundingClientRect(), 'ltr', W);
      if (r.be <= c.bs || r.bs >= c.be || r.ie <= c.is || r.is >= c.ie) return false;
    }
    return true;
  };
  const follow = (): void => {
    if (!cur) return;
    if (absent(anchor) || !seen() || rowOf() !== row) return close('gone');
    placeIt();
  };

  /** A hover card's timers (40): its opening on hover, its closing after the pointer left. */
  let opening = 0;
  let leaving = 0;
  let zone: (() => void) | null = null;
  const wait = (): void => {
    win?.clearTimeout(leaving);
    leaving = 0;
    zone?.();
    zone = null;
  };
  /** The pointer left the card and its trigger: closed after the grace, unless the focus is inside it. */
  const leaveSoon = (): void => {
    const me = cur;
    if (!me || leaving || me.bubble.contains(me.bubble.ownerDocument.activeElement)) return;
    leaving = win?.setTimeout(() => void ((leaving = 0), cur === me && close('leave')), o.hideDelayMs ?? 150) ?? 0;
  };

  function open(how: 'code' | 'hover' = 'code'): void {
    if (cur || dead) return;
    const home = rootFor(ctx, o.root, doc);
    const bdoc = home.ownerDocument;
    floatStyles(bdoc, o.nonce);
    const parent = [...opened].find((p) => !!ctx && holds(p.bubble, ctx)) ?? null;
    const group = o.group ?? 'default';
    for (const p of [...opened]) if (p.group === group && p !== parent && !p.has(ctx)) p.close('group');
    before = bdoc.activeElement as HTMLElement | null;
    const bubble = bdoc.createElement('div');
    bubble.className = 'dzt-popover dzt-float';
    bubble.id = `dzt-pop-${++ids}`;
    bubble.setAttribute('role', 'dialog');
    bubble.tabIndex = -1;
    // Its name: the label given; else the trigger's — by id in one tree, its own words across a shadow root or a frame (33, 34).
    const shared = !!trigger && trigger.getRootNode() === home.getRootNode();
    const name = o.label ?? (trigger && !shared ? (trigger.getAttribute('aria-label') ?? trigger.textContent ?? '').trim() : '');
    if (name) bubble.setAttribute('aria-label', name);
    else if (shared) bubble.setAttribute('aria-labelledby', trigger!.id);
    const c = drawn(o.content, bdoc);
    gone = c.gone;
    // Its content in a body of its own, which scrolls when tall (the bubble keeps its arrow outside it, never clipped).
    const body = bdoc.createElement('div');
    body.className = 'dzt-popover-body';
    if (c.node) body.append(c.node);
    else body.textContent = c.text;
    bubble.append(body);
    bubble.hidden = true;
    // In the trigger's open dialog, or the root given (30, 34): inert nowhere.
    home.append(bubble);
    const hosts = trigger ? hostsOf(trigger) : [];
    const me: Open = {
      bubble, group, kids: new Set(), parent,
      has: (n) => !!n && (bubble.contains(n) || (!!trigger && holds(trigger, n)) || [...me.kids].some((k) => k.has(n))),
      close,
    };
    parent?.kids.add(me);
    cur = me;
    const at = point;
    by = trigger && at ? pointed(trigger, () => at, 'piece') : anchor;
    opened.add(me);
    row = rowOf();
    const dir = ctx ? dirAt(ctx) : bdoc.dir === 'rtl' ? 'rtl' : 'ltr';
    bubble.dir = dir;
    if (ctx) schemeOf(bubble, ctx);
    // No tooltip over it: the shows waiting dropped, one about its trigger (or a cell holding it) hidden (18).
    for (const d of new Set([doc, bdoc])) {
      for (const b of d.querySelectorAll('.dzt-tooltip')) {
        const t = tips.get(b);
        if (!t) continue;
        t.drop();
        // A grid's too, from now on: a cell holding an open popover's trigger shows none.
        t.ok = wanted;
        if (trigger && t.anchor?.contains(trigger)) t.hide();
      }
    }
    const isModal = modal();
    if (isModal) bubble.setAttribute('aria-modal', 'true');
    reveal(bubble, o, undefined, () => dress(bubble, o));
    placeIt();
    if (trigger) {
      trigger.setAttribute('aria-expanded', 'true');
      tie(trigger, bubble, 'controls', true);
    }
    const ears = (stop = new Ears());
    const on = (t: EventTarget, type: string, fn: (e: Event) => void, capture = false): void => ears.on(t, type, fn, { capture });
    // A press outside, heard in both documents (34); its real target, inside a shadow root too (33).
    for (const d of new Set([doc, bdoc])) on(d, 'pointerdown', (e) => void (!me.has(e.composedPath()[0] as Node) && close('outside')), true);
    const esc = (e: Event): void => {
      if ((e as KeyboardEvent).key !== 'Escape' || e.defaultPrevented) return;
      e.preventDefault();
      close('escape');
    };
    on(bubble, 'keydown', esc);
    // Modal: Escape anywhere in its document closes it (the focus may have been lost to the body, 36).
    if (isModal) on(bdoc, 'keydown', esc);
    on(bubble, 'keydown', (e) => {
      const k = e as KeyboardEvent;
      if (k.key !== 'Tab' || k.defaultPrevented) return;
      const mine = controlsIn(bubble);
      const at = mine.indexOf(bdoc.activeElement as HTMLElement);
      // On the bubble itself (a click on its words), Tab goes on to its first control.
      if (k.shiftKey ? at > 0 : at < mine.length - 1 && (at >= 0 || bdoc.activeElement === bubble)) return;
      e.preventDefault();
      // Modal: Tab wraps inside (36).
      if (isModal) return void (k.shiftKey ? mine[mine.length - 1] ?? bubble : mine[0] ?? bubble).focus();
      // The bubble lives at the page's end, the trigger anywhere: Tab past its last control goes on to what follows
      // the trigger (its shadow host, 33), Shift+Tab before its first back to the trigger — the page's order, as if it
      // sat after its trigger. A virtual popover: back where the focus was.
      const all = [...doc.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((x) => !me.has(x) || x === trigger);
      // The trigger in the page's own tree, or the outermost shadow host around it.
      const ref = hosts[hosts.length - 1] ?? trigger;
      const to = k.shiftKey ? (trigger ?? before) : ref ? all.find((x) => x !== ref && !ref.contains(x) && ref.compareDocumentPosition(x) & 4) : before;
      close('focus');
      to?.focus();
    });
    if (trigger) on(trigger, 'keydown', esc);
    // Tab past its last control (or a click elsewhere that takes the focus) closes it, the focus left where it went —
    // not when it went to the trigger's shadow host (its own component, 33). Modal: brought back instead (36).
    on(bubble, 'focusout', (e) => {
      const to = (e as FocusEvent).relatedTarget as Node | null;
      if (!isModal && to && !me.has(to) && !hosts.includes(to as Element)) close('focus');
    });
    if (isModal) {
      unshut = shut(bubble);
      const unguard = hasInert(bdoc) ? null : guards(bubble, body);
      const was = unshut;
      unshut = () => (was(), unguard?.());
      modals.push(me);
      on(bdoc, 'focusin', (e) => {
        const t = e.composedPath()[0] as Node;
        if (cur === me && modals[modals.length - 1] === me && !me.has(t)) (controlsIn(bubble)[0] ?? bubble).focus();
      }, true);
    }
    if (how === 'hover' || hover()) {
      // A hover card (40): the pointer onto it keeps it, off it towards neither it nor its trigger closes it.
      on(bubble, 'pointerenter', wait);
      on(bubble, 'pointerleave', (e) => {
        const to = (e as PointerEvent).relatedTarget as Node | null;
        if (!me.has(to)) leaveSoon();
      });
    }
    // Followed (27, 39): a scroll, the window, its content or its trigger changing size, its trigger moving with no
    // scroll; its trigger taken out of the page or its row showing another (a view swapped, a sort, a grid destroyed)
    // — at the next frame.
    const untrack = track(by, bubble, follow, () => rowOf() !== row, ['aria-rowindex'], !!o.everyFrame);
    stopTrack = untrack;
    play(bubble, o, 'open', report);
    // Into it (36): `initialFocus`, an `autofocus`, its first control; none: the focus stays (a modal: the bubble). A
    // hover card moves no focus.
    if (!hover()) firstFocus(bubble, o.initialFocus, isModal, report)?.focus();
    o.onOpen?.();
  }

  function close(reason: PopoverCloseReason = 'code'): void {
    const me = cur;
    if (!me) return;
    win?.clearTimeout(opening);
    wait();
    for (const k of [...me.kids]) k.close(reason === 'escape' ? 'code' : reason);
    cur = null;
    opened.delete(me);
    me.parent?.kids.delete(me);
    stop?.off();
    stop = null;
    stopTrack?.();
    stopTrack = null;
    const wasModal = !!unshut;
    if (modals.includes(me)) modals.splice(modals.indexOf(me), 1);
    // The page given back before the focus moves (36).
    unshut?.();
    unshut = null;
    if (trigger) {
      trigger.setAttribute('aria-expanded', 'false');
      tie(trigger, me.bubble, 'controls', false);
    }
    const bdoc = me.bubble.ownerDocument;
    // Back to the trigger (or `returnFocus`, or for a virtual popover where it was): a modal on every close; else Escape,
    // the trigger or code with the focus inside (never after a press elsewhere).
    const back = o.returnFocus === false ? null : o.returnFocus && o.returnFocus !== true ? o.returnFocus : (trigger ?? before);
    const inside = me.bubble.contains(bdoc.activeElement);
    // A hover card's trigger given the focus back does not open it again (40).
    if (back && (wasModal || (inside && (reason === 'escape' || reason === 'code' || reason === 'trigger')))) {
      returning = true;
      back.focus();
      returning = false;
    }
    before = null;
    const g = gone;
    gone = undefined;
    // Once: a destroy ends the closing at once, and the closing's own end (an animation settling later) then does nothing.
    let over = false;
    let cancel = (): void => {};
    const done = (): void => {
      if (over) return;
      over = true;
      cancel();
      if (pending === done) pending = null;
      me.bubble.remove();
      g?.();
    };
    pending = done;
    cancel = conceal(me.bubble, o, done, report);
    o.onClose?.(reason);
  }

  const toggle = (): void => (cur ? close('trigger') : open());
  if (trigger) {
    const on = (type: string, fn: (e: Event) => void): void => life.on(trigger, type, fn);
    // A click's point (not a key's: its click has no place) says which piece of a broken link it was on (37).
    on('click', (e) => {
      if (o.openOn === 'manual' || hover()) return;
      point = (e as MouseEvent).detail > 0 ? pointOf(e as MouseEvent) : null;
      toggle();
    });
    // A hover card (40): the pointer resting on the trigger, a keyboard focus.
    pageOf(doc);
    on('pointerenter', (e) => {
      const p = e as PointerEvent;
      if (!hover() || p.pointerType === 'touch') return;
      point = pointOf(p);
      wait();
      if (cur || opening) return;
      opening = win?.setTimeout(() => void ((opening = 0), !absent(trigger) && open('hover')), o.delayMs ?? 500) ?? 0;
    });
    on('pointermove', (e) => void (hover() && !cur && (point = pointOf(e as PointerEvent))));
    on('pointerleave', (e) => {
      if (!hover()) return;
      const p = e as PointerEvent;
      win?.clearTimeout(opening);
      opening = 0;
      const me = cur;
      if (!me || me.has(p.relatedTarget as Node | null)) return;
      wait();
      zone = safeZone(pointOf(p), doc, me.bubble, () => boxOf(trigger, me.bubble.ownerDocument), () => void ((zone = null), cur === me && leaveSoon()));
    });
    on('focusin', () => void (hover() && !returning && keyed(doc) && ((point = null), open('hover'))));
    on('focusout', (e) => {
      const to = (e as FocusEvent).relatedTarget as Node | null;
      if (hover() && cur && !cur.has(to)) close('focus');
    });
    // Tab from the trigger into the card's first control (40).
    on('keydown', (e) => {
      const k = e as KeyboardEvent;
      if (!hover() || !cur || k.key !== 'Tab' || k.shiftKey || k.defaultPrevented) return;
      const first = controlsIn(cur.bubble)[0];
      if (!first) return;
      e.preventDefault();
      first.focus();
    });
  }

  return {
    open: () => ((point = null), open()),
    close: () => close('code'),
    toggle: () => (cur ? close('trigger') : ((point = null), open())),
    get isOpen() {
      return !!cur;
    },
    get el() {
      return cur?.bubble ?? null;
    },
    reposition: placeIt,
    update(n) {
      o = { ...o, ...n };
      if (cur && n.label !== undefined) cur.bubble.setAttribute('aria-label', n.label);
      placeIt();
    },
    destroy() {
      win?.clearTimeout(opening);
      close('code');
      dead = true;
      pending?.();
      life.off();
      if (trigger) {
        trigger.removeAttribute('aria-haspopup');
        trigger.removeAttribute('aria-expanded');
      }
    },
  };
}
