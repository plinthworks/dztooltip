// A column's tooltip in one line drawn by DzTooltip through the bridge (docs/behaviors/tooltips-popovers.md 7, 20–24):
// its tone, shape, preset, placement, variables and width on the bubble, dressed before it shows; the grid's defaults
// (the bridge's options) ← the column's ← the cell's answer. Moved from DzGrid 1.12's work; the words, `when` and
// `content` are DzGrid's own (its tooltips.md 10). Expectations written by hand.
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { dataKey, type ColumnDef } from '@dzgrid/core';
import { createGrid, type GridInstance, type GridSettings, type Geometry, type ViewportBox } from '@dzgrid/dom';
import { EN } from '@dzgrid/dom/locales/en';
import { dzTooltips, type DzTooltipsOptions } from '../src/index.js';

type R = { id: string; n: number; name: string };
let grids: GridInstance<R>[] = [];
beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  for (const g of grids) g.destroy();
  grids = [];
  document.body.innerHTML = '';
  vi.useRealTimers();
  vi.restoreAllMocks();
});

const ROWS: R[] = Array.from({ length: 10 }, (_, i) => ({ id: `r${i}`, n: 1000 * i + 0.5, name: `Name ${i}` }));

function make(columns: ColumnDef<R, any>[], settings: Partial<GridSettings<R>> = {}, bridge: DzTooltipsOptions = {}) {
  const box: { -readonly [K in keyof ViewportBox]: ViewportBox[K] } = { block: 320, inline: 800, scrollTop: 0, scrollInline: 0 };
  const geometry: Geometry = { read: () => ({ ...box }), writeScrollTop: (px) => { box.scrollTop = px; }, writeScrollInline: (px) => { box.scrollInline = px; } };
  const host = document.createElement('div');
  document.body.append(host);
  const g = createGrid<R>(host, {
    rows: ROWS, getRowId: (r) => r.id, columns, messages: { locale: 'en', text: EN.text },
    features: [dzTooltips(bridge)], ...settings,
  }, { geometry, sync: true });
  grids.push(g);
  const tip = host.querySelector<HTMLElement>('.dzg-tooltip')!;
  const head = (c: string) => host.querySelector<HTMLElement>(`.dzg-hcell[data-col="${c}"]`)!;
  const cell = (row: number, c: string) => host.querySelector<HTMLElement>(`.dzg-row[aria-rowindex="${row + 2}"] [data-col="${c}"]`)!;
  const over = (el: Element) => el.dispatchEvent(new PointerEvent('pointerover', { bubbles: true, pointerType: 'mouse' }));
  return { g, host, tip, head, cell, over };
}

/** jsdom lays nothing out: a cell made to look cut (its text wider than its box). */
const cut = (el: HTMLElement): void => {
  Object.defineProperty(el, 'scrollWidth', { configurable: true, value: 180 });
  Object.defineProperty(el, 'clientWidth', { configurable: true, value: 100 });
};

const N: ColumnDef<R, any> = { id: 'n', header: 'N', type: 'number' };
const NAME: ColumnDef<R, any> = { id: 'name', header: 'Name' };

describe('a column in one line, through the bridge', () => {
  it('tooltip: true — the cell\'s text as displayed (the number formatted), always', () => {
    const { tip, cell, over } = make([{ ...N, tooltip: true }], { tooltips: { delayMs: 0 } });
    over(cell(3, 'n'));
    expect(tip.hidden).toBe(false);
    expect(tip.textContent).toBe('3,000.5');
  });

  it('{ when: \'truncated\' } — only on a cell whose text is cut', () => {
    const { tip, cell, over } = make([{ ...NAME, tooltip: { when: 'truncated' } }], { tooltips: { delayMs: 0 } });
    over(cell(2, 'name'));
    expect(tip.hidden).toBe(true);
    // An inline box inside a cell that fits (Firefox: its scrollWidth is its text's, its clientWidth 0) is not cut.
    const span = document.createElement('span');
    Object.defineProperty(span, 'scrollWidth', { configurable: true, value: 19 });
    cell(4, 'name').append(span);
    over(cell(4, 'name'));
    expect(tip.hidden).toBe(true);
    cut(cell(3, 'name'));
    over(cell(3, 'name'));
    expect(tip.hidden).toBe(false);
    expect(tip.textContent).toBe('Name 3');
  });

  it('the grid\'s cells: \'truncated\' for every column that says nothing; tooltip: false keeps one silent', () => {
    const { tip, cell, over } = make([NAME, { ...N, tooltip: false }], { tooltips: { cells: 'truncated', delayMs: 0 } });
    over(cell(1, 'name'));
    expect(tip.hidden).toBe(true);
    cut(cell(2, 'name'));
    over(cell(2, 'name'));
    expect(tip.textContent).toBe('Name 2');
    cut(cell(2, 'n'));
    over(cell(2, 'n'));
    vi.advanceTimersByTime(1000);
    expect(tip.hidden).toBe(true);
  });

  it('cells: false silences a column\'s object too', () => {
    const { tip, cell, over } = make([{ ...NAME, tooltip: true }], { tooltips: { cells: false, delayMs: 0 } });
    over(cell(1, 'name'));
    expect(tip.hidden).toBe(true);
  });

  it('fixed options: text, tone, shape, animation, placement written on the bubble', () => {
    const { tip, cell, over } = make([{ ...NAME, tooltip: { text: 'A person', tone: 'neutral', shape: 'bubble', animation: 'morph', placement: 'end' } }], { tooltips: { delayMs: 0 } });
    over(cell(1, 'name'));
    expect(tip.textContent).toBe('A person');
    expect([tip.dataset['tone'], tip.dataset['shape'], tip.dataset['animation'], tip.dataset['side']]).toEqual(['neutral', 'bubble', 'morph', 'inline-end']);
    // A named shape draws no SVG (CSS draws it).
    expect(tip.querySelector('svg')).toBeNull();
  });

  // Owner 2026-11-14 (« elle prend du temps pour s'afficher »): the browser starts a bubble's opening when it is shown
  // (showing it reads its style), so its preset, shape and variables are written before — the grid's `pop` was shown
  // first, the column's `morph` a moment later, its fade then starting without the morph's lead.
  it('dressed (the column\'s preset, shape) before it is shown, not after', () => {
    const { tip, cell, over } = make([{ ...NAME, tooltip: { shape: 'bubble', animation: 'morph' } }], { tooltips: { delayMs: 0 } }, { animation: 'pop' });
    const seen: string[] = [];
    new MutationObserver((ms) => { for (const m of ms) seen.push(m.attributeName === 'hidden' ? `hidden:${tip.hidden}` : `${m.attributeName}:${tip.getAttribute(m.attributeName!)}`); })
      .observe(tip, { attributes: true, attributeFilter: ['hidden', 'data-animation', 'data-shape'] });
    over(cell(1, 'name'));
    return Promise.resolve().then(() => {
      const shown = seen.indexOf('hidden:false');
      expect(shown).toBeGreaterThan(-1);
      expect(seen.slice(shown + 1).filter((s) => !s.startsWith('hidden'))).toEqual([]);
      expect([tip.dataset['animation'], tip.dataset['shape']]).toEqual(['morph', 'bubble']);
    });
  });

  it('merge: the grid\'s defaults ← the column\'s object ← the cell\'s answer; text left out → the displayed text', () => {
    const { tip, cell, over } = make([{
      ...N,
      tooltip: { tone: 'warning', shape: 'pill', content: (v: number | null) => (v !== null && v > 4000 ? { tone: 'danger', text: 'Big' } : { animation: 'fade' }) },
    }, { ...NAME, tooltip: true }], { tooltips: { delayMs: 0 } }, { shape: 'ticket', animation: 'pop', tone: 'success' });
    over(cell(6, 'n'));
    expect([tip.textContent, tip.dataset['tone'], tip.dataset['shape'], tip.dataset['animation']]).toEqual(['Big', 'danger', 'pill', 'pop']);
    over(cell(2, 'n'));
    expect([tip.textContent, tip.dataset['tone'], tip.dataset['shape'], tip.dataset['animation']]).toEqual(['2,000.5', 'warning', 'pill', 'fade']);
    // A column that says nothing of its look takes the grid's.
    over(cell(2, 'name'));
    expect([tip.textContent, tip.dataset['tone'], tip.dataset['shape'], tip.dataset['animation']]).toEqual(['Name 2', 'success', 'ticket', 'pop']);
  });

  it('a cell answering null shows nothing; a throw is reported and shows nothing', () => {
    const err = new Error('boom');
    const { tip, cell, over } = make([{ ...N, tooltip: { tone: 'info', content: (v: number | null) => { if (v !== null && v > 5000) throw err; return null; } } }], { tooltips: { delayMs: 0 } });
    over(cell(1, 'n'));
    expect(tip.hidden).toBe(true);
    over(cell(7, 'n'));
    expect(tip.hidden).toBe(true);
  });

  it('style: only custom properties, written while this column\'s tooltip shows; maxWidth caps it', () => {
    const { tip, cell, over } = make([
      { ...NAME, tooltip: { maxWidth: 240, style: { '--dzt-tooltip-info-bg': 'teal', color: 'red' } as never } }, // `color`: not a variable, the type refuses it; checked ignored
      { ...N, tooltip: { maxWidth: '12rem' } },
    ], { tooltips: { delayMs: 0 } });
    over(cell(1, 'name'));
    expect(tip.style.getPropertyValue('--dzt-tooltip-info-bg')).toBe('teal');
    expect(tip.style.getPropertyValue('color')).toBe('');
    expect(tip.style.getPropertyValue('max-inline-size')).toBe('min(240px, var(--dzt-available-inline-size, 100vw))');
    over(cell(1, 'n'));
    expect(tip.style.getPropertyValue('--dzt-tooltip-info-bg')).toBe('');
    expect(tip.style.getPropertyValue('max-inline-size')).toBe('min(12rem, var(--dzt-available-inline-size, 100vw))');
  });

  it('delayMs per column on hover; a keyboard focus on the cell opens it at once', () => {
    const { g, tip, cell, over } = make([{ ...NAME, tooltip: { delayMs: 50, shape: 'bubble', animation: 'morph' } }, { ...N, tooltip: true }], { tooltips: { delayMs: 800 } });
    over(cell(1, 'name'));
    vi.advanceTimersByTime(49);
    expect(tip.hidden).toBe(true);
    vi.advanceTimersByTime(1);
    expect(tip.hidden).toBe(false);
    over(cell(1, 'n'));
    vi.advanceTimersByTime(700);
    expect(tip.textContent).toBe('Name 1');
    vi.advanceTimersByTime(100);
    expect(tip.textContent).toBe('1,000.5');
    // The keyboard: at once, with the column's look.
    g.api.focusCell(dataKey('r2')!, 'name');
    document.activeElement!.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }));
    expect(tip.hidden).toBe(false);
    expect([tip.textContent, tip.dataset['shape'], tip.dataset['animation']]).toEqual(['Name 3', 'bubble', 'morph']);
    expect(cell(3, 'name').getAttribute('aria-describedby')).toBe(tip.id);
  });
});

describe('headerTooltip as a spec', () => {
  it('its words and its look on the bubble', () => {
    const b = make([{ ...NAME, headerTooltip: { text: 'Who', tone: 'success', shape: 'pill', animation: 'morph' } }], { tooltips: { delayMs: 0 } });
    b.over(b.head('name'));
    expect([b.tip.textContent, b.tip.dataset['tone'], b.tip.dataset['shape'], b.tip.dataset['animation']]).toEqual(['Who', 'success', 'pill', 'morph']);
  });
});
