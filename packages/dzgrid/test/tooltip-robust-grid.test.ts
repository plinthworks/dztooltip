// A grid's tooltips through the bridge in the hard cases (docs/behaviors/tooltips-popovers.md 27–29): its header buttons
// one delay group, its cells keeping the grid's delay; the bubble following its anchor and going when the anchor is no
// longer drawn. Run against DzGrid's sources beside this checkout (1.13.0). Expectations written by hand.
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import type { ColumnDef } from '@dzgrid/core';
import { createGrid, type GridInstance, type Geometry, type ViewportBox } from '@dzgrid/dom';
import { filters } from '@dzgrid/dom/filters';
import { EN } from '@dzgrid/dom/locales/en';
import { EN_FILTERS } from '@dzgrid/dom/locales/en-filters';
import { dzTooltips } from '../src/index.js';

type R = { id: string; n: number };
let grids: GridInstance<R>[] = [];
beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  for (const g of grids) g.destroy();
  grids = [];
  document.body.innerHTML = '';
  vi.useRealTimers();
  vi.restoreAllMocks();
});

const COLS: ColumnDef<R, any>[] = [
  { id: 'n', header: 'N', type: 'number', headerTooltip: 'How many', tooltip: (v: number | null) => `Value ${v}` },
  { id: 'm', header: 'M', value: (r: R) => r.n * 2, tooltip: (v) => `Twice ${String(v)}` },
];

function make() {
  const box: { -readonly [K in keyof ViewportBox]: ViewportBox[K] } = { block: 320, inline: 600, scrollTop: 0, scrollInline: 0 };
  const geometry: Geometry = { read: () => ({ ...box }), writeScrollTop: (px) => { box.scrollTop = px; }, writeScrollInline: (px) => { box.scrollInline = px; } };
  const host = document.body.appendChild(document.createElement('div'));
  const g = createGrid<R>(host, {
    rows: Array.from({ length: 5 }, (_, i) => ({ id: `r${i}`, n: i })), getRowId: (r) => r.id, columns: COLS,
    messages: { locale: 'en', text: { ...EN.text, ...EN_FILTERS.text } }, features: [filters(), dzTooltips({ header: true })],
  }, { geometry, sync: true });
  grids.push(g);
  const tip = host.querySelector<HTMLElement>('.dzg-tooltip')!;
  const fbtn = (c: string) => host.querySelector<HTMLElement>(`.dzg-hcell[data-col="${c}"] .dzg-fbtn`)!;
  const cell = (row: number, c: string) => host.querySelector<HTMLElement>(`.dzg-row[aria-rowindex="${row + 2}"] [data-col="${c}"]`)!;
  const over = (el: Element) => el.dispatchEvent(new PointerEvent('pointerover', { bubbles: true, pointerType: 'mouse' }));
  return { host, tip, fbtn, cell, over };
}

describe('a grid\'s header buttons: one delay group (29)', () => {
  it('one button\'s name shown after the grid\'s delay; the next button\'s at once, in its place', () => {
    const { tip, fbtn, over } = make();
    over(fbtn('n'));
    vi.advanceTimersByTime(499);
    expect(tip.hidden).toBe(true);
    vi.advanceTimersByTime(1);
    expect(tip.textContent).toBe(fbtn('n').getAttribute('aria-label'));
    over(fbtn('m'));
    expect(tip.hidden).toBe(false);
    expect(tip.textContent).toBe(fbtn('m').getAttribute('aria-label'));
  });

  it('300 ms after it hid, still at once; past them, the delay again', () => {
    const { tip, fbtn, over } = make();
    over(fbtn('n'));
    vi.advanceTimersByTime(500);
    // Away (a cell with no tooltip at the moment it is crossed would do; the grid's grace then hides it).
    fbtn('n').dispatchEvent(new PointerEvent('pointerout', { bubbles: true, relatedTarget: document.body }));
    vi.advanceTimersByTime(150);
    expect(tip.hidden).toBe(true);
    vi.advanceTimersByTime(200);
    over(fbtn('m'));
    expect(tip.textContent).toBe(fbtn('m').getAttribute('aria-label'));
    fbtn('m').dispatchEvent(new PointerEvent('pointerout', { bubbles: true, relatedTarget: document.body }));
    vi.advanceTimersByTime(150 + 300);
    over(fbtn('n'));
    expect(tip.hidden).toBe(true);
    vi.advanceTimersByTime(500);
    expect(tip.hidden).toBe(false);
  });

  it('a cell after a header button: the grid\'s delay (DzGrid decides when cells show)', () => {
    const { tip, fbtn, cell, over } = make();
    over(fbtn('n'));
    vi.advanceTimersByTime(500);
    over(cell(1, 'n'));
    expect(tip.textContent).toBe(fbtn('n').getAttribute('aria-label'));
    vi.advanceTimersByTime(500);
    expect(tip.textContent).toBe('Value 1');
  });
});

describe('a grid\'s tooltip follows its anchor and goes with it (27, 28)', () => {
  it('its cell grown with no scroll: placed again at the next frame', () => {
    const { tip, cell, over } = make();
    vi.spyOn(window, 'innerWidth', 'get').mockReturnValue(800);
    vi.spyOn(window, 'innerHeight', 'get').mockReturnValue(600);
    const c = cell(1, 'n');
    c.getBoundingClientRect = () => ({ left: 10, right: 110, top: 40, bottom: 60, width: 100, height: 20, x: 10, y: 40, toJSON: () => null });
    over(c);
    vi.advanceTimersByTime(500);
    // Below, at the cell's start (the grid's default).
    expect(tip.style.getPropertyValue('inset-block-start')).toBe('64px');
    c.getBoundingClientRect = () => ({ left: 10, right: 110, top: 40, bottom: 100, width: 100, height: 60, x: 10, y: 40, toJSON: () => null });
    window.dispatchEvent(new Event('resize'));
    vi.advanceTimersToNextFrame();
    expect(tip.style.getPropertyValue('inset-block-start')).toBe('104px');
  });

  it('its cell no longer drawn: hidden through the grid\'s own hide', () => {
    const { tip, cell, over } = make();
    const c = cell(2, 'm');
    over(c);
    vi.advanceTimersByTime(500);
    expect(tip.hidden).toBe(false);
    // `as any`: jsdom has no checkVisibility; the browser's answer for `display: none` around the cell.
    (c as any).checkVisibility = () => false;
    window.dispatchEvent(new Event('resize'));
    vi.advanceTimersToNextFrame();
    expect(tip.hidden).toBe(true);
    expect(c.hasAttribute('aria-describedby')).toBe(false);
  });
});
