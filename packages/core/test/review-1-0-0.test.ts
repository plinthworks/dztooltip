// The 1.0.0 review (2026-11-16, fresh eyes on packages/): each defect found, a test that failed first. Expectations
// worked out by hand.
import { describe, it, expect, afterEach, vi } from 'vitest';
import { place } from '../src/bubble.js';
import { tips, type Tooltip } from '../src/bubble.js';
import { popover, type PopoverHandle } from '../src/popover.js';
import { tooltip, type TooltipHandle } from '../src/tooltip.js';
import { safeHtml } from '../src/html.js';

let handles: Array<PopoverHandle | TooltipHandle> = [];
afterEach(() => {
  for (const h of handles) h.destroy();
  handles = [];
  document.body.innerHTML = '';
  delete (document.documentElement as { clientWidth?: number }).clientWidth;
  vi.restoreAllMocks();
});

describe('place: a fixed bubble is measured from the viewport without its scrollbar', () => {
  // The window 800 wide, a classic vertical scrollbar of 15 px at its right: the fixed bubble's containing block is
  // 785 wide (`right: 0` sits against the scrollbar, not under it).
  function setup(box: { left: number; right: number }) {
    vi.spyOn(window, 'innerWidth', 'get').mockReturnValue(800);
    vi.spyOn(window, 'innerHeight', 'get').mockReturnValue(600);
    Object.defineProperty(document.documentElement, 'clientWidth', { configurable: true, value: 785 });
    const el = document.body.appendChild(document.createElement('div'));
    Object.defineProperty(el, 'offsetWidth', { configurable: true, get: () => 100 });
    Object.defineProperty(el, 'offsetHeight', { configurable: true, get: () => 30 });
    const a = document.body.appendChild(document.createElement('button'));
    a.getBoundingClientRect = () => ({ ...box, top: 280, bottom: 300, width: box.right - box.left, height: 20, x: box.left, y: 280, toJSON: () => null });
    return { el, a };
  }

  it('right to left: the inline start is the distance to the scrollbar, not to the window\'s edge', () => {
    const { el, a } = setup({ left: 380, right: 420 });
    place(el, a, 'rtl', 'block-end', 0);
    // From the containing block's right edge (785): the anchor is 365–405, centred 385; start = 385 - 50.
    expect(el.style.getPropertyValue('inset-inline-start')).toBe('335px');
  });

  it('left to right near the end: kept clear of the scrollbar', () => {
    const { el, a } = setup({ left: 740, right: 780 });
    place(el, a, 'ltr', 'block-end', 0);
    // Centred it would start at 710; the room ends at 785: 785 - 100.
    expect(el.style.getPropertyValue('inset-inline-start')).toBe('685px');
  });
});

describe('popover: destroyed while its closing runs', () => {
  it('its content\'s gone() is called once, not again when the closing ends', async () => {
    const t = document.body.appendChild(document.createElement('button'));
    let finish!: () => void;
    const gone = vi.fn();
    const h = popover(t, { content: () => ({ node: document.createTextNode('x'), gone }), animate: (_el, phase) => (phase === 'close' ? new Promise<void>((r) => (finish = r)) : undefined) });
    h.open();
    h.close();
    expect(gone).not.toHaveBeenCalled();
    h.destroy();
    expect(gone).toHaveBeenCalledTimes(1);
    finish();
    await new Promise((r) => setTimeout(r, 0));
    expect(gone).toHaveBeenCalledTimes(1);
  });

  it('a destroyed handle opens nothing', () => {
    const t = document.body.appendChild(document.createElement('button'));
    const h = popover(t, { content: 'x' });
    h.destroy();
    h.open();
    expect(h.isOpen).toBe(false);
    expect(document.querySelector('.dzt-popover')).toBeNull();
    expect(t.hasAttribute('aria-expanded')).toBe(false);
  });
});

describe('tooltip: destroyed', () => {
  it('the page\'s bubble lets go of its options (an app\'s template or component, the view that made it)', () => {
    const a = document.body.appendChild(document.createElement('button'));
    const content = (): string => 'Saves the draft';
    const h = tooltip(a, { content });
    h.show();
    const t = tips.get(document.querySelector('.dzt-tooltip')!) as Tooltip;
    expect((t.look() as { content?: unknown }).content).toBe(content);
    h.destroy();
    expect((t.look() as { content?: unknown }).content).toBeUndefined();
  });

  it('a destroyed handle shows nothing', () => {
    const a = document.body.appendChild(document.createElement('button'));
    const h = tooltip(a, { content: 'x' });
    h.destroy();
    h.show();
    expect(a.hasAttribute('aria-describedby')).toBe(false);
  });
});

describe('tooltip: shown in a dialog', () => {
  it('hidden, the page\'s bubble goes back to the page\'s end: a dialog taken out is not kept alive by it', () => {
    const d = document.body.appendChild(document.createElement('dialog'));
    d.setAttribute('open', '');
    const a = d.appendChild(document.createElement('button'));
    const h = tooltip(a, { content: 'In the dialog' });
    handles.push(h);
    h.show();
    const bubble = document.querySelector<HTMLElement>('.dzt-tooltip')!;
    expect(bubble.parentNode).toBe(d);
    h.hide();
    d.remove();
    expect(bubble.parentNode).toBe(document.body);
  });
});

describe('bad content never throws (plain JavaScript callers)', () => {
  it('a tooltip with no content, or a function returning none, shows nothing', () => {
    const a = document.body.appendChild(document.createElement('button'));
    // Plain JavaScript: the types forbid it.
    const h = tooltip(a, { content: undefined as never });
    handles.push(h);
    expect(() => h.show()).not.toThrow();
    expect(h.shown).toBe(false);
    // Plain JavaScript again.
    h.update({ content: (() => null) as never });
    expect(() => h.show()).not.toThrow();
    expect(h.shown).toBe(false);
  });

  it('a popover with no content opens empty', () => {
    const t = document.body.appendChild(document.createElement('button'));
    // Plain JavaScript: the types forbid it.
    const h = popover(t, { content: null as never });
    handles.push(h);
    expect(() => h.open()).not.toThrow();
    expect(h.el?.textContent).toBe('');
  });
});

describe('safeHtml: the tricks checked by the review (found fine, kept as guards)', () => {
  /** What survived that should not: an element off the list, an attribute off the list, anything outside HTML. */
  const KEPT = new Set('b strong i em u s small mark sub sup code kbd br p span div ul ol li dl dt dd table thead tbody tfoot tr th td caption hr h1 h2 h3 h4 h5 h6 abbr time'.split(' '));
  const ATTRS = new Set(['class', 'lang', 'dir', 'title', 'colspan', 'rowspan', 'datetime']);
  const leaks = (html: string): string[] => {
    const d = document.createElement('div');
    d.append(safeHtml(html));
    return [...d.querySelectorAll('*')].flatMap((e) => [
      ...(KEPT.has(e.localName) && e.namespaceURI === 'http://www.w3.org/1999/xhtml' ? [] : [e.localName]),
      ...[...e.attributes].filter((a) => !ATTRS.has(a.name)).map((a) => `@${a.name}`),
    ]);
  };
  it('SVG and MathML namespaces, foreign content breaking out, attribute case, entities, noscript, attribute quoting', () => {
    for (const trick of [
      '<svg><foreignObject><b onclick=x>x</b><img src=x></foreignObject></svg>',
      '<math><mtext><table><mglyph><style><img src=x onerror=alert(1)>',
      '<math><mi xlink:href="javascript:alert(1)">m</mi></math>',
      '<B CLASS="k" ONCLICK="x()" STYLE="background:url(//e)">b</B>',
      '<noscript><p title="</noscript><img src=x onerror=alert(1)>"></p></noscript>',
      '<p title="</p><img src=x>">t</p>',
      '<table><img src=x><tr><td colspan="2" background="x">c</td></tr></table>',
      '<div dir="rtl" lang="ar" id="clobber" name="x" is="x-y" xmlns:xlink="x" xlink:href="javascript:x">d</div>',
      '<x-y onclick="x"><span>s</span></x-y><selectedcontent><img src=x></selectedcontent>',
      '<div><template shadowrootmode="open"><img src=x onerror=alert(1)></template></div>',
    ]) expect(leaks(trick), trick).toEqual([]);
    const d = document.createElement('div');
    d.append(safeHtml('&lt;img src=x onerror=alert(1)&gt;<B CLASS="k" ONCLICK="x()">b</B>'));
    expect(d.childNodes[0]!.nodeValue).toBe('<img src=x onerror=alert(1)>');
    expect(d.innerHTML).toContain('<b class="k">b</b>');
  });
});
