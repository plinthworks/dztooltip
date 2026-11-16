// dzTooltip and dzPopover (docs/behaviors/tooltips-popovers.md): the core's tooltips and popovers on any element of an
// Angular app. Expectations written by hand (moved from DzGrid 1.12's work; its check in a grid's cell component waits
// for the bridge's Angular checks, once DzGrid 1.12 is published).
import { describe, it, expect, afterEach, vi } from 'vitest';
import { ChangeDetectionStrategy, Component, input, signal, type OnDestroy } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { DzTooltip, DzPopover, type PopoverCloseReason } from '@dztooltip/angular';

afterEach(() => {
  document.body.innerHTML = '';
  vi.useRealTimers();
});

const gone = { n: 0 };

@Component({ selector: 't-tip', changeDetection: ChangeDetectionStrategy.OnPush, template: `<em class="tip-c">{{ who() }} · {{ n() }}</em>` })
class TipCard implements OnDestroy {
  readonly who = input('');
  readonly n = input(0);
  ngOnDestroy(): void {
    gone.n++;
  }
}

@Component({
  selector: 't-host',
  imports: [DzTooltip, DzPopover],
  template: `
    <button class="b1" type="button" [dzTooltip]="text()" dzTooltipTone="danger" [dzTooltipDelay]="0" dzTooltipPlacement="left" dzTooltipAnimation="pop">Delete</button>
    <button class="b2" type="button" [dzTooltip]="tpl" [dzTooltipContext]="row()" [dzTooltipDelay]="0">Row</button>
    <ng-template #tpl let-r><strong class="t-in">{{ r.name }}</strong></ng-template>
    <button class="b3" type="button" [dzTooltip]="card" [dzTooltipInputs]="{ who: 'Ann', n: 3 }" [dzTooltipDelay]="0">Card</button>
    <button class="b4" type="button" [dzTooltip]="{ html: html }" [dzTooltipDelay]="0">Html</button>
    <button class="b5" type="button" dzTooltip="Shaped" dzTooltipShape="M0 0 H100 V100 H0 Z" [dzTooltipDelay]="0">Shape</button>
    <button class="b6" type="button" dzTooltip="Morph" dzTooltipShape="bubble" dzTooltipAnimation="morph" [dzTooltipStyle]="{ '--dzt-tooltip-bubble-radius': '1rem' }" [dzTooltipMaxWidth]="180" dzTooltipWhen="truncated" [dzTooltipDelay]="0">Morph</button>
    <button class="p1" type="button" [dzPopover]="form" [dzPopoverContext]="row()" dzPopoverLabel="Edit the row" #p="dzPopover"
      (opened)="log.push('opened')" (closed)="log.push('closed:' + $event)">Edit</button>
    <ng-template #form let-r let-close="close"><label>Name <input class="f-name" [value]="r.name"></label><button class="f-done" type="button" (click)="close()">Done</button></ng-template>
    <button class="p2" type="button" [dzPopover]="card" [dzPopoverInputs]="{ who: 'Bob', n: 7 }" dzPopoverOpenOn="manual">Card</button>
  `,
})
class Host {
  readonly text = signal('Removes the row');
  readonly row = signal({ name: 'Ann' });
  readonly card = TipCard;
  readonly html = '<b>Bold</b><img src="x" onerror="alert(1)"><script>alert(2)</script>';
  readonly log: string[] = [];
}

function mount() {
  const fixture = TestBed.createComponent(Host);
  document.body.appendChild(fixture.nativeElement);
  fixture.detectChanges();
  const q = <E extends HTMLElement = HTMLElement>(s: string) => document.querySelector<E>(s)!;
  const enter = (s: string) => q(s).dispatchEvent(new PointerEvent('pointerenter', { pointerType: 'mouse' }));
  const bubble = () => document.querySelector<HTMLElement>('.dzt-tooltip.dzt-float');
  return { fixture, q, enter, bubble, host: fixture.componentInstance };
}

describe('dzTooltip', () => {
  it('words, with a tone, a placement and a preset; described; the words follow the input', () => {
    vi.useFakeTimers();
    const { q, enter, bubble, host, fixture } = mount();
    q('.b1').getBoundingClientRect = () => ({ left: 400, right: 480, top: 300, bottom: 330, width: 80, height: 30, x: 400, y: 300, toJSON: () => null });
    enter('.b1');
    vi.advanceTimersByTime(0);
    expect(bubble()!.hidden).toBe(false);
    expect(bubble()!.textContent).toBe('Removes the row');
    expect(bubble()!.getAttribute('data-tone')).toBe('danger');
    // left in a left-to-right page: before the line's start.
    expect(bubble()!.getAttribute('data-side')).toBe('inline-start');
    expect(bubble()!.getAttribute('data-animation')).toBe('pop');
    expect(q('.b1').getAttribute('aria-describedby')).toBe(bubble()!.id);
    host.text.set('Deletes it for good');
    fixture.detectChanges();
    expect(bubble()!.textContent).toBe('Deletes it for good');
  });

  it('a template with its context; destroyed when it goes', () => {
    vi.useFakeTimers();
    const { enter, bubble, q } = mount();
    enter('.b2');
    vi.advanceTimersByTime(0);
    expect(bubble()!.querySelector('.t-in')!.textContent).toBe('Ann');
    q('.b2').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    expect(bubble()!.hidden).toBe(true);
    expect(bubble()!.querySelector('.t-in')).toBeNull();
  });

  it('a component with its inputs, created at each show, destroyed at hide', () => {
    vi.useFakeTimers();
    gone.n = 0;
    const { enter, bubble, q } = mount();
    enter('.b3');
    vi.advanceTimersByTime(0);
    expect(bubble()!.querySelector('.tip-c')!.textContent).toBe('Ann · 3');
    q('.b3').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    expect(gone.n).toBe(1);
  });

  it('HTML: through Angular\'s sanitizer (it says what it stripped), then the allowlist — no image, no script', () => {
    vi.useFakeTimers();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { enter, bubble } = mount();
    enter('.b4');
    vi.advanceTimersByTime(0);
    expect(bubble()!.innerHTML).toBe('<b>Bold</b>');
    expect(warn.mock.calls.some((c) => String(c[0]).includes('sanitizing HTML stripped some content'))).toBe(true);
    warn.mockRestore();
  });
});

it('dzTooltipShape: the bubble drawn as the app\'s path', () => {
  vi.useFakeTimers();
  const { enter, bubble } = mount();
  enter('.b5');
  vi.advanceTimersByTime(0);
  expect(bubble()!.hasAttribute('data-shape')).toBe(true);
  expect(bubble()!.querySelector('svg.dzt-tip-shape > path')!.getAttribute('d')).toBe('M0 0 H100 V100 H0 Z');
});

it('1.12.0 (sheet 20–23): a ready-made shape, the morph, variables, a width and when: the same names as the grid\'s', () => {
  vi.useFakeTimers();
  const { enter, bubble, q } = mount();
  enter('.b6');
  vi.advanceTimersByTime(0);
  // jsdom lays nothing out: the label is not cut, so nothing shows; made to look cut, it shows.
  expect(bubble()?.hidden ?? true).toBe(true);
  Object.defineProperty(q('.b6'), 'scrollWidth', { configurable: true, value: 90 });
  Object.defineProperty(q('.b6'), 'clientWidth', { configurable: true, value: 40 });
  enter('.b6');
  vi.advanceTimersByTime(0);
  const b = bubble()!;
  expect([b.hidden, b.dataset['shape'], b.dataset['animation'], b.style.getPropertyValue('--dzt-tooltip-bubble-radius'), b.style.getPropertyValue('max-inline-size')]).toEqual([false, 'bubble', 'morph', '1rem', 'min(180px, var(--dzt-available-inline-size, 100vw))']);
});

describe('dzPopover', () => {
  it('a click opens it: a dialog named by its label, the template with its context, the focus inside; Done (close()) closes it, the focus back', () => {
    const { q, fixture, host } = mount();
    const t = q('.p1');
    t.focus();
    t.click();
    fixture.detectChanges();
    const dlg = document.querySelector<HTMLElement>('.dzt-popover')!;
    expect(dlg.getAttribute('role')).toBe('dialog');
    expect(dlg.getAttribute('aria-label')).toBe('Edit the row');
    expect(t.getAttribute('aria-expanded')).toBe('true');
    expect(dlg.querySelector<HTMLInputElement>('.f-name')!.value).toBe('Ann');
    expect(document.activeElement).toBe(dlg.querySelector('.f-name'));
    dlg.querySelector<HTMLElement>('.f-done')!.click();
    expect(document.querySelector('.dzt-popover')).toBeNull();
    expect(document.activeElement).toBe(t);
    expect(host.log).toEqual(['opened', 'closed:code']);
  });

  it('isOpen, open() / close() / toggle(); Escape and a press outside; manual ignores clicks', () => {
    const { q, fixture, host } = mount();
    const dir = fixture.debugElement.children.find((d) => (d.nativeElement as HTMLElement).classList.contains('p2'))!.injector.get(DzPopover);
    q('.p2').click();
    expect(dir.isOpen()).toBe(false);
    dir.open();
    expect(dir.isOpen()).toBe(true);
    expect(document.querySelector('.dzt-popover .tip-c')!.textContent).toBe('Bob · 7');
    dir.toggle();
    expect(dir.isOpen()).toBe(false);
    const p1 = fixture.debugElement.children.find((d) => (d.nativeElement as HTMLElement).classList.contains('p1'))!.injector.get(DzPopover);
    p1.open();
    document.activeElement!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    expect(p1.isOpen()).toBe(false);
    p1.open();
    document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    expect(p1.isOpen()).toBe(false);
    expect(host.log.filter((l) => l.startsWith('closed'))).toEqual(['closed:escape', 'closed:outside'] satisfies `closed:${PopoverCloseReason}`[]);
  });
});

// A cell's action icon (brief item 5): a popover from a grid's cell component, closed when the row is recycled.
it('review: destroyed while open, the popover closes without emitting on a destroyed output', () => {
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  const { q, fixture } = mount();
  q('.p1').click();
  fixture.detectChanges();
  expect(document.querySelector('.dzt-popover')).not.toBeNull();
  fixture.destroy();
  expect(document.querySelector('.dzt-popover')).toBeNull();
  expect(warn.mock.calls.map((c) => String(c[0])).filter((m) => /destroyed/i.test(m))).toEqual([]);
  warn.mockRestore();
});

@Component({
  selector: 't-wait',
  imports: [DzTooltip, DzPopover],
  template: `
    <button class="w1" type="button" dzTooltip="Saves" [dzTooltipDisabled]="off()" [disabled]="native()">Save</button>
    <button class="w2" type="button" dzTooltip="Details" [dzPopover]="'The form'" dzPopoverOpenOn="manual" #p="dzPopover">More</button>
  `,
})
class Waiting {
  readonly off = signal(false);
  readonly native = signal(false);
}

it('1.12.0 (sheet 18): a show waiting for its delay is dropped by dzTooltipDisabled, by [disabled], by a popover opening from the same trigger', () => {
  vi.useFakeTimers();
  const fixture = TestBed.createComponent(Waiting);
  document.body.appendChild(fixture.nativeElement);
  fixture.detectChanges();
  const q = (s: string) => document.querySelector<HTMLElement>(s)!;
  const enter = (s: string) => q(s).dispatchEvent(new PointerEvent('pointerenter', { pointerType: 'mouse' }));
  const shown = () => !(document.querySelector<HTMLElement>('.dzt-tooltip.dzt-float')?.hidden ?? true);
  enter('.w1');
  vi.advanceTimersByTime(200);
  fixture.componentInstance.off.set(true);
  fixture.detectChanges();
  vi.advanceTimersByTime(1000);
  expect(shown()).toBe(false);
  fixture.componentInstance.off.set(false);
  fixture.detectChanges();
  enter('.w1');
  vi.advanceTimersByTime(200);
  fixture.componentInstance.native.set(true);
  fixture.detectChanges();
  vi.advanceTimersByTime(1000);
  expect(shown()).toBe(false);
  enter('.w2');
  vi.advanceTimersByTime(200);
  // The popover opened by code (a key the app handles) while the tooltip waits.
  const p = fixture.debugElement.children.find((d) => d.nativeElement === q('.w2'))!.references['p'] as DzPopover;
  p.open();
  fixture.detectChanges();
  vi.advanceTimersByTime(1000);
  expect(document.querySelector('.dzt-popover')).not.toBeNull();
  expect(shown()).toBe(false);
  fixture.destroy();
});

@Component({
  selector: 't-robust',
  imports: [DzTooltip, DzPopover],
  template: `
    <div class="layer" #layer></div>
    <div><button class="g1" type="button" dzTooltip="One" dzTooltipGroup="tools">1</button></div>
    <div><button class="g2" type="button" dzTooltip="Two" dzTooltipGroup="tools">2</button></div>
    <button class="r1" type="button" dzTooltip="Rooted" [dzTooltipDelay]="0" [dzTooltipRoot]="layer">R</button>
    <button class="r2" type="button" dzPopover="Popped" [dzPopoverRoot]="layer">P</button>
  `,
})
class Robust {}

it('1.0.0 (sheet 29, 30): dzTooltipGroup joins anchors of different containers; dzTooltipRoot and dzPopoverRoot put the bubble there', () => {
  vi.useFakeTimers();
  const fixture = TestBed.createComponent(Robust);
  document.body.appendChild(fixture.nativeElement);
  fixture.detectChanges();
  TestBed.tick();
  const q = (s: string) => document.querySelector<HTMLElement>(s)!;
  const bubble = () => document.querySelector<HTMLElement>('.dzt-tooltip.dzt-float');
  const enter = (s: string) => q(s).dispatchEvent(new PointerEvent('pointerenter', { pointerType: 'mouse' }));
  enter('.g1');
  vi.advanceTimersByTime(500);
  expect(bubble()!.textContent).toBe('One');
  q('.g1').dispatchEvent(new PointerEvent('pointerleave', { relatedTarget: q('.g2') }));
  enter('.g2');
  expect(bubble()!.textContent).toBe('Two');
  enter('.r1');
  vi.advanceTimersByTime(0);
  expect(bubble()!.parentElement).toBe(q('.layer'));
  q('.r2').click();
  expect(document.querySelector('.dzt-popover')!.parentElement).toBe(q('.layer'));
});

@Component({
  selector: 't-finished',
  imports: [DzTooltip, DzPopover],
  template: `
    <button class="o1" type="button" dzTooltip="Gap" [dzTooltipDelay]="0" [dzTooltipOffset]="10" [dzTooltipShift]="false" [dzTooltipEveryFrame]="true">Gap</button>
    <div class="o2" dzTooltip="Here" [dzTooltipDelay]="0" dzTooltipFollowCursor="inline">Zone</div>
    <a class="h1" href="#ada" [dzPopover]="'Ada, engineer'" dzPopoverOpenOn="hover" [dzPopoverDelay]="200" [dzPopoverHideDelay]="50">Ada</a>
    <button class="m1" type="button" [dzPopover]="form" [dzPopoverModal]="true" [dzPopoverInitialFocus]="pick" [dzPopoverReturnFocus]="back" [dzPopoverOffset]="{ mainAxis: 12 }" dzPopoverShift="attached" [dzPopoverEveryFrame]="true">Modal</button>
    <ng-template #form><button class="m-a" type="button">A</button><button class="m-b" type="button">B</button></ng-template>
    <input class="back">
  `,
})
class Finished {
  readonly pick = (b: HTMLElement) => b.querySelector<HTMLElement>('.m-b');
  back: HTMLElement | undefined;
}

it('1.0.0 (sheet 31, 32, 36, 38, 39, 40): offset, shift, every frame and following the cursor on dzTooltip; a hover card and a modal dzPopover', () => {
  vi.useFakeTimers();
  const frames: FrameRequestCallback[] = [];
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => frames.push(cb));
  const fixture = TestBed.createComponent(Finished);
  document.body.appendChild(fixture.nativeElement);
  const q = (s: string) => document.querySelector<HTMLElement>(s)!;
  fixture.componentInstance.back = q('.back');
  fixture.detectChanges();
  TestBed.tick();
  const bubble = () => document.querySelector<HTMLElement>('.dzt-tooltip.dzt-float')!;
  // An anchor past the window's start edge (-50 to -10), the bubble with no size: centred at -30, not slid (shift false).
  q('.o1').getBoundingClientRect = () => ({ left: -50, right: -10, top: 100, bottom: 120, width: 40, height: 20, x: -50, y: 100, toJSON: () => null });
  q('.o1').dispatchEvent(new PointerEvent('pointerenter', { pointerType: 'mouse' }));
  expect(bubble().style.getPropertyValue('inset-block-start')).toBe('130px');
  expect(bubble().style.getPropertyValue('inset-inline-start')).toBe('-30px');
  // Every frame while shown.
  expect(frames.length).toBeGreaterThan(0);
  q('.o2').getBoundingClientRect = () => ({ left: 0, right: 600, top: 400, bottom: 420, width: 600, height: 20, x: 0, y: 400, toJSON: () => null });
  q('.o2').dispatchEvent(new PointerEvent('pointerenter', { pointerType: 'mouse', clientX: 222, clientY: 405 }));
  // Along the line at the pointer, the block from the zone.
  expect(bubble().style.getPropertyValue('inset-inline-start')).toBe('222px');
  expect(bubble().style.getPropertyValue('inset-block-start')).toBe('424px');
  // A hover card: its own delay, no focus moved.
  q('.h1').dispatchEvent(new PointerEvent('pointerenter', { pointerType: 'mouse' }));
  vi.advanceTimersByTime(199);
  expect(document.querySelector('.dzt-popover')).toBeNull();
  vi.advanceTimersByTime(1);
  expect(document.querySelector('.dzt-popover')!.textContent).toBe('Ada, engineer');
  expect(q('.h1').getAttribute('aria-expanded')).toBe('true');
  // A modal one: its initial focus, the page hidden, its focus given back to the element asked.
  q('.m1').click();
  const modal = document.querySelector<HTMLElement>('.dzt-popover[aria-modal=true]')!;
  expect(document.activeElement).toBe(modal.querySelector('.m-b'));
  expect(fixture.nativeElement.getAttribute('aria-hidden')).toBe('true');
  // Its gap: 12 px under the trigger (no size in jsdom: at 12).
  expect(modal.style.getPropertyValue('inset-block-start')).toBe('12px');
  document.activeElement!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  expect(document.activeElement).toBe(q('.back'));
  expect(fixture.nativeElement.hasAttribute('aria-hidden')).toBe(false);
  fixture.destroy();
});
