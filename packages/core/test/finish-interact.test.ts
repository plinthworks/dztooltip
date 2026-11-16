// Interactions, finished (docs/behaviors/tooltips-popovers.md 33 an anchor in a shadow root, 35 the safe triangle, 36 a
// modal popover, 40 a hover card). jsdom has no `inert` and no ARIA element reflection: their fallbacks are checked
// here (and the reflection with a stand-in property); the real ones in real browsers (scripts/browser.mjs, « finished »).
// Expectations written by hand.
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { tooltip, type TooltipHandle } from '../src/tooltip.js';
import { popover, type PopoverCloseReason, type PopoverHandle } from '../src/popover.js';
import { inHull } from '../src/safe.js';

type B = { left: number; right: number; top: number; bottom: number };
const rect = (b: B) => ({ ...b, width: b.right - b.left, height: b.bottom - b.top, x: b.left, y: b.top, toJSON: () => null });
const handles: (TooltipHandle | PopoverHandle)[] = [];
const keep = <T extends TooltipHandle | PopoverHandle>(h: T): T => (handles.push(h), h);
afterEach(() => {
  for (const h of handles.splice(0)) h.destroy();
  document.body.innerHTML = '';
  vi.useRealTimers();
  vi.restoreAllMocks();
});
const key = (el: Element, k: string, shiftKey = false) => el.dispatchEvent(new KeyboardEvent('keydown', { key: k, shiftKey, bubbles: true, cancelable: true }));
const move = (el: Element, x: number, y: number) => el.dispatchEvent(new PointerEvent('pointermove', { clientX: x, clientY: y, pointerType: 'mouse', bubbles: true }));
const tipEl = () => document.querySelector<HTMLElement>('.dzt-tooltip')!;

describe('an anchor inside a shadow root (33)', () => {
  function shadowed(text = 'Supprimer') {
    const host = document.body.appendChild(document.createElement('div'));
    const root = host.attachShadow({ mode: 'open' });
    const b = root.appendChild(document.createElement('button'));
    b.textContent = text;
    return { host, root, b };
  }

  it('a tooltip: no id across the boundary — its words the anchor\'s description while shown, its own given back', () => {
    const { b } = shadowed();
    b.setAttribute('aria-description', 'Sien');
    const h = keep(tooltip(b, { content: 'Supprime la ligne', delayMs: 0 }));
    h.show();
    expect(tipEl().getRootNode()).toBe(document);
    expect(b.hasAttribute('aria-describedby')).toBe(false);
    expect(b.getAttribute('aria-description')).toBe('Supprime la ligne');
    h.hide();
    expect(b.getAttribute('aria-description')).toBe('Sien');
  });

  it('with ARIA element reflection: the bubble among the anchor\'s described-by elements, then out', () => {
    const { b } = shadowed();
    const own = document.createElement('span');
    // A stand-in for the browser's reflection (jsdom has none): a plain property the code reads and writes.
    Object.defineProperty(b, 'ariaDescribedByElements', { value: [own], writable: true, configurable: true });
    const h = keep(tooltip(b, { content: 'Aide', delayMs: 0 }));
    h.show();
    // `as any`: the stand-in property above, not in the DOM types jsdom gives.
    expect((b as any).ariaDescribedByElements).toEqual([own, tipEl()]);
    expect(b.hasAttribute('aria-description')).toBe(false);
    h.hide();
    expect((b as any).ariaDescribedByElements).toEqual([own]);
  });

  it('a popover: named by the trigger\'s words; a press on the trigger is not outside; Tab past its end after the host', () => {
    const { host, b } = shadowed('Filtrer');
    const after = document.body.appendChild(document.createElement('button'));
    const h = keep(popover(b, { content: () => document.createElement('input'), animation: 'none' }));
    b.click();
    expect(h.isOpen).toBe(true);
    expect(h.el!.getAttribute('aria-label')).toBe('Filtrer');
    expect(h.el!.hasAttribute('aria-labelledby')).toBe(false);
    b.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, composed: true }));
    expect(h.isOpen).toBe(true);
    const field = h.el!.querySelector('input')!;
    expect(document.activeElement).toBe(field);
    key(field, 'Tab');
    expect(h.isOpen).toBe(false);
    expect(document.activeElement).toBe(after);
    expect(host.isConnected).toBe(true);
  });

  it('inside an open <dialog> around the host: the bubble goes into the dialog', () => {
    const d = document.body.appendChild(document.createElement('dialog'));
    d.setAttribute('open', '');
    const host = d.appendChild(document.createElement('div'));
    const b = host.attachShadow({ mode: 'open' }).appendChild(document.createElement('button'));
    const h = keep(popover(b, { content: 'x', animation: 'none' }));
    h.open();
    expect(h.el!.parentElement).toBe(d);
  });
});

describe('the safe triangle (35)', () => {
  it('the shape: the bubble, and the triangles from the point to its corners', () => {
    const box = { is: 100, ie: 200, bs: 100, be: 200 };
    const p0 = { i: 0, b: 0 };
    expect(inHull(p0, box, { i: 50, b: 50 })).toBe(true);
    expect(inHull(p0, box, { i: 150, b: 90 })).toBe(true);
    expect(inHull(p0, box, { i: 150, b: 50 })).toBe(false);
    expect(inHull(p0, box, { i: 10, b: 100 })).toBe(false);
    expect(inHull(p0, box, { i: 150, b: 150 })).toBe(true);
  });

  function shown() {
    vi.useFakeTimers();
    const b = document.body.appendChild(document.createElement('button'));
    b.getBoundingClientRect = () => rect({ left: 100, right: 200, top: 100, bottom: 120 });
    const h = keep(tooltip(b, { content: 'Loin', delayMs: 0 }));
    h.show();
    // The bubble down and to the end of the anchor, far from it (its far corner at 500, 200).
    tipEl().getBoundingClientRect = () => rect({ left: 300, right: 500, top: 130, bottom: 200 });
    b.dispatchEvent(new PointerEvent('pointerleave', { clientX: 200, clientY: 120, pointerType: 'mouse', relatedTarget: document.body }));
    return { b, h };
  }

  it('a diagonal way to the bubble\'s far corner: it stays', () => {
    const { h } = shown();
    vi.advanceTimersByTime(100);
    move(document.body, 250, 130);
    vi.advanceTimersByTime(100);
    move(document.body, 350, 160);
    vi.advanceTimersByTime(100);
    move(document.body, 480, 195);
    vi.advanceTimersByTime(1000);
    expect(h.shown).toBe(true);
  });

  it('a way away from it: hidden after the grace', () => {
    const { h } = shown();
    move(document.body, 200, 300);
    vi.advanceTimersByTime(149);
    expect(h.shown).toBe(true);
    vi.advanceTimersByTime(1);
    expect(h.shown).toBe(false);
  });

  it('resting on the way without reaching it: hidden after 400 ms and the grace', () => {
    const { h } = shown();
    move(document.body, 250, 130);
    vi.advanceTimersByTime(399 + 150);
    expect(h.shown).toBe(true);
    vi.advanceTimersByTime(1);
    expect(h.shown).toBe(false);
  });

  it('leaving the window on the way: hidden after the grace; nothing listened to after', () => {
    const { h } = shown();
    const spy = vi.spyOn(document, 'removeEventListener');
    document.body.dispatchEvent(new PointerEvent('pointerout', { bubbles: true, relatedTarget: null }));
    vi.advanceTimersByTime(150);
    expect(h.shown).toBe(false);
    // The way's two listeners taken off (the follower's own too, its tooltip hidden).
    expect(spy.mock.calls.map((c) => c[0])).toEqual(expect.arrayContaining(['pointermove', 'pointerout']));
  });
});

describe('a modal popover (36)', () => {
  function page(o: Parameters<typeof popover>[1] extends infer T ? Partial<T> : never = {}) {
    const main = document.body.appendChild(document.createElement('main'));
    const t = main.appendChild(document.createElement('button'));
    t.textContent = 'Ouvrir';
    const outside = main.appendChild(document.createElement('input'));
    const aside = document.body.appendChild(document.createElement('aside'));
    aside.setAttribute('aria-hidden', 'true');
    const content = () => {
      const f = document.createElement('div');
      for (const c of ['first', 'second']) f.appendChild(Object.assign(document.createElement('button'), { className: c }));
      return f;
    };
    const reasons: PopoverCloseReason[] = [];
    const h = keep(popover(t, { content, modal: true, animation: 'none', onClose: (r) => reasons.push(r), ...o }));
    return { main, t, outside, aside, h, reasons };
  }

  it('aria-modal; the rest of the page hidden (no inert here: aria-hidden), with focus guards; the focus on its first control', () => {
    const { main, aside, t, h } = page();
    t.click();
    expect(h.el!.getAttribute('aria-modal')).toBe('true');
    expect(main.getAttribute('aria-hidden')).toBe('true');
    expect(h.el!.querySelectorAll('[data-dzt-guard]')).toHaveLength(2);
    expect(document.activeElement!.className).toBe('first');
    h.close();
    expect(main.hasAttribute('aria-hidden')).toBe(false);
    // What the page had hidden already stays so.
    expect(aside.getAttribute('aria-hidden')).toBe('true');
  });

  it('Tab and Shift+Tab wrap inside; the guards send the focus back in', () => {
    const { t, h } = page();
    t.click();
    const [first, second] = [h.el!.querySelector<HTMLElement>('.first')!, h.el!.querySelector<HTMLElement>('.second')!];
    second.focus();
    key(second, 'Tab');
    expect(document.activeElement).toBe(first);
    key(first, 'Tab', true);
    expect(document.activeElement).toBe(second);
    h.el!.querySelector<HTMLElement>('[data-dzt-guard]')!.focus();
    expect(document.activeElement).toBe(second);
    expect(h.isOpen).toBe(true);
  });

  it('a focus that lands outside is brought back; the focus leaving does not close it', () => {
    const { t, outside, h } = page();
    t.click();
    outside.focus();
    expect(h.isOpen).toBe(true);
    expect(document.activeElement!.className).toBe('first');
  });

  it('Escape anywhere closes it, the page given back before the focus returns to the trigger', () => {
    const { main, t, h, reasons } = page();
    t.click();
    let hiddenAtFocus: string | null = 'unset';
    t.addEventListener('focus', () => (hiddenAtFocus = main.getAttribute('aria-hidden')));
    key(document.body, 'Escape');
    expect(h.isOpen).toBe(false);
    expect(reasons).toEqual(['escape']);
    expect(document.activeElement).toBe(t);
    expect(hiddenAtFocus).toBeNull();
  });

  it('a press outside closes it too, and the focus still returns to the trigger', () => {
    const { t, h, reasons } = page();
    t.click();
    document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, composed: true }));
    expect(reasons).toEqual(['outside']);
    expect(document.activeElement).toBe(t);
    expect(h.el).toBeNull();
  });

  it('initialFocus: a function, an element, false (modal: the bubble itself); returnFocus: an element, or false', () => {
    const a = page({ initialFocus: (b: HTMLElement) => b.querySelector<HTMLElement>('.second') });
    a.t.click();
    expect(document.activeElement!.className).toBe('second');
    a.h.close();
    const other = document.body.appendChild(document.createElement('input'));
    const b = page({ initialFocus: false, returnFocus: other });
    b.t.click();
    expect(document.activeElement).toBe(b.h.el);
    b.h.close();
    expect(document.activeElement).toBe(other);
    const c = page({ returnFocus: false });
    c.t.click();
    key(document.activeElement!, 'Escape');
    expect(document.activeElement).not.toBe(c.t);
  });

  it('not modal: initialFocus false leaves the focus on the trigger; a throwing initialFocus is reported, the default used', () => {
    const told: unknown[] = [];
    vi.stubGlobal('reportError', (e: unknown) => void told.push(e));
    const a = page({ modal: false, initialFocus: false });
    a.t.focus();
    a.t.click();
    expect(a.h.el!.hasAttribute('aria-modal')).toBe(false);
    expect(a.main.hasAttribute('aria-hidden')).toBe(false);
    expect(document.activeElement).toBe(a.t);
    a.h.close();
    const b = page({ initialFocus: () => { throw new Error('app'); } });
    b.t.click();
    expect(told).toHaveLength(1);
    expect(document.activeElement!.className).toBe('first');
    vi.unstubAllGlobals();
  });

  it('destroyed while open: the page given back', () => {
    const { main, t, h } = page();
    t.click();
    h.destroy();
    expect(main.hasAttribute('aria-hidden')).toBe(false);
  });
});

describe('a hover card (40)', () => {
  function card() {
    vi.useFakeTimers();
    const a = document.body.appendChild(document.createElement('a'));
    a.href = '#ada';
    a.textContent = 'Ada';
    a.getBoundingClientRect = () => rect({ left: 100, right: 140, top: 100, bottom: 120 });
    const reasons: PopoverCloseReason[] = [];
    const content = () => Object.assign(document.createElement('button'), { className: 'follow' });
    const h = keep(popover(a, { openOn: 'hover', content, animation: 'none', onClose: (r) => reasons.push(r) }));
    return { a, h, reasons };
  }
  const enter = (el: Element, pointerType = 'mouse') => el.dispatchEvent(new PointerEvent('pointerenter', { pointerType, clientX: 120, clientY: 110 }));

  it('the pointer resting 500 ms opens it; no focus moved; a click on the trigger is its own', () => {
    const { a, h } = card();
    enter(a);
    vi.advanceTimersByTime(499);
    expect(h.isOpen).toBe(false);
    vi.advanceTimersByTime(1);
    expect(h.isOpen).toBe(true);
    expect(h.el!.contains(document.activeElement)).toBe(false);
    a.click();
    expect(h.isOpen).toBe(true);
  });

  it('touch alone never opens it; leaving before the delay neither', () => {
    const { a, h } = card();
    enter(a, 'touch');
    vi.advanceTimersByTime(600);
    expect(h.isOpen).toBe(false);
    enter(a);
    a.dispatchEvent(new PointerEvent('pointerleave', { clientX: 120, clientY: 130, relatedTarget: document.body }));
    vi.advanceTimersByTime(600);
    expect(h.isOpen).toBe(false);
  });

  it('the pointer leaving away from it: closed after the grace, `leave`; onto the card: kept, then leaving the card closes it', () => {
    const { a, h, reasons } = card();
    enter(a);
    vi.advanceTimersByTime(500);
    h.el!.getBoundingClientRect = () => rect({ left: 70, right: 170, top: 124, bottom: 154 });
    a.dispatchEvent(new PointerEvent('pointerleave', { clientX: 120, clientY: 100, relatedTarget: document.body }));
    move(document.body, 120, 40);
    vi.advanceTimersByTime(150);
    expect(reasons).toEqual(['leave']);
    enter(a);
    vi.advanceTimersByTime(500);
    const bubble = h.el!;
    a.dispatchEvent(new PointerEvent('pointerleave', { clientX: 120, clientY: 120, relatedTarget: bubble }));
    bubble.dispatchEvent(new PointerEvent('pointerenter'));
    vi.advanceTimersByTime(1000);
    expect(h.isOpen).toBe(true);
    bubble.dispatchEvent(new PointerEvent('pointerleave', { relatedTarget: document.body }));
    vi.advanceTimersByTime(150);
    expect(reasons).toEqual(['leave', 'leave']);
  });

  it('a keyboard focus opens it at once; Tab goes into it; the pointer leaving keeps it while the focus is inside; Escape back to the trigger', () => {
    const { a, h, reasons } = card();
    key(document.body, 'Tab');
    a.focus();
    expect(h.isOpen).toBe(true);
    expect(document.activeElement).toBe(a);
    key(a, 'Tab');
    const follow = h.el!.querySelector('.follow')!;
    expect(document.activeElement).toBe(follow);
    h.el!.dispatchEvent(new PointerEvent('pointerleave', { relatedTarget: document.body }));
    vi.advanceTimersByTime(500);
    expect(h.isOpen).toBe(true);
    key(follow, 'Escape');
    expect(reasons).toEqual(['escape']);
    expect(document.activeElement).toBe(a);
    // The focus given back by the keyboard does not open it again.
    expect(h.isOpen).toBe(false);
  });

  it('the focus leaving the trigger elsewhere closes it; never modal', () => {
    const { a, h, reasons } = card();
    h.update({ modal: true });
    const next = document.body.appendChild(document.createElement('button'));
    key(document.body, 'Tab');
    a.focus();
    expect(h.el!.hasAttribute('aria-modal')).toBe(false);
    next.focus();
    expect(reasons).toEqual(['focus']);
  });
});

describe('the review of the finished rows (independent eyes)', () => {
  function modalOf(label: string, group: string) {
    const t = document.body.appendChild(document.createElement('button'));
    t.textContent = label;
    const content = () => Object.assign(document.createElement('button'), { className: `in-${label}` });
    return { t, h: keep(popover(t, { content, modal: true, group, animation: 'none' })) };
  }

  it('two modals open at once: only the newest keeps the focus (no traps fighting); the first closed, the page stays shut for the second', () => {
    const main = document.body.appendChild(document.createElement('main'));
    main.append('page');
    const a = modalOf('A', 'one');
    const b = modalOf('B', 'two');
    a.h.open();
    let moves = 0;
    document.addEventListener('focusin', () => void moves++);
    b.h.open();
    expect(moves).toBeLessThan(5);
    expect(document.activeElement!.className).toBe('in-B');
    // The first one is under the second: shut too.
    expect(a.h.el!.getAttribute('aria-hidden')).toBe('true');
    a.h.close();
    expect(b.h.isOpen).toBe(true);
    expect(main.getAttribute('aria-hidden')).toBe('true');
    b.h.close();
    expect(main.hasAttribute('aria-hidden')).toBe(false);
  });

  it('a modal opened from inside a modal: the parent shut while the child is open, given back after', () => {
    const t = document.body.appendChild(document.createElement('button'));
    let inner: PopoverHandle | null = null;
    const outer = keep(popover(t, {
      modal: true, animation: 'none',
      content: () => {
        const b = document.createElement('button');
        b.className = 'inner';
        inner = keep(popover(b, { content: () => document.createElement('input'), modal: true, animation: 'none' }));
        return b;
      },
    }));
    outer.open();
    inner!.open();
    expect(outer.el!.getAttribute('aria-hidden')).toBe('true');
    expect(document.activeElement!.localName).toBe('input');
    inner!.close();
    expect(outer.el!.hasAttribute('aria-hidden')).toBe(false);
    expect(document.activeElement!.className).toBe('inner');
  });

  it('a virtual anchor whose rectangle throws on reading: never a throw', () => {
    vi.stubGlobal('reportError', () => {});
    const bad = { getBoundingClientRect: () => ({ get left(): number { throw new Error('app'); }, top: 0, right: 0, bottom: 0 }) };
    const h = keep(tooltip(bad, { content: 'x' }));
    const p = keep(popover(bad, { content: 'x' }));
    expect(() => (h.show(), p.open(), p.reposition())).not.toThrow();
    expect(h.shown).toBe(false);
    vi.unstubAllGlobals();
  });
});
