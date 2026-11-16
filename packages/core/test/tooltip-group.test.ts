// Delay groups (docs/behaviors/tooltips-popovers.md 29): in a toolbar, once a tooltip is on screen the next one shows at
// once in its place, and for 300 ms after it hid; the group is the anchor's parent, a shared name, or none (`false`).
// Expectations written by hand.
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { tooltip, type TooltipHandle, type TooltipOptions } from '../src/tooltip.js';

let handles: TooltipHandle[] = [];
beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  for (const h of handles) h.destroy();
  handles = [];
  document.body.innerHTML = '';
  vi.useRealTimers();
});

const bubble = () => document.querySelector<HTMLElement>('.dzt-tooltip.dzt-float')!;
const enter = (el: Element) => el.dispatchEvent(new PointerEvent('pointerenter', { pointerType: 'mouse' }));
const leave = (el: Element, to: Element | null = document.body) => el.dispatchEvent(new PointerEvent('pointerleave', { relatedTarget: to }));
/** A toolbar of buttons, each with its tooltip (500 ms by default). */
function bar(labels: string[], o: Partial<TooltipOptions> = {}, into: Element = document.body): HTMLButtonElement[] {
  const tb = into.appendChild(document.createElement('div'));
  return labels.map((l) => {
    const b = tb.appendChild(document.createElement('button'));
    b.textContent = l;
    handles.push(tooltip(b, { content: `${l}!`, ...o }));
    return b;
  });
}
const on = (): string | null => (bubble()?.hidden === false ? bubble().textContent : null);

describe('delay groups (29)', () => {
  it('a toolbar: the first waits its delay; the next shows at once in its place, described, the first no longer', () => {
    const [one, two] = bar(['One', 'Two']);
    enter(one!);
    vi.advanceTimersByTime(499);
    expect(on()).toBeNull();
    vi.advanceTimersByTime(1);
    expect(on()).toBe('One!');
    leave(one!, two!);
    enter(two!);
    expect(on()).toBe('Two!');
    expect(two!.getAttribute('aria-describedby')).toBe(bubble().id);
    expect(one!.hasAttribute('aria-describedby')).toBe(false);
  });

  it('300 ms after it hid, still at once; past them, the delay again', () => {
    const [one, two, three] = bar(['One', 'Two', 'Three']);
    enter(one!);
    vi.advanceTimersByTime(500);
    leave(one!);
    // The 150 ms grace, then hidden.
    vi.advanceTimersByTime(150);
    expect(on()).toBeNull();
    vi.advanceTimersByTime(299);
    enter(two!);
    expect(on()).toBe('Two!');
    leave(two!);
    vi.advanceTimersByTime(150 + 300);
    enter(three!);
    expect(on()).toBeNull();
    vi.advanceTimersByTime(500);
    expect(on()).toBe('Three!');
  });

  it('another container: its own delay, the first tooltip staying meanwhile', () => {
    const [one] = bar(['One']);
    const [other] = bar(['Other']);
    enter(one!);
    vi.advanceTimersByTime(500);
    leave(one!, other!);
    enter(other!);
    expect(on()).toBe('One!');
    vi.advanceTimersByTime(500);
    expect(on()).toBe('Other!');
  });

  it('group: a shared name joins anchors of different containers', () => {
    const [one] = bar(['One'], { group: 'tools' });
    const [other] = bar(['Other'], { group: 'tools' });
    enter(one!);
    vi.advanceTimersByTime(500);
    leave(one!, other!);
    enter(other!);
    expect(on()).toBe('Other!');
  });

  it('group: false — always its own delay, even beside a tooltip on screen', () => {
    const [one] = bar(['One']);
    const lone = one!.parentElement!.appendChild(document.createElement('button'));
    handles.push(tooltip(lone, { content: 'Lone!', group: false }));
    enter(one!);
    vi.advanceTimersByTime(500);
    leave(one!, lone);
    enter(lone);
    expect(on()).toBe('One!');
    vi.advanceTimersByTime(500);
    expect(on()).toBe('Lone!');
  });
});
