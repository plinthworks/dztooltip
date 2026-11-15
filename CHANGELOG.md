# Changelog

## Unreleased — 1.0.0

The tooltips and popovers written for DzGrid 1.12.0 (never published there) move to their own packages (owner,
2026-11-14, « ok partout »). Behaviour sheet: `docs/behaviors/tooltips-popovers.md` (its lines kept, names mapped).

- `@dztooltip/core`: `tooltip()`, `popover()`, `safeHtml` — placements, flip, tones, shapes, CSS animations including
  `morph`, the app's own `animate`, reduced motion, rich content, one tooltip on screen at a time, a pending show
  dropped by a press, Escape, a disabled anchor or a popover opening, the page's colour scheme. No dependency.
- `@dztooltip/angular`: `[dzTooltip]`, `[dzPopover]` (one entry; were `@dzgrid/angular/tooltip` and `/popover`).
- `@dztooltip/theme`: `dztooltip.css`, `dztooltip.unlayered.css`, `dztooltip.scss` — the variables renamed
  `--dzg-tooltip-*`, `--dzg-popover-*`, `--dzg-tip-*` → `--dzt-*` with their defaults; the plain tooltip's look now its
  own (`--dzt-tooltip-bg`, `-fg`, `-padding-*`, `-radius`, `-font-*`, `-max-width`), DzGrid's sheet no longer needed.
- `@dztooltip/dzgrid`: `dzTooltips(options)` — what DzGrid's `tooltips()` feature and its look settings did, through
  DzGrid 1.12's tooltip seam: the header buttons' names (`header`), cleaned HTML (`html: true`), placement, flip, tone,
  animation, shape, variables, width, the app's animation; a column's look over the bridge's options, a cell's over
  the column's. The grid's hide grace stays DzGrid's 150 ms (`hideDelayMs` is no longer a setting).
- Tests moved with the code (171, all green; the bridge's against DzGrid's sources beside this checkout) and a guard
  of the rules (logical sides, colours, HTML sinks). Browser checks moved (`scripts/browser.mjs`): wired, not yet run
  here; the Angular fixture's checks and a grid cell's `dzPopover` check wait for a fixture of this repository.
- The public API kept to what an app uses (owner: from 1.0.0 a semver matter): `tooltip`, `popover`, `safeHtml` and
  their option and handle types; `[dzTooltip]`, `[dzPopover]`; `dzTooltips` and its options. The engine's pieces sit in
  `@dztooltip/core/internal`, for this repository's packages only (no semver promise).
- `--dzt-shape-shadow` (owner 2026-11-15: an app's own `shape` had no shadow variable, the app needed a CSS rule): a
  `filter` value drawn around every shape — an app's SVG path (none by default) and the ready-made ones, over their
  `--dzt-tooltip-shape-shadow` (their soft shadow by default). Defaults unchanged.
- Measured (minified, gzipped): `@dztooltip/core` whole 6 363 B (`tooltip()` alone 4 792, `popover()` alone 4 652);
  the bridge with core 3 201; `@dztooltip/angular` 2 778 over core and Angular; `dztooltip.css` 3 047
  (unlayered 3 011). No size budgets yet.
