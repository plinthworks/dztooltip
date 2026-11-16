# @dztooltip/theme

DzTooltip's look: the plain tooltip, tones (`info`, `neutral`, `success`, `warning`, `danger`), arrows, shapes
(`bubble`, `ticket`, `pill`, your SVG path), CSS animations (`fade`, `scale`, `slide`, `pop`, `rise`, `morph`;
reduced motion respected) and the popover's surface. Plain CSS; every look a variable — `--tz-*` (the palette shared
with tzslot and DzGrid) and `--dzt-*`. No colour literal, logical sides only.

```ts
import '@dztooltip/theme/dztooltip.css';            // in the cascade layer dztooltip.theme
// or '@dztooltip/theme/dztooltip.unlayered.css', or @use '@dztooltip/theme/dztooltip.scss'
```

```css
:root { --dzt-tooltip-bg: var(--tz-fg); --dzt-tooltip-max-width: 24rem; --dzt-viewport-padding: 12px; }
```

The variables: https://github.com/plinthworks/dztooltip#readme. MIT © Plinthworks.
