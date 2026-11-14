// A popover over a grid's cell and the cell's tooltip drawn through the bridge (docs/behaviors/tooltips-popovers.md 14,
// 18): a popover opening drops the cell's show waiting for its delay and hides one shown; a cell holding an open
// popover's trigger shows none. Moved from DzGrid 1.12's work. Expectations written by hand.
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import type { ColumnDef } from '@dzgrid/core';
import { createGrid, type GridInstance, type Geometry, type ViewportBox } from '@dzgrid/dom';
import { EN } from '@dzgrid/dom/locales/en';
import { popover, type PopoverHandle } from '@dztooltip/core';
import { dzTooltips } from '../src/index.js';

let pops: PopoverHandle[] = [];
let grids: GridInstance<R>[] = [];
beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  for (const h of pops) h.destroy();
  for (const g of grids) g.destroy();
  pops = [];
  grids = [];
  document.body.innerHTML = '';
  vi.useRealTimers();
});

function button(label = 'Edit', parent: HTMLElement = document.body) {
  const b = parent.appendChild(document.createElement('button'));
  b.textContent = label;
  return b;
}

type R = { id: string; n: number };
const COLS: ColumnDef<R, any>[] = [{ id: 'n', header: 'N', type: 'number', headerTooltip: 'How many', tooltip: (v: number | null) => `Value ${v}` }];
function grid() {
  const box: { -readonly [K in keyof ViewportBox]: ViewportBox[K] } = { block: 320, inline: 600, scrollTop: 0, scrollInline: 0 };
  const geometry: Geometry = { read: () => ({ ...box }), writeScrollTop: (px) => { box.scrollTop = px; }, writeScrollInline: (px) => { box.scrollInline = px; } };
  const host = document.body.appendChild(document.createElement('div'));
  const g = createGrid<R>(host, {
    rows: Array.from({ length: 5 }, (_, i) => ({ id: `r${i}`, n: i })), getRowId: (r) => r.id, columns: COLS,
    messages: { locale: 'en', text: EN.text }, features: [dzTooltips()],
  }, { geometry, sync: true });
  grids.push(g);
  const t = host.querySelector<HTMLElement>('.dzg-tooltip')!;
  const cell = (row: number) => host.querySelector<HTMLElement>(`.dzg-row[aria-rowindex="${row + 2}"] [data-col="n"]`)!;
  const over = (el: Element) => el.dispatchEvent(new PointerEvent('pointerover', { bubbles: true, pointerType: 'mouse' }));
  return { host, t, cell, over };
}

describe('a popover over a grid\'s cell (sheet 18)', () => {
  it('a popover opening from a cell\'s button drops the cell\'s show, and hides it once shown', () => {
    const { t, cell, over } = grid();
    const b = button('More', cell(0));
    const p = popover(b, { content: 'About the row' });
    pops.push(p);
    over(b);
    vi.advanceTimersByTime(200);
    p.open();
    vi.advanceTimersByTime(1000);
    expect(t.hidden).toBe(true);
    p.close();
    over(cell(2));
    over(b);
    vi.advanceTimersByTime(600);
    expect(t.hidden).toBe(false);
    p.open();
    expect(t.hidden).toBe(true);
  });

  it('a cell holding an open popover\'s trigger shows no tooltip when its delay ends', () => {
    const { t, cell, over } = grid();
    const b = button('More', cell(0));
    const p = popover(b, { content: 'About the row', openOn: 'manual' });
    pops.push(p);
    p.open();
    over(b);
    vi.advanceTimersByTime(1000);
    expect(t.hidden).toBe(true);
  });
});
