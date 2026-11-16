/**
 * `[dzPopover]` (docs/behaviors/tooltips-popovers.md 10–15), the bubble that stays — a non-modal dialog by any element
 * of the app or of a grid's cell, holding a template, a component (a form, a grid), words, or cleaned HTML. Placed and
 * animated like the tooltips (`@dztooltip/theme`). Nothing runs on a server.
 */
import {
  ApplicationRef, DestroyRef, Directive, ElementRef, EnvironmentInjector, Injector, PLATFORM_ID,
  afterNextRender, effect, inject, input, output, signal, untracked,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { popover, type PopoverCloseReason, type PopoverHandle } from '@dztooltip/core';
import { ɵdefined, ɵdzDraw, type DzTipContent, type TipAnimate, type TipAnimation, type TipLook, type TipTone, type TooltipPlacement } from './tooltip';

/**
 * `<button [dzPopover]="details" [dzPopoverContext]="row" #p="dzPopover" (opened)="…" (closed)="…">`. A click on the
 * host opens and closes it (`dzPopoverOpenOn="manual"`: only `open()`, `close()`, `toggle()`); Escape, a press outside
 * or the focus leaving close it. A template's `let-` value is the context, and `close()` is in its context.
 */
@Directive({ selector: '[dzPopover]', exportAs: 'dzPopover' })
export class DzPopover {
  readonly dzPopover = input<DzTipContent>();
  readonly dzPopoverContext = input<unknown>();
  readonly dzPopoverInputs = input<Readonly<Record<string, unknown>>>();
  readonly dzPopoverPlacement = input<TooltipPlacement>();
  readonly dzPopoverFlip = input<boolean>();
  /** A ready-made shape (`bubble`, `ticket`, `pill`), or the bubble drawn as this SVG path (`d`, a 100 × 100 box) to morph. */
  readonly dzPopoverShape = input<string>();
  readonly dzPopoverReducedMotion = input<'none' | 'fade'>();
  /** Its look through variables only: custom properties written on the bubble while it is open. */
  readonly dzPopoverStyle = input<Readonly<Record<`--${string}`, string>>>();
  readonly dzPopoverMaxWidth = input<number | string>();
  readonly dzPopoverTone = input<TipTone>();
  readonly dzPopoverAnimation = input<TipAnimation>();
  readonly dzPopoverAnimate = input<TipAnimate>();
  readonly dzPopoverLabel = input<string>();
  readonly dzPopoverGroup = input<string>();
  /** `click` toggles it; `hover`: a hover card (sheet 40); `manual`: only code. @default 'click' */
  readonly dzPopoverOpenOn = input<'click' | 'hover' | 'manual'>();
  /** A hover card's delay before it opens, ms (sheet 40). @default 500 */
  readonly dzPopoverDelay = input<number>();
  /** A hover card's grace after the pointer leaves, ms (sheet 40). @default 150 */
  readonly dzPopoverHideDelay = input<number>();
  /** A modal dialog: the rest of the page inert, Tab kept inside (sheet 36). @default false */
  readonly dzPopoverModal = input<boolean>();
  /** Where the focus goes when it opens: an element, a function given the bubble, or `false` (sheet 36). */
  readonly dzPopoverInitialFocus = input<HTMLElement | ((bubble: HTMLElement) => HTMLElement | null | undefined) | false>();
  /** Where the focus goes back: the trigger (`true`), this element, or nowhere (sheet 36). @default true */
  readonly dzPopoverReturnFocus = input<boolean | HTMLElement>();
  /** The gap (px) and a slide of the app's, or a function of the side and the sizes (sheet 31). @default 4 */
  readonly dzPopoverOffset = input<TipLook['offset']>();
  /** Slid to stay in the window: `true`, `'attached'` (never off its trigger), `false` (sheet 32). @default true */
  readonly dzPopoverShift = input<boolean | 'attached'>();
  /** The trigger's box checked at every frame while open: an animated trigger (sheet 39). @default false */
  readonly dzPopoverEveryFrame = input<boolean>();
  /** Where the bubble goes in the page (sheet 30). @default the trigger's open `<dialog>`, or the page's end */
  readonly dzPopoverRoot = input<HTMLElement>();
  readonly opened = output<void>();
  readonly closed = output<PopoverCloseReason>();
  readonly #open = signal(false);
  /** Whether it is open (a signal). */
  readonly isOpen = this.#open.asReadonly();
  #handle: PopoverHandle | null = null;

  constructor() {
    if (!isPlatformBrowser(inject(PLATFORM_ID))) return;
    const el: HTMLElement = inject(ElementRef).nativeElement;
    const ng = { app: inject(ApplicationRef), env: inject(EnvironmentInjector), injector: inject(Injector) };
    const rendered = signal(false);
    // Destroyed: its outputs are gone too — the closing a destroy causes is not emitted.
    let live = true;
    afterNextRender(() => rendered.set(true));
    effect(() => {
      if (!rendered()) return;
      const what = this.dzPopover();
      const o = {
        content: what == null || typeof what === 'string' ? (what ?? '') : ɵdzDraw(what, () => untracked(this.dzPopoverContext), () => untracked(this.dzPopoverInputs), () => this.close(), ng),
        ...ɵdefined({
          placement: this.dzPopoverPlacement(), flip: this.dzPopoverFlip(), shape: this.dzPopoverShape(), reducedMotion: this.dzPopoverReducedMotion(), tone: this.dzPopoverTone(), animation: this.dzPopoverAnimation(), animate: this.dzPopoverAnimate(), style: this.dzPopoverStyle(), maxWidth: this.dzPopoverMaxWidth(),
          label: this.dzPopoverLabel(), group: this.dzPopoverGroup(), openOn: this.dzPopoverOpenOn(), root: this.dzPopoverRoot(),
          delayMs: this.dzPopoverDelay(), hideDelayMs: this.dzPopoverHideDelay(), modal: this.dzPopoverModal(), initialFocus: this.dzPopoverInitialFocus(), returnFocus: this.dzPopoverReturnFocus(),
          offset: this.dzPopoverOffset(), shift: this.dzPopoverShift(), everyFrame: this.dzPopoverEveryFrame(),
        }),
        onOpen: () => (this.#open.set(true), this.opened.emit()),
        onClose: (r: PopoverCloseReason) => (this.#open.set(false), live && this.closed.emit(r)),
      };
      untracked(() => (this.#handle ? this.#handle.update(o) : (this.#handle = popover(el, o))));
    });
    inject(DestroyRef).onDestroy(() => ((live = false), this.#handle?.destroy()));
  }

  open(): void {
    this.#handle?.open();
  }

  close(): void {
    this.#handle?.close();
  }

  toggle(): void {
    this.#handle?.toggle();
  }

  /** Places it again (its content changed size). */
  reposition(): void {
    this.#handle?.reposition();
  }
}

export type { PopoverCloseReason };
