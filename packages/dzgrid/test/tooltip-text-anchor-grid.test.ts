// A grid cell's bubble points at the text the user reads, not at the middle of the whole cell
// (docs/behaviors/tooltips-popovers.md 41; owner 2026-11-17: a right-aligned « 10 » whose bubble sat 100 px to its
// left). jsdom draws nothing: the cell's box and its text's line boxes are given by hand. Expectations written by hand.
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { dataKey, type ColumnDef } from '@dzgrid/core';
import { createGrid, type GridInstance, type Geometry, type ViewportBox } from '@dzgrid/dom';
import { EN } from '@dzgrid/dom/locales/en';
import { dzTooltips, type DzTooltipsOptions } from '../src/index.js';

type R = { id: string; n: number; s: string };
type Rect = { left: number; right: number; top: number; bottom: number };
const rect = (r: Rect): DOMRect => ({ ...r, width: r.right - r.left, height: r.bottom - r.top, x: r.left, y: r.top, toJSON: () => null }) as DOMRect;

/** The text's line boxes, by the element its text sits in (what a browser's `Range.getClientRects()` answers). */
const lines = new Map<Element, Rect[]>();
let grids: GridInstance<R>[] = [];
beforeEach(() => {
  // `as any`: jsdom's Range has no layout methods; the browser's answer for a range over a text node, by hand.
  (Range.prototype as any).getClientRects = function (this: Range) {
    const at = this.startContainer.nodeType === 3 ? this.startContainer.parentElement : (this.startContainer as Element);
    return (at && lines.get(at)?.map(rect)) ?? [];
  };
});
afterEach(() => {
  for (const g of grids) g.destroy();
  grids = [];
  lines.clear();
  // `as any`: the method added above, taken away again.
  delete (Range.prototype as any).getClientRects;
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

const COLS: ColumnDef<R, any>[] = [
  { id: 'n', header: 'Harvest (kg)', type: 'number', headerTooltip: 'In kilograms', tooltip: (v: number | null) => `${v} kg` },
  { id: 's', header: 'Note', tooltip: true },
];

function make(options: DzTooltipsOptions = { placement: 'top' }, rtl = false) {
  const box: { -readonly [K in keyof ViewportBox]: ViewportBox[K] } = { block: 320, inline: 600, scrollTop: 0, scrollInline: 0 };
  const geometry: Geometry = { read: () => ({ ...box }), writeScrollTop: (px) => { box.scrollTop = px; }, writeScrollInline: (px) => { box.scrollInline = px; } };
  const host = document.body.appendChild(document.createElement('div'));
  const g = createGrid<R>(host, {
    rows: Array.from({ length: 5 }, (_, i) => ({ id: `r${i}`, n: i * 10, s: `Note ${i}` })), getRowId: (r) => r.id, columns: COLS,
    messages: EN, direction: rtl ? 'rtl' : 'ltr', tooltips: { delayMs: 0 }, features: [dzTooltips(options)],
  }, { geometry, sync: true });
  grids.push(g);
  const tip = host.querySelector<HTMLElement>('.dzg-tooltip')!;
  // A bubble 40 × 20 (jsdom measures nothing).
  Object.defineProperty(tip, 'offsetWidth', { configurable: true, get: () => 40 });
  Object.defineProperty(tip, 'offsetHeight', { configurable: true, get: () => 20 });
  const cell = (row: number, c: string) => host.querySelector<HTMLElement>(`.dzg-row[aria-rowindex="${row + 2}"] [data-col="${c}"]`)!;
  const head = (c: string) => host.querySelector<HTMLElement>(`.dzg-hcell[data-col="${c}"]`)!;
  /** A cell 140 px wide from 300 to 440, its text's lines inside it. */
  const lay = (el: HTMLElement, text: Rect[], at: Rect = { left: 300, right: 440, top: 100, bottom: 132 }) => {
    el.getBoundingClientRect = () => rect(at);
    const holder = [...el.querySelectorAll('*')].find((e) => [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent!.trim())) ?? el;
    lines.set(holder, text);
    return el;
  };
  const over = (el: Element, x = 0, y = 0) => el.dispatchEvent(new PointerEvent('pointerover', { bubbles: true, pointerType: 'mouse', clientX: x, clientY: y }));
  const start = () => parseFloat(tip.style.getPropertyValue('inset-inline-start'));
  const top = () => parseFloat(tip.style.getPropertyValue('inset-block-start'));
  return { g, host, tip, cell, head, lay, over, start, top };
}

describe('a cell\'s bubble points at its text (41)', () => {
  it('an end-aligned number: the bubble centred on « 10 », not on the cell', () => {
    const { tip, cell, lay, over, start } = make();
    over(lay(cell(1, 'n'), [{ left: 415, right: 434, top: 108, bottom: 124 }]), 420, 116);
    expect(tip.textContent).toBe('10 kg');
    // The text's middle 424.5, less half the bubble: 404.5 (the cell's middle would give 350).
    expect(start()).toBe(404.5);
    // Above the text's line: 108 - 4 - 20.
    expect(parseFloat(tip.style.getPropertyValue('inset-block-start'))).toBe(84);
  });

  it('right to left: the same number at the cell\'s left, measured from the window\'s right edge', () => {
    const { cell, lay, over, start } = make({ placement: 'top' }, true);
    over(lay(cell(1, 'n'), [{ left: 306, right: 325, top: 108, bottom: 124 }]), 320, 116);
    // jsdom's window is 1024 wide: the text's middle 315.5 is 708.5 from its right edge, less 20.
    expect(start()).toBe(688.5);
  });

  it('a cut text (ellipsis): only its visible part counts', () => {
    const { cell, lay, over, start } = make();
    const c = lay(cell(1, 's'), [{ left: 308, right: 700, top: 108, bottom: 124 }]);
    c.style.overflow = 'hidden';
    over(c, 320, 116);
    // What is seen runs from 308 to the cell's end, 440: its middle 374, less 20 (the whole text's would give 484).
    expect(start()).toBe(354);
  });

  it('a wrapped text: the line under the pointer; by the keyboard, its first line', () => {
    const { g, cell, lay, over, start, top } = make();
    const two = [{ left: 305, right: 435, top: 102, bottom: 116 }, { left: 305, right: 365, top: 116, bottom: 130 }];
    over(lay(cell(1, 's'), two, { left: 300, right: 440, top: 100, bottom: 132 }), 330, 124);
    // The second line: its middle 335, less 20; above it, 116 - 24.
    expect([start(), top()]).toEqual([315, 92]);
    // The keyboard on another cell, the pointer elsewhere: that cell's first line.
    lay(cell(2, 's'), two.map((l) => ({ ...l, top: l.top + 32, bottom: l.bottom + 32 })), { left: 300, right: 440, top: 132, bottom: 164 });
    g.api.focusCell(dataKey('r1')!, 's');
    document.activeElement!.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }));
    expect([document.activeElement === cell(2, 's'), document.querySelector('.dzt-tooltip')?.textContent]).toEqual([true, 'Note 2']);
    expect([start(), top()]).toEqual([350, 110]);
  });

  it('a cell with no text (an empty one): the cell, as before', () => {
    const { cell, lay, over, start } = make();
    over(lay(cell(1, 'n'), []), 420, 116);
    expect(start()).toBe(350);
  });

  it('a header: its label', () => {
    const { head, lay, over, start } = make();
    const h = lay(head('n'), [{ left: 306, right: 386, top: 8, bottom: 24 }], { left: 300, right: 440, top: 0, bottom: 32 });
    over(h, 350, 16);
    // The label's middle 346, less 20.
    expect(start()).toBe(326);
  });
});
