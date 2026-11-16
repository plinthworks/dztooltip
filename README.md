# DzTooltip

Tooltips and popovers for any page — placement, tones, shapes, animations, any content — and the bridge that draws a
DzGrid's cell and header tooltips with them. Written from scratch in TypeScript; the core has no dependency.

| Package | What |
| --- | --- |
| [`@dztooltip/core`](packages/core) | `tooltip(el, options)`, `popover(trigger, options)`, `safeHtml(html)` — no dependency |
| [`@dztooltip/theme`](packages/theme) | the look: `dztooltip.css` (layer `dztooltip.theme`), `dztooltip.unlayered.css`, `dztooltip.scss` |
| [`@dztooltip/angular`](packages/angular) | `[dzTooltip]`, `[dzPopover]` — Angular 19 to 22, signals, templates, components |
| [`@dztooltip/dzgrid`](packages/dzgrid) | `dzTooltips(options)` — a DzGrid feature (DzGrid 1.13.0 and later) |

## Install

```sh
npm install @dztooltip/core @dztooltip/theme
npm install @dztooltip/angular          # an Angular app
npm install @dztooltip/dzgrid           # a DzGrid (@dzgrid/dom ^1.13.0)
```

## On any page

```ts
import { tooltip, popover } from '@dztooltip/core';
import '@dztooltip/theme/dztooltip.css';

const save = tooltip(document.querySelector<HTMLElement>('#save')!, { content: 'Saves the draft', tone: 'success', placement: 'top' });
const more = popover(document.querySelector<HTMLElement>('#more')!, { content: () => form(), label: 'Details' });
// …when the element goes:
save.destroy();
more.destroy();
```

- **A tooltip** shows after `delayMs` (500) on hover — never on touch alone — and at once on a keyboard focus; the
  pointer may move onto it; Escape, a press, a scroll or the pointer leaving hide it; `aria-describedby` while shown
  (WCAG 1.4.13). One tooltip on screen at a time. `when: 'truncated'`: only while the element's text is cut.
  Delay groups (`group`, the element's parent by default): once a tooltip of a toolbar shows, the next one shows at once.
- **A popover** is a non-modal dialog opened by a click (`openOn: 'manual'`: by code only). Escape (the focus back to
  the trigger), a press outside, Tab past its end, the trigger again or `close()` close it; `onClose(reason)` says why.
  Nested popovers stay open together; one open per `group` otherwise.
- **Placement**: `top`, `bottom`, `start`, `end` (the line's: mirrored in right to left), `left`, `right` (the screen's),
  each with `-start` / `-end`, or `auto` (the side with the most room). Not fitting, it moves to the opposite side, then
  across (`flip: false`: never). Never bigger than the room: its content scrolls. It follows its anchor while shown and
  goes with it. In the top layer: no `overflow` or transform around the anchor clips it; inside a modal `<dialog>` it
  goes in the dialog (`root` to choose).
- **Content**: words; a `Node`; `{ html }`, cleaned by `safeHtml` (an allowlist rebuilt from an inert document: no
  script, no event attribute, no `style`, no URL, no SVG or MathML survives); or a function called at each opening,
  which may return `{ node, gone }` (`gone()` when the content goes).
- **Look**: `tone` (`info`, `neutral`, `success`, `warning`, `danger`), `animation` (`fade`, `scale`, `slide`, `pop`,
  `rise`, `morph`, `none`), `shape` (`bubble`, `ticket`, `pill`, or your SVG path data in a 100 × 100 box), `style`
  (CSS variables only), `maxWidth`. Reduced motion is respected (`reducedMotion: 'fade'` keeps a short fade).
- **Your own animation**: `animate(el, 'open' | 'close', info)` — a closing waits for what it returns (a promise, a WAAPI
  `animation.finished`, a GSAP tween or timeline).
- **A strict CSP**: one `<style>` is added per document for the layout; pass `nonce`.
- **Bad input never throws**: a non-element anchor is reported (`reportError`, `dztooltip: not-an-element`) and gets a
  handle that does nothing. Messages never carry your content.

## Angular

```ts
import { DzTooltip, DzPopover } from '@dztooltip/angular';

@Component({
  imports: [DzTooltip, DzPopover],
  template: `
    <button [dzTooltip]="'Delete the row'" dzTooltipTone="danger" dzTooltipPlacement="top">Delete</button>
    <button [dzPopover]="details" [dzPopoverContext]="row" #p="dzPopover" (closed)="saved($event)">More</button>
    <ng-template #details let-row let-close="close">{{ row.name }} <button (click)="close()">Done</button></ng-template>
  `,
})
```

`[dzTooltip]` and `[dzPopover]` take words, an `<ng-template>` (its `let-` value is `…Context`), a component class (its
inputs `…Inputs`) or `{ html }` (Angular's sanitizer, then `safeHtml`). Every option above is an input (`dzTooltipTone`,
`dzPopoverPlacement`, `dzTooltipGroup`, `dzPopoverRoot`…); `isOpen()` is a signal; `opened` and `closed` are outputs.
Nothing runs on the server.

## DzGrid

```ts
import { createGrid } from '@dzgrid/dom';
import { dzTooltips } from '@dztooltip/dzgrid';

createGrid(host, { …, features: [dzTooltips({ tone: 'neutral', placement: 'top', animation: 'morph', header: true, html: true })] });
```

DzGrid still decides when a cell's or a header's tooltip shows and what it says; DzTooltip draws it. A column's
`tooltip: { when: 'truncated', tone: 'warning', shape: 'pill' }` wins over the feature's options. `header: true`: the
header's buttons say their name; `html: true`: a column's `{ html }` tooltip, cleaned. With `@dzgrid/angular`, pass it
in `[features]`.

## Variables

Every look is a CSS variable: `--tz-*`, the palette shared with tzslot and DzGrid (`--tz-fg`, `--tz-bg`,
`--tz-bg-raised`, `--tz-border`, `--tz-success`, `--tz-warning`, `--tz-danger`, `--tz-color-scheme`), and DzTooltip's
own `--dzt-*`. The main ones:

| Variable | Default |
| --- | --- |
| `--dzt-tooltip-bg`, `--dzt-tooltip-fg` | `--tz-fg`, `--tz-bg` |
| `--dzt-tooltip-<tone>-bg`, `-fg`, `-border`, `-arrow` | the tone's palette colour |
| `--dzt-tooltip-radius`, `--dzt-radius` | `0.375rem` |
| `--dzt-tooltip-max-width` | `20rem` |
| `--dzt-tooltip-padding-block`, `-inline` | `0.25rem`, `0.5rem` |
| `--dzt-tooltip-font-size`, `-font-family`, `-font-weight`, `-line-height` | inherited |
| `--dzt-tooltip-arrow-size` | `0.375rem` |
| `--dzt-tooltip-open-duration`, `-close-duration`, `-open-delay` | `140ms`, `100ms`, `0s` |
| `--dzt-popover-bg`, `-fg`, `-border` | `--tz-bg`, `--tz-fg`, `--tz-border` |
| `--dzt-popover-radius`, `-padding`, `-shadow` | `0.375rem`, `0.75rem`, a soft shadow |
| `--dzt-popover-max-width`, `-max-height` | `32rem`, the window less 32px |
| `--dzt-shape-shadow` | `none` (a `filter` around a shape) |
| `--dzt-viewport-padding` | `8px` (px; how far bubbles keep from the window's edges) |

Every other one (the animations', the shapes') is read in `dztooltip.scss` as `var(--dzt-…, default)`. Without the
theme the bubbles keep their layout and a plain look (system colours).

Right to left is designed in: `start` / `end` follow the reading direction, `left` / `right` are the screen's.

## Licence

MIT © Plinthworks. From 1.0.0 the public API follows semver; `@dztooltip/core/internal` is for this repository's own
packages and has no semver promise.
