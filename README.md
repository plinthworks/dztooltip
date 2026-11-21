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
- **A modal popover** (`modal: true`): the rest of the page is `inert` while it is open, Tab stays inside, Escape (from
  anywhere) and a press outside close it, and the focus goes back to the trigger. `initialFocus` (an element, a
  function given the bubble, or `false`) and `returnFocus` (`true`, an element, or `false`) say where the focus goes.
- **A hover card** (`openOn: 'hover'`): a popover opened by the pointer resting on its trigger (`delayMs`, 500) or a
  keyboard focus, closed when the pointer leaves both (`hideDelayMs`, 150) or on Escape. It moves no focus; Tab from the
  trigger goes into it. Put in it only what the trigger already offers another way (a link's preview, a person's
  details): touch and screen reader users may never open it.
- **The way to the bubble**: moving from the anchor to a shown tooltip or hover card, even diagonally to its far corner,
  does not close it (a safe triangle).
- **Placement**: `top`, `bottom`, `start`, `end` (the line's: mirrored in right to left), `left`, `right` (the screen's),
  each with `-start` / `-end`, or `auto` (the side with the most room). Not fitting, it moves to the opposite side, then
  across (`flip: false`: never). Never bigger than the room: its content scrolls. It follows its anchor while shown and
  goes with it (`everyFrame: true` also follows an anchor moved by an animation or a transform). In the top layer: no
  `overflow` or transform around the anchor clips it; inside a modal `<dialog>` it goes in the dialog (`root` to
  choose). `offset`: the gap (4 px by default), or `{ mainAxis, crossAxis, alignmentAxis }`, or a function of the side
  and the sizes. `shift`: `true` (kept in the window), `'attached'` (never off its anchor), `false`. A link broken over
  lines gets its bubble on the line hovered (the first one from the keyboard).
- **Anchors**: an element — inside a shadow root too (described through ARIA element reflection, or `aria-description`)
  or inside a same-origin iframe (`root: parent.document.body` puts the bubble in the page, over the iframe) — or a
  virtual anchor, any object with `getBoundingClientRect()` and an optional `contextElement` (a point, a chart's mark, a
  text selection's `Range` as it is), shown by code. `followCursor` (`true`, `'inline'`, `'block'`) places a tooltip by
  the pointer and moves it along.
- **Content**: words; a `Node`; `{ html }`, cleaned by `safeHtml` (an allowlist rebuilt from an inert document: no
  script, no event attribute, no `style`, no URL, no SVG or MathML survives); or a function called at each opening,
  which may return `{ node, gone }` (`gone()` when the content goes).
- **Look**: `tone` (`info`, `neutral`, `success`, `warning`, `danger`), `animation` (`fade`, `scale`, `slide`, `pop`,
  `rise`, `morph`, `none`), `shape` (`bubble`, `ticket`, `pill`, or your SVG path data in a 100 × 100 box), `style`
  (CSS variables only), `maxWidth`. Reduced motion is respected (`reducedMotion: 'fade'` keeps a short fade).
- **Your own animation**: `animate(el, 'open' | 'close', info)` — a closing waits for what it returns (a promise, a WAAPI
  `animation.finished`, a GSAP tween or timeline).
- **A strict CSP**: one `<style>` is added per document for the layout; pass `nonce`.
- **Bad input never throws**: an anchor that is neither an element nor a virtual anchor is reported (`reportError`,
  `dztooltip: not-an-element`) and gets a handle that does nothing; a virtual anchor whose rectangle cannot be read is
  reported once (`dztooltip: not-a-rect`) and shows nothing. Messages never carry your content.

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
`dzPopoverPlacement`, `dzTooltipGroup`, `dzPopoverRoot`, `dzTooltipOffset`, `dzTooltipShift`, `dzTooltipEveryFrame`,
`dzTooltipFollowCursor`, `dzPopoverModal`, `dzPopoverInitialFocus`, `dzPopoverReturnFocus`, `dzPopoverOpenOn="hover"`,
`dzPopoverDelay`, `dzPopoverHideDelay`…); `isOpen()` is a signal; `opened` and `closed` are outputs.
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

## Try it

`npm run playground` in a clone serves a test page at http://localhost:4740/ — every capability in a section with its
code (tones, placements, offset, animations, shapes, rich and cleaned content, popovers, modal, hover card, delay
groups, a `<dialog>`, size, following, virtual anchors, a broken link, shadow DOM, an iframe, a DzGrid), light or
dark, left to right or right to left. Made-up content.

## Licence

MIT © Plinthworks. From 1.0.0 the public API follows semver; `@dztooltip/core/internal` is for this repository's own
packages and has no semver promise.

Two guards hold that promise in a clone, after `npm run build` (both run in `npm run release:check`):

```sh
npm run check:size   # each published entry, minified and gzipped, against size-budget.json
npm run check:api    # no public type removed or narrowed against api/*.api.txt (the published 1.0.0)
```
