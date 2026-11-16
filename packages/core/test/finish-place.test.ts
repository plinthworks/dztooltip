// Where a bubble goes, finished (docs/behaviors/tooltips-popovers.md 31 offset, 32 shift, 34 an iframe's anchor, 37 a
// link broken over lines, 38 virtual anchors and following the cursor, 39 every frame). Expectations worked out by
// hand from the window (800 × 600), the anchor and the bubble (100 × 30, no margin, no padding to the edges).
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { place, type TipOffset, type TipOffsetState, type TipSide } from '../src/bubble.js';
import { pointed } from '../src/anchor.js';
import { tooltip } from '../src/tooltip.js';
import { popover } from '../src/popover.js';

type B = { left: number; right: number; top: number; bottom: number };
const rect = (b: B) => ({ ...b, width: b.right - b.left, height: b.bottom - b.top, x: b.left, y: b.top, toJSON: () => null });
// `as any`: jsdom lays nothing out; a bubble's size is given here, every DzTooltip bubble 100 × 30.
const proto = HTMLElement.prototype as any;
const saved = { w: Object.getOwnPropertyDescriptor(proto, 'offsetWidth')!, h: Object.getOwnPropertyDescriptor(proto, 'offsetHeight')! };
let frames: FrameRequestCallback[] = [];
const flush = (): void => {
  const f = frames;
  frames = [];
  for (const cb of f) cb(0);
};
beforeEach(() => {
  vi.spyOn(window, 'innerWidth', 'get').mockReturnValue(800);
  vi.spyOn(window, 'innerHeight', 'get').mockReturnValue(600);
  Object.defineProperty(proto, 'offsetWidth', { configurable: true, get(this: HTMLElement) { return this.matches('.dzt-float, .probe') ? 100 : 0; } });
  Object.defineProperty(proto, 'offsetHeight', { configurable: true, get(this: HTMLElement) { return this.matches('.dzt-float, .probe') ? 30 : 0; } });
  frames = [];
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => frames.push(cb));
  vi.spyOn(window, 'cancelAnimationFrame').mockImplementation((id) => void (frames[id - 1] = () => {}));
});
const cleanups: (() => void)[] = [];
afterEach(() => {
  for (const c of cleanups.splice(0)) c();
  Object.defineProperty(proto, 'offsetWidth', saved.w);
  Object.defineProperty(proto, 'offsetHeight', saved.h);
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  document.body.innerHTML = '';
});

function setup(box: B) {
  const el = document.body.appendChild(document.createElement('div'));
  el.className = 'probe';
  const anchor = document.body.appendChild(document.createElement('button'));
  anchor.getBoundingClientRect = () => rect(box);
  const at = (side: TipSide, o: { align?: -1 | 0 | 1; dir?: 'ltr' | 'rtl'; offset?: number | TipOffset | ((s: TipOffsetState) => number | TipOffset); shift?: boolean | 'attached' } = {}) => {
    const used = place(el, anchor, o.dir ?? 'ltr', side, o.align ?? 0, true, false, { offset: o.offset, shift: o.shift });
    return { used, top: el.style.getPropertyValue('inset-block-start'), start: el.style.getPropertyValue('inset-inline-start'), arrow: el.style.getPropertyValue('--dzt-tip-at') };
  };
  return { el, anchor, at };
}
// The middle of the window: 380–420 × 280–300.
const MID = { left: 380, right: 420, top: 280, bottom: 300 };

describe('offset (31)', () => {
  it('none: the 4 px gap, as before; a number is the gap (negative: over the anchor)', () => {
    const { at } = setup(MID);
    expect(at('block-end')).toMatchObject({ top: '304px', start: '350px' });
    expect(at('block-end', { offset: 10 })).toMatchObject({ top: '310px', start: '350px' });
    expect(at('block-start', { offset: 10 })).toMatchObject({ top: '240px' });
    expect(at('block-end', { offset: -10 })).toMatchObject({ top: '290px' });
    // start = 420 + 12.
    expect(at('inline-end', { offset: 12 })).toMatchObject({ start: '432px' });
  });

  it('crossAxis: towards the line\'s end, mirrored in right to left; the arrow still on the anchor\'s middle', () => {
    const { at } = setup(MID);
    // start = 350 + 20; arrow = 400 - 370.
    expect(at('block-end', { offset: { crossAxis: 20 } })).toEqual({ used: 'block-end', top: '304px', start: '370px', arrow: '30px' });
    // Right to left: the same logical numbers (the anchor sits in the middle), measured from the right edge.
    expect(at('block-end', { offset: { crossAxis: 20 }, dir: 'rtl' })).toMatchObject({ start: '370px' });
    // Beside: towards the block's end. top = 290 - 15 + 6.
    expect(at('inline-end', { offset: { mainAxis: 8, crossAxis: 6 } })).toMatchObject({ top: '281px', start: '428px' });
  });

  it('alignmentAxis: an aligned placement only, inwards from its edge, in place of crossAxis', () => {
    const { at } = setup(MID);
    // -start: 380 + 15; -end: 420 - 100 - 15; centred: 350 + 5 (crossAxis).
    expect(at('block-end', { align: -1, offset: { alignmentAxis: 15, crossAxis: 99 } })).toMatchObject({ start: '395px' });
    expect(at('block-end', { align: 1, offset: { alignmentAxis: 15, crossAxis: 99 } })).toMatchObject({ start: '305px' });
    expect(at('block-end', { align: 0, offset: { alignmentAxis: 15, crossAxis: 5 } })).toMatchObject({ start: '355px' });
  });

  it('a function: told the side tried, the alignment and the sizes; its gap counts in the choice of a side', () => {
    const told: TipOffsetState[] = [];
    const { at } = setup(MID);
    expect(at('block-end', { offset: (s) => (told.push(s), 50) })).toMatchObject({ top: '350px' });
    expect(told).toEqual([{ side: 'block-end', align: 0, anchor: { inlineSize: 40, blockSize: 20 }, bubble: { inlineSize: 100, blockSize: 30 } }]);
    // By the window's bottom (540–560): 4 px leaves 36 px below, enough; 20 px leaves 20, too little — above.
    const low = setup({ left: 380, right: 420, top: 540, bottom: 560 });
    expect(low.at('block-end', { offset: 4 }).used).toBe('block-end');
    expect(low.at('block-end', { offset: 20 })).toMatchObject({ used: 'block-start', top: '490px' });
  });

  it('a value that is not a finite number counts as none; a function that throws is reported and counts as none', () => {
    const told: unknown[] = [];
    vi.stubGlobal('reportError', (e: unknown) => void told.push(e));
    const { at } = setup(MID);
    expect(at('block-end', { offset: Number.NaN })).toMatchObject({ top: '304px' });
    expect(at('block-end', { offset: { mainAxis: Infinity, crossAxis: Number.NaN } })).toMatchObject({ top: '304px', start: '350px' });
    expect(at('block-end', { offset: () => { throw new Error('app'); } })).toMatchObject({ top: '304px' });
    expect(told).toHaveLength(1);
  });
});

describe('shift (32)', () => {
  // An anchor half past the window's end: 795–855; centred, the bubble would start at 775.
  const OFF = { left: 795, right: 855, top: 280, bottom: 300 };

  it('true (the default): kept in the window (800 - 100), the arrow held 12 px from its corner', () => {
    const { at } = setup(OFF);
    expect(at('block-end')).toMatchObject({ start: '700px', arrow: '88px' });
    expect(at('block-end', { shift: true })).toMatchObject({ start: '700px' });
  });

  it('attached: never off its anchor — 12 px of corner and 8 px of anchor beside it (795 + 20 - 100)', () => {
    const { at } = setup(OFF);
    expect(at('block-end', { shift: 'attached' })).toMatchObject({ start: '715px', arrow: '88px' });
    // Right to left, the same anchor past the window's start edge (-55 to 5): the same logical place.
    const rtl = setup({ left: -55, right: 5, top: 280, bottom: 300 });
    expect(rtl.at('block-end', { shift: 'attached', dir: 'rtl' })).toMatchObject({ start: '715px' });
    // In the window, nothing changes.
    expect(setup(MID).at('block-end', { shift: 'attached' })).toMatchObject({ start: '350px' });
  });

  it('false: never slid', () => {
    const { at } = setup(OFF);
    expect(at('block-end', { shift: false })).toMatchObject({ start: '775px' });
  });
});

describe('a link broken over lines (37)', () => {
  function link() {
    const a = document.body.appendChild(document.createElement('a'));
    a.href = '#x';
    a.textContent = 'a link';
    a.getBoundingClientRect = () => rect({ left: 100, right: 340, top: 100, bottom: 140 });
    // Two pieces on the first line (joined), one on the second.
    a.getClientRects = () => [rect({ left: 300, right: 320, top: 100, bottom: 120 }), rect({ left: 320, right: 340, top: 100, bottom: 120 }), rect({ left: 100, right: 160, top: 120, bottom: 140 })] as never;
    return a;
  }

  it('placed by its first piece, not by the box around them all', () => {
    const el = document.body.appendChild(document.createElement('div'));
    el.className = 'probe';
    place(el, link(), 'ltr', 'block-end', 0);
    // Under the first line (120 + 4), centred on 300–340.
    expect(el.style.getPropertyValue('inset-block-start')).toBe('124px');
    expect(el.style.getPropertyValue('inset-inline-start')).toBe('270px');
  });

  it('by the piece under the pointer, or the nearest to it', () => {
    const el = document.body.appendChild(document.createElement('div'));
    el.className = 'probe';
    const a = link();
    place(el, pointed(a, () => ({ i: 130, b: 130 }), 'piece'), 'ltr', 'block-end', 0);
    expect([el.style.getPropertyValue('inset-block-start'), el.style.getPropertyValue('inset-inline-start')]).toEqual(['144px', '80px']);
    place(el, pointed(a, () => ({ i: 500, b: 110 }), 'piece'), 'ltr', 'block-end', 0);
    expect(el.style.getPropertyValue('inset-inline-start')).toBe('270px');
  });

  it('a tooltip shown by hover takes the piece hovered; by the keyboard, the first', () => {
    const a = link();
    const h = tooltip(a, { content: 'Où mène le lien', delayMs: 0 });
    cleanups.push(() => h.destroy());
    a.dispatchEvent(new PointerEvent('pointerenter', { pointerType: 'mouse', clientX: 130, clientY: 130 }));
    const tip = document.querySelector<HTMLElement>('.dzt-tooltip')!;
    expect(tip.style.getPropertyValue('inset-inline-start')).toBe('80px');
    h.hide();
    h.show();
    expect(tip.style.getPropertyValue('inset-inline-start')).toBe('270px');
  });
});

describe('virtual anchors (38)', () => {
  it('placed by its rectangle (a point given as x, y, width, height)', () => {
    const el = document.body.appendChild(document.createElement('div'));
    el.className = 'probe';
    place(el, { getBoundingClientRect: () => ({ x: 200, y: 100, width: 0, height: 0 }) }, 'ltr', 'block-end', 0);
    expect([el.style.getPropertyValue('inset-block-start'), el.style.getPropertyValue('inset-inline-start')]).toEqual(['104px', '150px']);
  });

  it('a tooltip shown by code at it; no element described; hidden by code', () => {
    const ctx = document.body.appendChild(document.createElement('canvas'));
    let at = { left: 200, right: 200, top: 100, bottom: 100 };
    const h = tooltip({ getBoundingClientRect: () => at, contextElement: ctx }, { content: '12 kg' });
    cleanups.push(() => h.destroy());
    h.show();
    const tip = document.querySelector<HTMLElement>('.dzt-tooltip')!;
    expect(h.shown).toBe(true);
    expect(tip.style.getPropertyValue('inset-inline-start')).toBe('150px');
    expect(document.querySelector('[aria-describedby]')).toBeNull();
    // Moved, shown again: placed again.
    at = { left: 300, right: 300, top: 100, bottom: 100 };
    h.show();
    expect(tip.style.getPropertyValue('inset-inline-start')).toBe('250px');
    h.hide();
    expect(h.shown).toBe(false);
  });

  it('a rectangle that cannot be read: nothing shown, reported once, never a throw', () => {
    const told: unknown[] = [];
    vi.stubGlobal('reportError', (e: unknown) => void told.push(e));
    const h = tooltip({ getBoundingClientRect: () => { throw new Error('app'); } }, { content: 'x' });
    cleanups.push(() => h.destroy());
    expect(() => (h.show(), h.show())).not.toThrow();
    expect(h.shown).toBe(false);
    expect(told).toHaveLength(1);
    expect((told[0] as Error).message).toMatch(/^dztooltip: not-a-rect/);
    const p = popover({ getBoundingClientRect: () => ({ left: 'x' }) as never }, { content: 'x' });
    cleanups.push(() => p.destroy());
    expect(() => p.open()).not.toThrow();
    expect(told).toHaveLength(2);
  });

  it('a Range-like anchor: its container is its element (direction, « gone » when it leaves)', () => {
    const p = document.body.appendChild(document.createElement('p'));
    p.textContent = 'du texte choisi';
    const range = { commonAncestorContainer: p.firstChild!, getBoundingClientRect: () => rect({ left: 100, right: 200, top: 50, bottom: 70 }) };
    const h = popover(range, { content: 'Gras', label: 'Mise en forme', animation: 'none' });
    cleanups.push(() => h.destroy());
    h.open();
    expect(h.el!.getAttribute('aria-label')).toBe('Mise en forme');
    expect(h.el!.hasAttribute('aria-labelledby')).toBe(false);
    expect(h.el!.style.getPropertyValue('inset-inline-start')).toBe('100px');
    p.remove();
    h.reposition();
    // Its element gone: closed at the next check (27, 28).
    window.dispatchEvent(new Event('resize'));
    flush();
    expect(h.isOpen).toBe(false);
  });

  it('a virtual popover gives the focus back where it was (Escape)', () => {
    const before = document.body.appendChild(document.createElement('input'));
    before.focus();
    const h = popover({ getBoundingClientRect: () => rect({ left: 10, right: 20, top: 10, bottom: 20 }) }, { content: () => document.createElement('button'), label: 'Outils', animation: 'none' });
    cleanups.push(() => h.destroy());
    h.open();
    expect(h.el!.contains(document.activeElement)).toBe(true);
    document.activeElement!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(h.isOpen).toBe(false);
    expect(document.activeElement).toBe(before);
  });
});

describe('following the cursor (38)', () => {
  function zone() {
    const z = document.body.appendChild(document.createElement('div'));
    z.getBoundingClientRect = () => rect({ left: 0, right: 600, top: 400, bottom: 420 });
    return z;
  }
  const tipAt = () => { const t = document.querySelector<HTMLElement>('.dzt-tooltip')!; return [t.style.getPropertyValue('inset-block-start'), t.style.getPropertyValue('inset-inline-start')]; };

  it('true: at the pointer\'s point, moved with it once a frame', () => {
    const z = zone();
    const h = tooltip(z, { content: 'Ici', delayMs: 0, followCursor: true });
    cleanups.push(() => h.destroy());
    z.dispatchEvent(new PointerEvent('pointerenter', { pointerType: 'mouse', clientX: 100, clientY: 405 }));
    expect(tipAt()).toEqual(['409px', '50px']);
    z.dispatchEvent(new PointerEvent('pointermove', { pointerType: 'mouse', clientX: 300, clientY: 410 }));
    z.dispatchEvent(new PointerEvent('pointermove', { pointerType: 'mouse', clientX: 320, clientY: 410 }));
    expect(tipAt()).toEqual(['409px', '50px']);
    flush();
    expect(tipAt()).toEqual(['414px', '270px']);
  });

  it('inline: along the line only, the block from the anchor; a keyboard focus by the anchor', () => {
    const z = zone();
    const h = tooltip(z, { content: 'Ici', delayMs: 0, followCursor: 'inline' });
    cleanups.push(() => h.destroy());
    z.dispatchEvent(new PointerEvent('pointerenter', { pointerType: 'mouse', clientX: 100, clientY: 405 }));
    expect(tipAt()).toEqual(['424px', '50px']);
    h.hide();
    h.show();
    expect(tipAt()).toEqual(['424px', '250px']);
  });
});

describe('every frame (39)', () => {
  it('the anchor\'s box read at each frame while shown, placed again when it moved; no frame once hidden', () => {
    const b = document.body.appendChild(document.createElement('button'));
    let box = MID;
    b.getBoundingClientRect = () => rect(box);
    const h = tooltip(b, { content: 'Suit', delayMs: 0, everyFrame: true });
    cleanups.push(() => h.destroy());
    h.show();
    const tip = document.querySelector<HTMLElement>('.dzt-tooltip')!;
    expect(frames).toHaveLength(1);
    flush();
    expect(frames).toHaveLength(1);
    box = { ...MID, left: 480, right: 520 };
    flush();
    expect(tip.style.getPropertyValue('inset-inline-start')).toBe('450px');
    h.hide();
    flush();
    expect(frames).toHaveLength(0);
  });

  it('without it, no frame asked while nothing changes', () => {
    const b = document.body.appendChild(document.createElement('button'));
    b.getBoundingClientRect = () => rect(MID);
    const h = tooltip(b, { content: 'Calme', delayMs: 0 });
    cleanups.push(() => h.destroy());
    h.show();
    expect(frames).toHaveLength(0);
  });
});

describe('an anchor in an iframe, its bubble in the page above (34)', () => {
  function frame() {
    const f = document.body.appendChild(document.createElement('iframe'));
    f.getBoundingClientRect = () => rect({ left: 100, right: 400, top: 50, bottom: 200 });
    const d = f.contentDocument!;
    const b = d.body.appendChild(d.createElement('button'));
    b.textContent = 'Dans le cadre';
    b.getBoundingClientRect = () => rect({ left: 10, right: 50, top: 10, bottom: 30 });
    return { f, b };
  }

  it('the tooltip made in the page, placed over the frame by its place; its words the anchor\'s description', () => {
    const { b } = frame();
    const h = tooltip(b, { content: 'Aide', delayMs: 0, root: document.body });
    cleanups.push(() => h.destroy());
    h.show();
    const tip = document.querySelector<HTMLElement>('.dzt-tooltip')!;
    expect(tip.ownerDocument).toBe(document);
    expect(b.ownerDocument.querySelector('.dzt-tooltip')).toBeNull();
    // The anchor in the page: 110–150 × 60–80; below it, centred: 84, 130 - 50.
    expect([tip.style.getPropertyValue('inset-block-start'), tip.style.getPropertyValue('inset-inline-start')]).toEqual(['84px', '80px']);
    expect(b.hasAttribute('aria-describedby')).toBe(false);
    expect(b.getAttribute('aria-description')).toBe('Aide');
    h.hide();
    expect(b.hasAttribute('aria-description')).toBe(false);
  });

  it('a popover the same; a press in the page closes it; a root that cannot be reached is ignored', () => {
    const { b } = frame();
    const h = popover(b, { content: 'Détails', root: document.body, animation: 'none' });
    cleanups.push(() => h.destroy());
    h.open();
    expect(h.el!.ownerDocument).toBe(document);
    expect(h.el!.getAttribute('aria-label')).toBe('Dans le cadre');
    expect(b.getAttribute('aria-expanded')).toBe('true');
    document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, composed: true }));
    expect(h.isOpen).toBe(false);
    // Another page's element, not up the frames: the bubble stays in the anchor's document.
    const other = document.implementation.createHTMLDocument('x');
    const solo = document.body.appendChild(document.createElement('button'));
    const g = popover(solo, { content: 'x', root: other.body, animation: 'none' });
    cleanups.push(() => g.destroy());
    g.open();
    expect(g.el!.ownerDocument).toBe(document);
  });
});
