# DzTooltip

Tooltips and popovers for any page — the same engine as DzGrid's bubbles, in its own packages.

- **`@dztooltip/core`** — placement (twelve sides and alignments, flip, shift, arrow), shapes, CSS animations
  (fade, scale, slide, pop, rise, morph), popovers that stay, rich content (text, a component, a template, cleaned HTML).
- **`@dztooltip/angular`** — `dzTooltip` and `dzPopover`.
- **`@dztooltip/theme`** — CSS variables (`--tz-*` shared with tzslot and DzGrid, `--dzt-*` own).
- **`@dztooltip/gsap`** — optional: richer GSAP animations (morphing shapes), only for apps that want them.
- **`@dztooltip/dzgrid`** — the bridge: `features: [dzTooltips({ … })]` in a DzGrid.

No runtime dependency in `core`. Being written: the code moves here from DzGrid 1.12's work.

MIT © Plinthworks
