// Following the anchor, the anchor gone, a virtual anchor refused, a modal <dialog> and `root`
// (docs/behaviors/tooltips-popovers.md 27, 28, 30). jsdom has no ResizeObserver nor IntersectionObserver: stand-ins
// record what is watched and call back on demand; frames are run by hand. Expectations written by hand; the real
// observers and the dialog's inertness are checked in real browsers (scripts/browser.mjs, « robust »).
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { popover, type PopoverCloseReason } from '../src/popover.js';
import { tooltip } from '../src/tooltip.js';

class FakeRO {
  static all: FakeRO[] = [];
  seen: Element[] = [];
  off = false;
  constructor(readonly cb: () => void) {
    FakeRO.all.push(this);
  }
  observe(e: Element): void {
    this.seen.push(e);
  }
  disconnect(): void {
    this.off = true;
  }
}
class FakeIO {
  static all: FakeIO[] = [];
  seen: Element[] = [];
  off = false;
  constructor(readonly cb: (entries: unknown[]) => void, readonly o: { rootMargin?: string; threshold?: number | number[] }) {
    FakeIO.all.push(this);
  }
  observe(e: Element): void {
    this.seen.push(e);
  }
  disconnect(): void {
    this.off = true;
  }
}

let frames: FrameRequestCallback[] = [];
const flush = (): void => {
  const f = frames;
  frames = [];
  for (const cb of f) cb(0);
};
// `as any`: the window's observers replaced by the stand-ins above, put back after each test.
const w = window as any;
const saved = { RO: w.ResizeObserver, IO: w.IntersectionObserver };
beforeEach(() => {
  FakeRO.all = [];
  FakeIO.all = [];
  frames = [];
  w.ResizeObserver = FakeRO;
  w.IntersectionObserver = FakeIO;
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => frames.push(cb));
  vi.spyOn(window, 'cancelAnimationFrame').mockImplementation((id) => void (frames[id - 1] = () => {}));
  vi.spyOn(window, 'innerWidth', 'get').mockReturnValue(800);
  vi.spyOn(window, 'innerHeight', 'get').mockReturnValue(600);
});
const cleanups: (() => void)[] = [];
afterEach(() => {
  for (const c of cleanups.splice(0)) c();
  w.ResizeObserver = saved.RO;
  w.IntersectionObserver = saved.IO;
  document.body.innerHTML = '';
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

type Box = { left: number; right: number; top: number; bottom: number };
const rect = (el: Element, b: Box): void => {
  el.getBoundingClientRect = () => ({ ...b, width: b.right - b.left, height: b.bottom - b.top, x: b.left, y: b.top, toJSON: () => null });
};
function button(label = 'Details', into: Element = document.body): HTMLButtonElement {
  const b = into.appendChild(document.createElement('button'));
  b.textContent = label;
  rect(b, { left: 100.4, right: 180.6, top: 50.2, bottom: 76.8 });
  return b;
}
const start = (el: HTMLElement | null): string => el?.style.getPropertyValue('inset-inline-start') ?? '';
const tipEl = (): HTMLElement => document.querySelector<HTMLElement>('.dzt-tooltip.dzt-float')!;

describe('a popover follows its trigger while open, and nothing is watched once closed (27)', () => {
  function open() {
    const t = button();
    const closed: PopoverCloseReason[] = [];
    const h = popover(t, { content: 'Hello', onClose: (r) => closed.push(r) });
    cleanups.push(() => h.destroy());
    h.open();
    return { t, h, closed, ro: FakeRO.all[0]!, io: FakeIO.all[0]! };
  }

  it('its trigger and itself watched for size; the trigger\'s box fitted by an IntersectionObserver', () => {
    const { t, h, ro, io } = open();
    expect(FakeRO.all).toHaveLength(1);
    expect(ro.seen).toEqual([t, h.el]);
    expect(io.seen).toEqual([t]);
    // The box rounded outward (50, 100 – 181, 77) as insets of the 800 × 600 window: 50, 800 - 181, 600 - 77, 100.
    expect(io.o.rootMargin).toBe('-50px -619px -523px -100px');
  });

  it('the trigger grown: placed again at the next frame, once for two changes', () => {
    const { t, h, ro } = open();
    // The bubble is 0 wide in jsdom: its start is the anchor's middle, 140.5.
    expect(start(h.el)).toBe('140.5px');
    rect(t, { left: 100, right: 300, top: 50, bottom: 90 });
    ro.cb();
    ro.cb();
    expect(frames).toHaveLength(1);
    expect(start(h.el)).toBe('140.5px');
    flush();
    expect(start(h.el)).toBe('200px');
  });

  it('the trigger moved with no scroll (its first report ignored): placed again, the observer fitted to the new box', () => {
    const { t, h, io } = open();
    io.cb([]);
    expect(frames).toHaveLength(0);
    rect(t, { left: 300, right: 380, top: 50, bottom: 76 });
    io.cb([]);
    flush();
    expect(start(h.el)).toBe('340px');
    expect(io.off).toBe(true);
    const io2 = FakeIO.all.at(-1)!;
    expect(io2).not.toBe(io);
    expect(io2.seen).toEqual([t]);
    // 800 - 380 = 420; 600 - 76 = 524.
    expect(io2.o.rootMargin).toBe('-50px -420px -524px -300px');
  });

  it('the window resized: placed again', () => {
    const { t, h } = open();
    rect(t, { left: 500, right: 580, top: 50, bottom: 76 });
    window.dispatchEvent(new Event('resize'));
    flush();
    expect(start(h.el)).toBe('540px');
  });

  it('closed: the observers taken down, a resize or a scroll asks for no frame', () => {
    const { h, ro, io } = open();
    h.close();
    expect(ro.off).toBe(true);
    expect(io.off).toBe(true);
    window.dispatchEvent(new Event('resize'));
    document.dispatchEvent(new Event('scroll'));
    expect(frames).toHaveLength(0);
  });

  it('its trigger no longer drawn: closed, gone (28)', () => {
    const { t, h, ro, closed } = open();
    // `as any`: jsdom has no checkVisibility; the browser's answer for `display: none` around the trigger.
    (t as any).checkVisibility = () => false;
    ro.cb();
    flush();
    expect(h.isOpen).toBe(false);
    expect(closed).toEqual(['gone']);
  });
});

describe('a tooltip follows its anchor, and goes when its anchor goes (27, 28)', () => {
  function shown() {
    const b = button('Save');
    const h = tooltip(b, { content: 'Saves the draft' });
    cleanups.push(() => h.destroy());
    h.show();
    return { b, h, ro: FakeRO.all[0]!, io: FakeIO.all[0]! };
  }

  it('shown: its anchor and itself watched; the anchor grown, placed again at the next frame', () => {
    const { b, ro, io } = shown();
    expect(ro.seen).toEqual([b, tipEl()]);
    expect(io.seen).toEqual([b]);
    rect(b, { left: 100, right: 300, top: 50, bottom: 90 });
    ro.cb();
    flush();
    expect(start(tipEl())).toBe('200px');
  });

  it('the window resized while shown: placed again (row 13 of the audit)', () => {
    const { b } = shown();
    rect(b, { left: 400, right: 500, top: 50, bottom: 90 });
    window.dispatchEvent(new Event('resize'));
    flush();
    expect(start(tipEl())).toBe('450px');
  });

  it('its anchor taken out of the page: hidden at the next frame, its description gone, nothing watched', async () => {
    const { b, h, ro, io } = shown();
    b.remove();
    // The page's change is told after the task (a MutationObserver), then a frame.
    await Promise.resolve();
    flush();
    expect(h.shown).toBe(false);
    expect(tipEl().hidden).toBe(true);
    expect(b.hasAttribute('aria-describedby')).toBe(false);
    expect(ro.off && io.off).toBe(true);
  });

  it('its anchor no longer drawn: hidden', () => {
    const { b, h, ro } = shown();
    // `as any`: jsdom has no checkVisibility; the browser's answer for `display: none` around the anchor.
    (b as any).checkVisibility = () => false;
    ro.cb();
    flush();
    expect(h.shown).toBe(false);
  });

  it('hidden: nothing watched, a resize asks for no frame', () => {
    const { h, ro, io } = shown();
    h.hide();
    expect(ro.off && io.off).toBe(true);
    window.dispatchEvent(new Event('resize'));
    expect(frames).toHaveLength(0);
  });

  it('moved to another anchor: the first one no longer watched', () => {
    const { ro } = shown();
    const c = button('Copy');
    const h2 = tooltip(c, { content: 'Copies' });
    cleanups.push(() => h2.destroy());
    h2.show();
    expect(ro.off).toBe(true);
    expect(FakeRO.all.at(-1)!.seen).toEqual([c, tipEl()]);
  });
});

describe('an anchor that is neither an element nor a virtual anchor is refused without throwing (28, 38)', () => {
  // No `getBoundingClientRect`: not a virtual anchor (38).
  const shapeless = { contextElement: null, left: 0, top: 0 };

  it('tooltip(): a handle that does nothing, one TypeError reported, nothing of the value in it', () => {
    const told: unknown[] = [];
    vi.stubGlobal('reportError', (e: unknown) => void told.push(e));
    // `as never`: an object the types refuse — what a JavaScript caller may still pass.
    const h = tooltip(shapeless as never, { content: 'x' });
    expect(() => (h.show(), h.update({ content: 'y' }), h.hide(), h.destroy())).not.toThrow();
    expect(h.shown).toBe(false);
    expect(told).toHaveLength(1);
    expect(told[0]).toBeInstanceOf(TypeError);
    expect((told[0] as Error).message).toMatch(/^dztooltip: not-an-element — tooltip\(el\)/);
    expect((told[0] as Error).message).not.toContain('left');
    expect(document.querySelector('.dzt-float')).toBeNull();
  });

  it('popover(): the same, and null and a text node too', () => {
    const told: unknown[] = [];
    vi.stubGlobal('reportError', (e: unknown) => void told.push(e));
    for (const bad of [shapeless, null, document.createTextNode('x')]) {
      // `as never`: what the types refuse, passed as JavaScript would.
      const h = popover(bad as never, { content: 'x' });
      expect(() => (h.open(), h.toggle(), h.reposition(), h.update({}), h.close(), h.destroy())).not.toThrow();
      expect(h.isOpen).toBe(false);
      expect(h.el).toBeNull();
    }
    expect(told).toHaveLength(3);
    expect((told[0] as Error).message).toMatch(/^dztooltip: not-an-element — popover\(trigger\)/);
  });
});

describe('inside an open <dialog>, or a root given (30)', () => {
  function dialog(): HTMLDialogElement {
    const d = document.body.appendChild(document.createElement('dialog'));
    d.setAttribute('open', '');
    return d;
  }

  it('a popover opened from a dialog is put in that dialog; elsewhere at the page\'s end', () => {
    const d = dialog();
    const h = popover(button('In', d), { content: 'x' });
    const o = popover(button('Out'), { content: 'y', group: 'other' });
    cleanups.push(() => (h.destroy(), o.destroy()));
    h.open();
    o.open();
    expect(h.el!.parentElement).toBe(d);
    expect(o.el!.parentElement).toBe(document.body);
  });

  it('the page\'s tooltip goes into the dialog of the anchor it shows on, and back out', () => {
    const d = dialog();
    const a = tooltip(button('In', d), { content: 'x' });
    const b = tooltip(button('Out'), { content: 'y' });
    cleanups.push(() => (a.destroy(), b.destroy()));
    a.show();
    expect(tipEl().parentElement).toBe(d);
    b.show();
    expect(tipEl().parentElement).toBe(document.body);
  });

  it('root: put there instead', () => {
    const layer = document.body.appendChild(document.createElement('div'));
    const d = dialog();
    const a = tooltip(button('In', d), { content: 'x', root: layer });
    const p = popover(button('P'), { content: 'y', root: layer });
    cleanups.push(() => (a.destroy(), p.destroy()));
    a.show();
    expect(tipEl().parentElement).toBe(layer);
    p.open();
    expect(p.el!.parentElement).toBe(layer);
  });

  it('a dialog that is not open does not take it', () => {
    const d = document.body.appendChild(document.createElement('dialog'));
    const a = tooltip(button('In', d), { content: 'x' });
    cleanups.push(() => a.destroy());
    a.show();
    expect(tipEl().parentElement).toBe(document.body);
  });
});
