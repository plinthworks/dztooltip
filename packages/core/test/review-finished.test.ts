// An independent review of the finished rows (docs/behaviors/tooltips-popovers.md 34, 36, 39, 40; 2026-11-16, « fais-le
// et je veux une page de test »): each suspicion a test, failing first where it was a defect. Expectations by hand.
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { tooltip, type TooltipHandle } from '../src/tooltip.js';
import { popover, type PopoverCloseReason, type PopoverHandle } from '../src/popover.js';

type B = { left: number; right: number; top: number; bottom: number };
const rect = (b: B) => ({ ...b, width: b.right - b.left, height: b.bottom - b.top, x: b.left, y: b.top, toJSON: () => null });
const handles: (TooltipHandle | PopoverHandle)[] = [];
const keep = <T extends TooltipHandle | PopoverHandle>(h: T): T => (handles.push(h), h);
/** The frames asked and not cancelled, by id. */
let frames = new Map<number, FrameRequestCallback>();
let ids = 0;
const flush = (): void => {
  const f = [...frames.values()];
  frames = new Map();
  for (const cb of f) cb(0);
};
beforeEach(() => {
  frames = new Map();
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => (frames.set(++ids, cb), ids));
  vi.spyOn(window, 'cancelAnimationFrame').mockImplementation((id) => void frames.delete(id));
});
afterEach(() => {
  for (const h of handles.splice(0)) h.destroy();
  document.body.innerHTML = '';
  vi.useRealTimers();
  vi.restoreAllMocks();
});
/** A Tab (or Shift+Tab) pressed on `el`: whether the code kept it from the browser. */
const tab = (el: Element, shiftKey = false): boolean => !el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', shiftKey, bubbles: true, cancelable: true }));
/** Not drawn (`display: none` around it): what a browser's `checkVisibility()` answers, given here (jsdom has none). */
const undrawn = (el: HTMLElement): HTMLElement => (Object.assign(el, { checkVisibility: () => false }), el);

describe('the focus in a popover (36)', () => {
  function made(modal: boolean, kids: (d: Document) => HTMLElement[], o: Partial<Parameters<typeof popover>[1]> = {}) {
    const t = document.body.appendChild(document.createElement('button'));
    t.textContent = 'Ouvrir';
    document.body.appendChild(document.createElement('input'));
    const reasons: PopoverCloseReason[] = [];
    const content = () => {
      const f = document.createElement('div');
      f.append(...kids(document));
      return f;
    };
    const h = keep(popover(t, { content, modal, animation: 'none', onClose: (r) => reasons.push(r), ...o }));
    return { t, h, reasons };
  }
  const heading = (d: Document): HTMLElement => Object.assign(d.createElement('h2'), { tabIndex: -1, className: 'title', textContent: 'Titre' });
  const button = (d: Document, c: string): HTMLElement => Object.assign(d.createElement('button'), { className: c });

  it('a static heading given the focus (initialFocus, tabindex -1): Tab goes on to the controls after it — the popover stays open', () => {
    for (const modal of [false, true]) {
      const { t, h, reasons } = made(modal, (d) => [heading(d), button(d, 'ok')], { initialFocus: (b) => b.querySelector<HTMLElement>('.title') });
      t.click();
      expect(document.activeElement!.className).toBe('title');
      // The browser moves the focus to the button after it: not taken from it, nothing closed.
      expect(tab(document.activeElement!)).toBe(false);
      expect(h.isOpen).toBe(true);
      expect(reasons).toEqual([]);
      h.close();
    }
  });

  it('a modal: a control not drawn is skipped — the first focus and Tab\'s wrap go to the first one drawn', () => {
    const { t, h } = made(true, (d) => [undrawn(button(d, 'gone')), button(d, 'first'), button(d, 'last')]);
    t.click();
    expect(document.activeElement!.className).toBe('first');
    h.el!.querySelector<HTMLElement>('.last')!.focus();
    expect(tab(document.activeElement!)).toBe(true);
    expect(document.activeElement!.className).toBe('first');
  });

  it('a modal: Shift+Tab on its first drawn control wraps to the last drawn one', () => {
    const { t, h } = made(true, (d) => [button(d, 'first'), button(d, 'last'), undrawn(button(d, 'gone'))]);
    t.click();
    expect(tab(document.activeElement!, true)).toBe(true);
    expect(document.activeElement!.className).toBe('last');
    expect(h.isOpen).toBe(true);
  });

  it('a modal whose trigger leaves the page: closed at the next frame, the page given back', async () => {
    const main = document.body.appendChild(document.createElement('main'));
    const t = main.appendChild(document.createElement('button'));
    const other = document.body.appendChild(document.createElement('nav'));
    const h = keep(popover(t, { content: () => Object.assign(document.createElement('button'), { textContent: 'ok' }), modal: true, animation: 'none' }));
    t.click();
    expect(other.getAttribute('aria-hidden')).toBe('true');
    t.remove();
    // The page's change heard (a microtask), then the frame.
    await Promise.resolve();
    flush();
    expect(h.isOpen).toBe(false);
    expect(other.hasAttribute('aria-hidden')).toBe(false);
    expect(main.hasAttribute('aria-hidden')).toBe(false);
  });
});

describe('an iframe taken out of the page while its anchor\'s bubble shows above it (34)', () => {
  function frame() {
    const f = document.body.appendChild(document.createElement('iframe'));
    f.getBoundingClientRect = () => rect({ left: 100, right: 400, top: 50, bottom: 200 });
    const d = f.contentDocument!;
    const b = d.body.appendChild(d.createElement('button'));
    b.textContent = 'Dans le cadre';
    b.getBoundingClientRect = () => rect({ left: 10, right: 50, top: 10, bottom: 30 });
    // What a browser does (jsdom tears the document down instead): a document whose frame left the page has no window,
    // and its elements stay connected to it.
    const out = (): void => {
      f.remove();
      Object.defineProperty(d, 'defaultView', { configurable: true, get: () => null });
      Object.defineProperty(b, 'isConnected', { configurable: true, get: () => true });
    };
    return { b, out };
  }

  it('the tooltip goes at the next frame, and its frames (every frame) stop', async () => {
    const { b, out } = frame();
    const h = keep(tooltip(b, { content: 'Aide', delayMs: 0, root: document.body, everyFrame: true }));
    h.show();
    const tip = document.querySelector<HTMLElement>('.dzt-tooltip')!;
    expect(tip.hidden).toBe(false);
    out();
    await Promise.resolve();
    flush();
    expect(tip.hidden).toBe(true);
    flush();
    expect(frames.size).toBe(0);
  });

  it('the popover closes, « gone »', async () => {
    const { b, out } = frame();
    const reasons: PopoverCloseReason[] = [];
    const h = keep(popover(b, { content: 'Détails', root: document.body, animation: 'none', onClose: (r) => reasons.push(r) }));
    h.open();
    out();
    await Promise.resolve();
    flush();
    expect(reasons).toEqual(['gone']);
  });
});

describe('nothing left running (39, 40)', () => {
  it('a tooltip followed every frame, destroyed while shown: no frame asked any more', () => {
    const b = document.body.appendChild(document.createElement('button'));
    b.getBoundingClientRect = () => rect({ left: 10, right: 50, top: 10, bottom: 30 });
    const h = tooltip(b, { content: 'Suit', delayMs: 0, everyFrame: true });
    h.show();
    expect(frames.size).toBeGreaterThan(0);
    h.destroy();
    flush();
    expect(frames.size).toBe(0);
  });

  it('a hover card destroyed while its delay runs: never opens; destroyed after the pointer left it: no timer fires', () => {
    vi.useFakeTimers();
    const t = document.body.appendChild(document.createElement('a'));
    const opened: number[] = [];
    const h = popover(t, { content: 'Carte', openOn: 'hover', animation: 'none', onOpen: () => opened.push(1) });
    t.dispatchEvent(new PointerEvent('pointerenter', { pointerType: 'mouse', clientX: 5, clientY: 5 }));
    h.destroy();
    vi.advanceTimersByTime(2000);
    expect(opened).toEqual([]);
    expect(vi.getTimerCount()).toBe(0);
  });
});
