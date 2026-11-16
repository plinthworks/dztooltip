# @dztooltip/dzgrid

The bridge: a DzGrid's cell and header tooltips drawn by DzTooltip — placements, tones, shapes, animations, cleaned HTML,
the header's buttons saying their name, one tooltip on screen at a time with the page's. For `@dzgrid/dom` 1.13.0 and
later.

```sh
npm install @dztooltip/dzgrid @dztooltip/theme
```

```ts
import { dzTooltips } from '@dztooltip/dzgrid';
import '@dztooltip/theme/dztooltip.css';

createGrid(host, { …, features: [dzTooltips({ tone: 'neutral', placement: 'top', animation: 'morph', header: true, html: true })] });
```

A column's `tooltip: { when: 'truncated', tone: 'warning', shape: 'pill' }` wins over these options. With
`@dzgrid/angular`, pass it in `[features]`. More: https://github.com/plinthworks/dztooltip#readme. MIT © Plinthworks.
