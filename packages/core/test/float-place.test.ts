// Where a bubble goes (docs/behaviors/tooltips-popovers.md 4): the side asked, the opposite one at an edge, kept in the
// window along the other axis, the arrow at the anchor's middle 12 px inside; logical in both directions. Expectations
// worked out by hand from the window (800 × 600), the anchor and the bubble's size.
import { describe, it, expect, afterEach, vi } from 'vitest';
import type { TooltipPlacement } from '../src/types.js';
import { place, type TipSide } from '../src/bubble.js';
import { placementOf } from '../src/dir.js';

afterEach(() => {
  vi.restoreAllMocks();
  document.body.innerHTML = '';
});

type Box = { left: number; right: number; top: number; bottom: number };
function setup(anchorBox: Box, size = { w: 100, h: 30 }, margin = 0) {
  vi.spyOn(window, 'innerWidth', 'get').mockReturnValue(800);
  vi.spyOn(window, 'innerHeight', 'get').mockReturnValue(600);
  const el = document.body.appendChild(document.createElement('div'));
  el.style.marginTop = `${margin}px`;
  Object.defineProperty(el, 'offsetWidth', { configurable: true, get: () => size.w });
  Object.defineProperty(el, 'offsetHeight', { configurable: true, get: () => size.h });
  const anchor = document.body.appendChild(document.createElement('button'));
  anchor.getBoundingClientRect = () => ({ ...anchorBox, width: anchorBox.right - anchorBox.left, height: anchorBox.bottom - anchorBox.top, x: anchorBox.left, y: anchorBox.top, toJSON: () => null });
  const at = (side: TipSide, dir: 'ltr' | 'rtl' = 'ltr', center = true, flip = true) => {
    const used = place(el, anchor, dir, side, center ? 0 : -1, flip);
    return { used, top: el.style.getPropertyValue('inset-block-start'), start: el.style.getPropertyValue('inset-inline-start'), arrow: el.style.getPropertyValue('--dzt-tip-at'), side: el.dataset['side'] };
  };
  return { el, at };
}

// An anchor in the middle of the window: 380–420 × 280–300.
const MID = { left: 380, right: 420, top: 280, bottom: 300 };

describe('place: each side, with room', () => {
  it('block-end: 4 px under the anchor, centred on it, the arrow at its middle', () => {
    const { at } = setup(MID);
    // top = 300 + 4; start = 400 - 50; arrow = 400 - 350.
    expect(at('block-end')).toEqual({ used: 'block-end', top: '304px', start: '350px', arrow: '50px', side: 'block-end' });
  });

  it('block-start: its bottom 4 px over the anchor', () => {
    const { at } = setup(MID);
    // top = 280 - 4 - 30.
    expect(at('block-start')).toMatchObject({ used: 'block-start', top: '246px', start: '350px' });
  });

  it('inline-end: 4 px after the anchor (to its right in left to right), centred on its block middle', () => {
    const { at } = setup(MID);
    // start = 420 + 4; top = 290 - 15; arrow along the block axis = 290 - 275.
    expect(at('inline-end')).toEqual({ used: 'inline-end', top: '275px', start: '424px', arrow: '15px', side: 'inline-end' });
  });

  it('inline-start: its end 4 px before the anchor', () => {
    const { at } = setup(MID);
    // start = 380 - 4 - 100.
    expect(at('inline-start')).toMatchObject({ used: 'inline-start', start: '276px' });
  });

  it('right to left: inline-end is toward the left, measured from the window\'s right edge', () => {
    const { at } = setup(MID);
    // The anchor's logical start = 800 - 420 = 380, end = 800 - 380 = 420: after it, 424 from the right edge (its left).
    expect(at('inline-end', 'rtl')).toMatchObject({ used: 'inline-end', start: '424px' });
    // block-end centred: logical middle 400 → start 350 from the right edge.
    expect(at('block-end', 'rtl')).toMatchObject({ start: '350px', arrow: '50px' });
  });

  it('the margin (the arrow\'s size, variables.css) is the gap too, and the written block inset gives it back', () => {
    const { at } = setup(MID, { w: 100, h: 30 }, 6);
    // block-end: the box's top at 300 + 4 + 6 = 310, written 6 less (the margin pushes it down).
    expect(at('block-end').top).toBe('304px');
    // block-start: its bottom at 280 - 10 → top 240, written 234.
    expect(at('block-start').top).toBe('234px');
    // inline-end: start 420 + 10; top 275 written 269.
    expect(at('inline-end')).toMatchObject({ start: '430px', top: '269px' });
  });
});

describe('place: flips at each edge, and only when the other side has room', () => {
  it('bottom edge: block-end flips to block-start', () => {
    const { at } = setup({ left: 380, right: 420, top: 560, bottom: 590 });
    expect(at('block-end')).toMatchObject({ used: 'block-start', side: 'block-start', top: '526px' });
  });

  it('top edge: block-start flips to block-end', () => {
    const { at } = setup({ left: 380, right: 420, top: 10, bottom: 30 });
    expect(at('block-start')).toMatchObject({ used: 'block-end', top: '34px' });
  });

  it('end edge: inline-end flips to inline-start (the right in left to right)', () => {
    const { at } = setup({ left: 720, right: 760, top: 280, bottom: 300 });
    expect(at('inline-end')).toMatchObject({ used: 'inline-start', start: '616px' });
  });

  it('start edge: inline-start flips to inline-end', () => {
    const { at } = setup({ left: 20, right: 60, top: 280, bottom: 300 });
    expect(at('inline-start')).toMatchObject({ used: 'inline-end', start: '64px' });
  });

  it('right to left: the end edge is the left one', () => {
    // Anchor at the window's left: logical end = 800 - 20 = 780; no room after it, room before.
    const { at } = setup({ left: 20, right: 60, top: 280, bottom: 300 });
    expect(at('inline-end', 'rtl')).toMatchObject({ used: 'inline-start' });
  });

  it('no room above nor below: the line\'s end, the first side across where it fits (26)', () => {
    const { at } = setup({ left: 380, right: 420, top: 20, bottom: 580 });
    // Below: 600 - 580 - 4 = 16 < 30; above: 20 - 4 = 16 < 30; after: 800 - 420 - 4 = 376 >= 100. Start 424; centred on
    // the block middle 300: top 285.
    expect(at('block-end')).toMatchObject({ used: 'inline-end', start: '424px', top: '285px' });
    expect(at('block-start')).toMatchObject({ used: 'inline-end', start: '424px' });
  });
});

describe('place: kept in the window along the other axis, the arrow 12 px inside', () => {
  it('near the start edge: slid to 0, the arrow still over the anchor', () => {
    const { at } = setup({ left: 0, right: 20, top: 280, bottom: 300 });
    // centred would start at -40: held at 0; the anchor's middle at 10 → arrow clamped to 12.
    expect(at('block-end')).toMatchObject({ start: '0px', arrow: '12px' });
  });

  it('near the end edge: slid back to 700', () => {
    const { at } = setup({ left: 770, right: 790, top: 280, bottom: 300 });
    // middle 780; start held at 800 - 100; arrow 80.
    expect(at('block-end')).toMatchObject({ start: '700px', arrow: '80px' });
  });

  it('a wide anchor: the arrow at most 12 px from the bubble\'s end', () => {
    const { at } = setup({ left: 10, right: 790, top: 280, bottom: 300 });
    // centred: start 350; anchor's middle 400 → 50 (inside).
    expect(at('block-end').arrow).toBe('50px');
    // aligned at the start (the grid's tooltip): start 10, middle 400 → 390, clamped to 100 - 12.
    expect(at('block-end', 'ltr', false)).toMatchObject({ start: '10px', arrow: '88px' });
  });

  it('inline sides: held inside the window\'s height', () => {
    const { at } = setup({ left: 380, right: 420, top: 590, bottom: 600 });
    // centred would put its top at 580: held at 600 - 30.
    expect(at('inline-end')).toMatchObject({ top: '570px', arrow: '18px' });
  });
});

describe('placementOf: the 12 placements and auto, left and right by the direction', () => {
  const cases: [TooltipPlacement, ReturnType<typeof placementOf>, ReturnType<typeof placementOf>][] = [
    // placement, left to right, right to left
    ['top', ['block-start', 0], ['block-start', 0]],
    ['top-start', ['block-start', -1], ['block-start', -1]],
    ['top-end', ['block-start', 1], ['block-start', 1]],
    ['bottom', ['block-end', 0], ['block-end', 0]],
    ['bottom-start', ['block-end', -1], ['block-end', -1]],
    ['bottom-end', ['block-end', 1], ['block-end', 1]],
    ['start', ['inline-start', 0], ['inline-start', 0]],
    ['end-start', ['inline-end', -1], ['inline-end', -1]],
    ['left', ['inline-start', 0], ['inline-end', 0]],
    ['left-start', ['inline-start', -1], ['inline-end', -1]],
    ['right', ['inline-end', 0], ['inline-start', 0]],
    ['right-end', ['inline-end', 1], ['inline-start', 1]],
  ];
  for (const [p, ltr, rtl] of cases) {
    it(p, () => {
      expect(placementOf(p, 'ltr', 'bottom')).toEqual(ltr);
      expect(placementOf(p, 'rtl', 'bottom')).toEqual(rtl);
    });
  }
  it('auto and none: the default given', () => {
    expect(placementOf('auto', 'ltr', 'bottom-start')).toEqual(['block-end', -1]);
    expect(placementOf(undefined, 'rtl', 'bottom')).toEqual(['block-end', 0]);
  });
});

describe('place: alignment and flip off', () => {
  it('-end: the bubble\'s end on the anchor\'s end', () => {
    const { el, anchor } = (() => {
      const s = setup(MID);
      return { el: s.el, anchor: document.querySelector('button')! };
    })();
    place(el, anchor, 'ltr', 'block-end', 1);
    // anchor end 420, bubble 100 wide: start 320.
    expect(el.style.getPropertyValue('inset-inline-start')).toBe('320px');
    expect(el.style.getPropertyValue('--dzt-tip-at')).toBe('80px');
  });

  it('flip: false keeps the side asked even at the edge', () => {
    const { at } = setup({ left: 380, right: 420, top: 560, bottom: 590 });
    expect(at('block-end', 'ltr', true, false)).toMatchObject({ used: 'block-end', top: '594px' });
  });
});

/**
 * The room (25), the fallbacks and `auto` (26): a bubble whose size follows the caps written on it, as a browser's would
 * (its natural size, held to `--dzt-available-*`); a popover's body scrolls (its natural content height, held to its
 * own cap). Window 800 × 600.
 */
function sized(anchorBox: Box, nat: { w: number; h: number }, opts: { body?: number; pad?: number } = {}) {
  vi.spyOn(window, 'innerWidth', 'get').mockReturnValue(800);
  vi.spyOn(window, 'innerHeight', 'get').mockReturnValue(600);
  const el = document.body.appendChild(document.createElement('div'));
  if (opts.pad) el.style.setProperty('--dzt-viewport-padding', `${opts.pad}px`);
  const cap = (e: HTMLElement, v: string): number => parseFloat(e.style.getPropertyValue(v)) || Infinity;
  const w = (): number => Math.min(nat.w, cap(el, '--dzt-available-inline-size'));
  let body: HTMLElement | null = null;
  if (opts.body !== undefined) {
    // The popover: a body of `opts.body` px of content, the bubble's padding and edge 26 px around it.
    body = el.appendChild(document.createElement('div'));
    body.className = 'dzt-popover-body';
    const shown = (): number => Math.min(opts.body!, cap(body!, '--dzt-available-block-size'));
    Object.defineProperty(body, 'scrollHeight', { configurable: true, get: () => opts.body });
    Object.defineProperty(body, 'clientHeight', { configurable: true, get: shown });
    Object.defineProperty(body, 'offsetHeight', { configurable: true, get: shown });
    Object.defineProperty(el, 'offsetHeight', { configurable: true, get: () => shown() + 26 });
  } else Object.defineProperty(el, 'offsetHeight', { configurable: true, get: () => Math.min(nat.h, cap(el, '--dzt-available-block-size')) });
  Object.defineProperty(el, 'offsetWidth', { configurable: true, get: w });
  const anchor = document.body.appendChild(document.createElement('button'));
  anchor.getBoundingClientRect = () => ({ ...anchorBox, width: anchorBox.right - anchorBox.left, height: anchorBox.bottom - anchorBox.top, x: anchorBox.left, y: anchorBox.top, toJSON: () => null });
  const at = (side: TipSide, o: { flip?: boolean; auto?: boolean; dir?: 'ltr' | 'rtl' } = {}) => {
    const used = place(el, anchor, o.dir ?? 'ltr', side, 0, o.flip ?? true, o.auto ?? false);
    const v = (e: HTMLElement | null, k: string) => e?.style.getPropertyValue(k) ?? '';
    return {
      used, top: v(el, 'inset-block-start'), start: v(el, 'inset-inline-start'), arrow: v(el, '--dzt-tip-at'),
      block: v(el, '--dzt-available-block-size'), inline: v(el, '--dzt-available-inline-size'), bodyBlock: v(body, '--dzt-available-block-size'),
      overflow: el.hasAttribute('data-overflow'),
    };
  };
  return { el, at };
}

describe('place: never bigger than the room (25)', () => {
  it('fits: the room on its side and across written, no overflow mark', () => {
    const { at } = sized(MID, { w: 100, h: 30 });
    // Below: 600 - 300 - 4 = 296; across: the window's 800.
    expect(at('block-end')).toMatchObject({ used: 'block-end', top: '304px', block: '296px', inline: '800px', overflow: false });
  });

  it('flip: false at the bottom: held to the 176 px left, marked to scroll', () => {
    const { at } = sized({ left: 380, right: 420, top: 400, bottom: 420 }, { w: 100, h: 300 });
    // 600 - 420 - 4 = 176.
    expect(at('block-end', { flip: false })).toMatchObject({ used: 'block-end', top: '424px', block: '176px', overflow: true });
  });

  it('a tooltip back where it fits loses its cap and its mark (measured at its natural size)', () => {
    const box = { left: 380, right: 420, top: 400, bottom: 420 };
    const s = sized(box, { w: 100, h: 300 });
    s.at('block-end', { flip: false });
    // Above: 400 - 4 = 396 >= 300: top 400 - 4 - 300 = 96.
    expect(s.at('block-start', { flip: false })).toMatchObject({ used: 'block-start', top: '96px', block: '396px', overflow: false });
  });

  it('the padding to the window\'s edges: in the slide, the room and across', () => {
    const { at } = sized({ left: 0, right: 20, top: 280, bottom: 300 }, { w: 100, h: 30 }, { pad: 8 });
    // Centred would start at -40: held at 8; the arrow at 10 - 8 = 2, clamped to 12. Below: 600 - 8 - 300 - 4 = 288;
    // across: 800 - 16 = 784.
    expect(at('block-end')).toMatchObject({ start: '8px', arrow: '12px', block: '288px', inline: '784px' });
  });

  it('a popover: its body holds the room less the bubble\'s padding and edge; the same on the next placement', () => {
    const s = sized(MID, { w: 300, h: 0 }, { body: 1000 });
    // 1026 tall: fits nowhere. Seen below 300 × 296, above 300 × 276, at either inline side 300 × 600 (376 >= 300 wide):
    // the line's end, the first of the best. Body 600 - 26 = 574; the bubble 600 tall, held at top 0.
    const want = { used: 'inline-end', start: '424px', top: '0px', block: '600px', bodyBlock: '574px', overflow: false };
    expect(s.at('block-end')).toMatchObject(want);
    // Its body capped now: its natural height still 1026 (the hidden part counted).
    expect(s.at('block-end')).toMatchObject(want);
  });
});

describe('place: the side chosen (26)', () => {
  it('neither below nor above: the line\'s end, centred on the anchor', () => {
    const { at } = sized(MID, { w: 100, h: 300 });
    // Below 296 < 300, above 276 < 300, after 376 >= 100: start 424; top 290 - 150 = 140.
    expect(at('block-end')).toMatchObject({ used: 'inline-end', start: '424px', top: '140px', overflow: false });
  });

  it('asked at the end, no room at either inline side: below', () => {
    const { at } = sized({ left: 20, right: 780, top: 280, bottom: 300 }, { w: 100, h: 30 });
    // After: 800 - 780 - 4 = 16; before: 20 - 4 = 16; below: 296 >= 30. Start 400 - 50 = 350.
    expect(at('inline-end')).toMatchObject({ used: 'block-end', top: '304px', start: '350px' });
  });

  it('right to left: across is the line\'s end too, toward the left', () => {
    const { at } = sized(MID, { w: 100, h: 300 }, {});
    // Logical: the anchor's end 800 - 380 = 420 from the right edge: start 424 from it.
    expect(at('block-end', { dir: 'rtl' })).toMatchObject({ used: 'inline-end', start: '424px' });
  });

  it('fits nowhere: where the most is seen, held to the room there and marked to scroll', () => {
    const { at } = sized({ left: 300, right: 500, top: 250, bottom: 350 }, { w: 450, h: 700 });
    // Below and above 246 tall: 450 × 246 seen; at either inline side 296 wide, 600 tall: 296 × 600 — the line's end
    // first. Held to 296 × 600: start 504, top 0.
    expect(at('block-end')).toMatchObject({ used: 'inline-end', start: '504px', top: '0px', inline: '296px', block: '600px', overflow: true });
  });

  it('auto: the side with the most room left around it', () => {
    const { at } = sized({ left: 600, right: 640, top: 100, bottom: 120 }, { w: 100, h: 30 });
    // Left over: below 476 - 30 = 446, above 96 - 30 = 66, after 156 - 100 = 56, before 596 - 100 = 496: before.
    // Start 600 - 4 - 100 = 496; top 110 - 15 = 95.
    expect(at('block-end', { auto: true })).toMatchObject({ used: 'inline-start', start: '496px', top: '95px' });
  });

  it('auto fitting nowhere: where the most is seen', () => {
    const { at } = sized({ left: 300, right: 500, top: 250, bottom: 350 }, { w: 450, h: 700 });
    expect(at('block-start', { auto: true })).toMatchObject({ used: 'inline-end', start: '504px' });
  });
});
