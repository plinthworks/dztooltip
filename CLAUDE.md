# DzTooltip — context for Claude Code

Tooltips and popovers for any page, written from scratch in TypeScript: a core with no dependency, Angular
directives, a theme of CSS variables, and the bridge that lets a DzGrid draw its tooltips with them. The code moved
here from DzGrid 1.12's work, before it was published there (owner, 2026-11-14). Sister projects, whose conventions we
follow: DzGrid (`/Users/nadou/Dev/dzgrid`), tzslot (`/Users/nadou/Dev/tzslot`), DzCalendar (`/Users/nadou/Dev/dzcalendar`).
Never copy anything from `/Users/nadou/Dev/dz-grid-migration/`.

**Read `CLEANROOM.md` before anything else.**

## Where things are

- `packages/core` — `@dztooltip/core`: `tooltip()`, `popover()`, `safeHtml`; the engine (`bubble.ts`: the bubble,
  `place()`; `engine.ts`: shapes, the app's animation, the awaited closing, one tooltip at a time; `float.ts`: the
  injected layout, the page's scheme). `./internal` is for this repository's packages only (no semver promise).
  No runtime dependency (the build refuses one).
- `packages/angular` — `@dztooltip/angular`: `[dzTooltip]`, `[dzPopover]` (signals, templates, components, HTML
  through Angular's sanitizer then `safeHtml`).
- `packages/theme` — `@dztooltip/theme`: `dztooltip.scss` is the source; `npm run build:theme` writes `dztooltip.css`
  (layer `dztooltip.theme`) and `dztooltip.unlayered.css`; a test fails when they drift.
- `packages/dzgrid` — `@dztooltip/dzgrid`: `dzTooltips(options)`, a DzGrid feature using DzGrid's tooltip seam
  (`FeatureHandle.tooltips`, DzGrid 1.12.0: its `docs/behaviors/tooltips.md` 13). Its types are structural (no import of
  DzGrid); `packages/dzgrid/test/fits-dzgrid.ts` checks they fit DzGrid's own.
- No `@dztooltip/gsap` package: dropped by the owner (2026-11-16, the morph abandoned); an app drives GSAP itself through the `animate` hook.
- `docs/behaviors/tooltips-popovers.md` — the behaviour sheet (written before the code); `docs/plan/` — the plan.

## Commands

```bash
npm test            # vitest; the bridge's grid tests run against ../dzgrid's sources (DZGRID_SRC), skipped without
npm run test:ci     # one worker — catches state shared between files
npm run typecheck   # core, the bridge, the tests, Angular (ngc, strict templates), the bridge against DzGrid's types
npm run build       # packages/*/dist; refuses a manifest pointing at src/ and a runtime dependency in core
npm run pack:local  # tarballs into packed/
npm run test:browser  # real browsers (playwright-core, Chrome, Firefox, WebKit), one at a time — wired, see its header
```

`npm install` needs `legacy-peer-deps` (set in `.npmrc`).

## Working rules (inherited from DzGrid)

- **Clean room** (`CLEANROOM.md`): behaviour from public documentation only, in our own words, in the sheet first.
- **Validate structural decisions with the owner before coding.** Talk to the owner in French, short and plain.
- Every change: a test that fails first, then the fix. Test expectations are written by hand, never copied from the
  output. A test's `as never` / `as any` carries a comment saying why.
- Bad input never throws: it becomes a `Problem` (code + path + raw detail) or is reported (`reportError`) — never
  with the app's data in it (a tooltip may hold health records).
- Logical sides only (`start`/`end`, `inline-*`, `block-*`), never left/right outside `dir.ts`. Right to left is
  designed in, not added. `packages/core/test/guards.test.ts` holds the sources and the theme to it.
- Colours only as CSS variables (`--tz-*` the shared palette, `--dzt-*` our own); no colour literal in code or SCSS.
- HTML only through `safeHtml` (`parseFromString` in `html.ts` only, an inert document, rebuilt from a fixed list).
- Sizes and timings measured, never asserted: minified and gzipped, on a quiet machine. jsdom checks behaviour, never
  layout: look at it in real browsers.
- Verify before saying done. Spend little: small fixes directly, browsers one at a time, closed in `finally`.
- Commit or publish only when the owner asks; the owner publishes.
