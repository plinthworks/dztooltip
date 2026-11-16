// The page's tooltip and popover take the same names as a grid column's (docs/behaviors/tooltips-popovers.md 7, 20, 23):
// ready-made shapes, the morph preset, variables, a width, `when: 'truncated'`. Moved from DzGrid 1.12's work.
// Expectations written by hand.
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { tooltip } from '../src/tooltip.js';
import { popover } from '../src/popover.js';

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  document.body.innerHTML = '';
  vi.useRealTimers();
});

/** jsdom lays nothing out: a cell made to look cut (its text wider than its box). */
const cut = (el: HTMLElement): void => {
  Object.defineProperty(el, 'scrollWidth', { configurable: true, value: 180 });
  Object.defineProperty(el, 'clientWidth', { configurable: true, value: 100 });
};

describe('the page\'s tooltip and popover: the same names', () => {
  it('a named shape, morph, style and maxWidth on the page\'s bubble; when: \'truncated\'', () => {
    const b = document.createElement('button');
    b.textContent = 'A long label';
    document.body.append(b);
    const h = tooltip(b, { content: 'Hi', shape: 'bubble', animation: 'morph', style: { '--dzt-tooltip-bubble-radius': '1rem' }, maxWidth: 200 });
    h.show();
    const el = document.querySelector<HTMLElement>('.dzt-tooltip.dzt-float')!;
    expect([el.dataset['shape'], el.dataset['animation'], el.style.getPropertyValue('--dzt-tooltip-bubble-radius'), el.style.getPropertyValue('max-inline-size')]).toEqual(['bubble', 'morph', '1rem', 'min(200px, var(--dzt-available-inline-size, 100vw))']);
    expect(el.querySelector('svg')).toBeNull();
    // A path is still an app's shape (data-shape empty, its SVG).
    h.update({ shape: 'M0 0 H100 V100 H0 Z' });
    expect(el.getAttribute('data-shape')).toBe('');
    expect(el.querySelector('svg.dzt-tip-shape')).not.toBeNull();
    h.update({ shape: 'ticket' });
    expect([el.dataset['shape'], el.querySelector('svg')]).toEqual(['ticket', null]);
    h.hide();
    vi.runAllTimers();
    h.update({ when: 'truncated' });
    h.show();
    expect(h.shown).toBe(false);
    cut(b);
    h.show();
    expect(h.shown).toBe(true);
    h.destroy();
  });

  it('a popover takes a named shape and morph', () => {
    const t = document.createElement('button');
    document.body.append(t);
    const p = popover(t, { content: 'Body', shape: 'bubble', animation: 'morph' });
    p.open();
    expect([p.el!.dataset['shape'], p.el!.dataset['animation']]).toEqual(['bubble', 'morph']);
    p.destroy();
    // An app's animation: `custom` written before it is shown (no CSS fade started first).
    const seen: string[] = [];
    new MutationObserver((ms) => { for (const m of ms) { const el = m.target as HTMLElement; if (el.classList.contains('dzt-popover')) seen.push(m.attributeName === 'hidden' ? `hidden:${el.hidden}` : `${m.attributeName}:${m.oldValue}>${el.getAttribute(m.attributeName!)}`); } })
      .observe(document.body, { subtree: true, attributes: true, attributeOldValue: true, attributeFilter: ['hidden', 'data-animation'] });
    const q = popover(t, { content: 'Body', animation: 'scale', animate: () => undefined });
    q.open();
    return Promise.resolve().then(() => {
      const shown = seen.lastIndexOf('hidden:false');
      expect(shown).toBeGreaterThan(-1);
      expect(seen.slice(shown + 1)).toEqual([]);
      expect(q.el!.dataset['animation']).toBe('custom');
      q.destroy();
    });
  });
});
