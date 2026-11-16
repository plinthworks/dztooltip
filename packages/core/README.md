# @dztooltip/core

Tooltips and popovers for any element of a page: twelve placements and `auto`, flip and shift, the arrow following the
anchor, never bigger than the room; tones, shapes, CSS animations (with `@dztooltip/theme`) or your own (`animate`);
words, nodes, or HTML cleaned by `safeHtml`. Right to left designed in, WCAG 1.4.13. No dependency.

```sh
npm install @dztooltip/core @dztooltip/theme
```

```ts
import { tooltip, popover, safeHtml } from '@dztooltip/core';
import '@dztooltip/theme/dztooltip.css';

const t = tooltip(button, { content: 'Saves the draft', tone: 'success', placement: 'top' });
const p = popover(more, { content: () => form(), label: 'Details', onClose: (reason) => console.log(reason) });
// when the elements go: t.destroy(); p.destroy();
```

`@dztooltip/core/internal` is for DzTooltip's own packages (no semver promise). Options, the Angular directives, the
DzGrid bridge and the CSS variables: https://github.com/plinthworks/dztooltip#readme. MIT © Plinthworks.
