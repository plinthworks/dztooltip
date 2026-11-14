# DzTooltip

Tooltips and popovers for any page — placement, tones, shapes, animations, any content — and the bridge that draws a
DzGrid's cell and header tooltips with them.

- **`@dztooltip/core`** — `tooltip(el, options)`, `popover(trigger, options)`, `safeHtml`: twelve placements and
  `auto`, flip and shift, the arrow following the anchor; tones (`info`, `neutral`, `success`, `warning`, `danger`);
  ready-made shapes (`bubble`, `ticket`, `pill`) or your SVG path; CSS animations (`fade`, `scale`, `slide`, `pop`,
  `rise`, `morph`) or your own (`animate`, a GSAP timeline welcome), reduced motion respected; words, nodes, or HTML
  cleaned. Popovers are non-modal dialogs: Escape, a press outside, Tab past the end close them. No dependency.
- **`@dztooltip/angular`** — `[dzTooltip]` and `[dzPopover]`: words, an `<ng-template>`, a component, or HTML through
  Angular's sanitizer and then `safeHtml`.
- **`@dztooltip/theme`** — `dztooltip.css` (or `dztooltip.unlayered.css`, or `dztooltip.scss`): every look a CSS
  variable, `--tz-*` (the palette shared with tzslot and DzGrid) and `--dzt-*`.
- **`@dztooltip/dzgrid`** — the bridge, for DzGrid 1.12.0 and later:

  ```ts
  import { dzTooltips } from '@dztooltip/dzgrid';
  createGrid(host, { …, features: [dzTooltips({ tone: 'neutral', placement: 'top', animation: 'morph' })] });
  ```

  A column's `tooltip: { when: 'truncated', tone: 'warning', shape: 'pill' }` then draws its look too.
- **`@dztooltip/gsap`** — later: richer GSAP animations (morphing shapes), only for apps that want them.

```ts
import { tooltip, popover } from '@dztooltip/core';
import '@dztooltip/theme/dztooltip.css';

tooltip(document.querySelector('#save')!, { content: 'Saves the draft', tone: 'success', placement: 'top' });
popover(document.querySelector('#more')!, { content: () => form(), label: 'Details' });
```

Right to left is designed in (`start` / `end` follow the reading direction; `left` / `right` are the screen's).
Tooltips follow WCAG 1.4.13: shown on hover after a delay and at once on keyboard focus, hoverable, dismissed by
Escape, described by `aria-describedby`.

Status: 1.0.0 being prepared (CHANGELOG.md); not on npm yet (organisation `dztooltip`). From 1.0.0 the public API follows semver. MIT © Plinthworks
