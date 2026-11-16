# Changelog

## [1.0.0] - 2026-11-16

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
- Robust in the hard cases (owner 2026-11-16, « ★ partout »: the six gaps of `docs/audit-floating-ui.md`, sheet 25–30;
  Floating UI's public documentation for behaviour only) — the audit's score goes from 15 to 25 / 35:
  - **Never bigger than the room** (25): `--dzt-available-block-size` / `--dzt-available-inline-size` written on the
    bubble at each placement; a popover's body scrolls, a tall tooltip too (`data-overflow`); `--dzt-viewport-padding`
    (px; 8px with the theme, 0 without) keeps bubbles from the window's edges. A `maxWidth` is held to the room too.
  - **The side chosen** (26): the side asked, its opposite, then the two sides across; fitting nowhere, where the most
    is seen. An explicit `placement: 'auto'` takes the side with the most room (none given: below, as before).
  - **Following the anchor** (27): tooltips, popovers and the bridge's grid tooltips are placed again when the anchor
    grows, moves with no scroll (an `IntersectionObserver` fitted to it), the bubble grows or the window is resized —
    at most once a frame, only when what it was placed by changed, nothing watched while closed.
  - **The anchor gone** (28): the tooltip hides (the page's and a grid's) when its anchor leaves the page or is no
    longer drawn; the popover closes (`gone`), now also when its trigger is hidden. A non-element anchor no longer throws:
    `tooltip()` / `popover()` report a `TypeError` (`dztooltip: not-an-element`) and return a handle that does nothing.
  - **Delay groups** (29): `group` on `tooltip()` / `[dzTooltipGroup]` — by default the anchor's parent: the next
    tooltip of a toolbar shows at once in place of the first, and for 300 ms after it hid; a grid's header buttons are
    one group with `header: true` (its cells keep DzGrid's delay).
  - **Modal `<dialog>`** (30): a bubble opened from inside an open dialog goes into it (no longer inert); `root`
    (`tooltip()`, `popover()`, `[dzTooltipRoot]`, `[dzPopoverRoot]`) puts it elsewhere.
  - Browser checks: `scripts/browser.mjs` now runs here — the audit's evidence pages as a section of their own (« the
    hard cases », 12 runs: Chrome, Firefox, WebKit × light, dark × French, Arabic), and the whole matrix green; its page
    selector no longer catches the grid's bubble (19 checks had failed since the move for that reason).
- **Finished** (owner 2026-11-16, « je veux que tu finisses la lib bien comme il faut »: every partial and missing row
  of `docs/audit-floating-ui.md`, sheet 31–40; Floating UI's public documentation for behaviour only) — the audit's
  score goes from 25 to 35 / 35:
  - **`offset`** (31; `dzTooltipOffset`, `dzPopoverOffset`, the bridge): the gap (4 px by default, as before), or
    `{ mainAxis, crossAxis, alignmentAxis }` (logical: mirrored in right to left), or a function of the side tried and
    the sizes. Not a finite number: none; a throwing function: reported, none.
  - **`shift`** (32): `true` (the default, as before), `'attached'` (slides but never off its anchor: the arrow stays on
    it), `false` (never slides).
  - **An anchor in a shadow root** (33): a tooltip describes it through ARIA element reflection
    (`ariaDescribedByElements`), or `aria-description` where the browser has none; a popover's trigger gets
    `ariaControlsElements`, the popover its trigger's words as its name; a press on the trigger is no longer
    « outside »; Tab past the popover goes on after the shadow host; an open `<dialog>` around the host is found.
  - **An anchor in an iframe** (34): `root` may be an element of a page up the frames (same origin) — the bubble is
    made there and placed over the iframe (its border and padding counted), followed when either document scrolls or
    resizes; its words go in the anchor's `aria-description`. A `root` that cannot be reached is ignored.
  - **A safe triangle** (35): the pointer on its way from the anchor to a shown tooltip or hover card keeps it open
    (it goes when the pointer leaves that way, the window, or rests 400 ms on it short of the bubble).
  - **A modal popover** (36; `modal`, `initialFocus`, `returnFocus`; `dzPopoverModal`, `dzPopoverInitialFocus`,
    `dzPopoverReturnFocus`): `aria-modal`, the rest of the page `inert` (`aria-hidden` and focus guards where `inert`
    is missing), Tab wraps inside, a focus outside brought back, Escape anywhere and a press outside close it, the page
    given back before the focus returns; only the newest of two open modals keeps the focus; non-modal by default.
  - **A link broken over lines** (37): the bubble on the line piece hovered or clicked (the first from the keyboard).
  - **Virtual anchors** (38): `tooltip()` and `popover()` take `{ getBoundingClientRect(), getClientRects?(),
    contextElement? }` (a point, a chart's mark, a `Range` as it is; type `VirtualAnchor`), shown by code; an
    unreadable rectangle is reported once (`dztooltip: not-a-rect`), never thrown. `followCursor` (`true`, `'inline'`,
    `'block'`; `dzTooltipFollowCursor`) places a tooltip by the pointer and moves it once a frame. Line 28's refusal
    now covers only what is neither an element nor a virtual anchor.
  - **`everyFrame`** (39; `dzTooltipEveryFrame`, `dzPopoverEveryFrame`, the bridge): the anchor's box read at every frame
    while shown, for an anchor moved by an animation or a transform; stopped when it closes.
  - **A hover card** (40): `openOn: 'hover'` (`dzPopoverOpenOn="hover"`, with `delayMs` / `dzPopoverDelay`, 500, and
    `hideDelayMs` / `dzPopoverHideDelay`, 150): opened by the pointer resting or a keyboard focus, no focus moved, Tab
    from the trigger goes in, closed when the pointer leaves both (reason `leave`), on Escape, a press outside or the
    focus leaving; a click on its trigger is the trigger's own.
  - Each with tests written first (`finish-place.test.ts`, `finish-interact.test.ts`, the Angular inputs) and a
    browser check (`scripts/browser.mjs` section 13, « finished »: Chrome, Firefox, WebKit × light, dark × French,
    Arabic; `--section=finished` runs it alone). Its review (fresh eyes on the new code): two modal popovers open at
    once no longer fight for the focus, closing one keeps the page shut for the other, a modal opened from inside a
    modal shuts its parent, a virtual rectangle whose getter throws no longer escapes, the focus given back to a hover
    card's trigger no longer opens it again.
  - Sizes (minified, gzipped): `@dztooltip/core` 7.77 → 11.86 kB whole (`tooltip` alone 6.32 → 9.00, `popover` alone
    5.81 → 9.95); `@dztooltip/angular` 2.80 → 3.29 kB; the bridge 0.77 → 0.79 kB; the theme unchanged (3.07 kB).
- `@dztooltip/gsap` dropped (owner 2026-11-16).
- The 1.0.0 review (fresh eyes on `packages/`; each defect a test that failed first,
  `packages/core/test/review-1-0-0.test.ts`):
  - **Placed by the viewport less its scrollbars**: a fixed bubble's room is the root's client size, not the window's —
    with a classic scrollbar, a right-to-left bubble sat a scrollbar's width off its anchor and a bubble near the end
    could slide under the scrollbar.
  - **A popover destroyed while its closing runs** calls its content's `gone()` once (twice before, when the closing's
    animation ended: an Angular view destroyed twice); a destroyed popover or tooltip handle opens or shows nothing.
  - **Nothing of a destroyed tooltip kept**: the page's bubble let go of its options (an app's template or component
    and the view that made it), the waiting anchor and its delay group; hidden, the bubble goes back to the page's end,
    so a `<dialog>` (or a `root`) taken out later is not kept alive by it.
  - **No content never throws**: `content` missing or a function returning none (plain JavaScript) shows nothing; a
    number is its words.
  - `@dztooltip/angular` peers on Angular `^19 || ^20 || ^21 || ^22` (22 is current; as DzGrid); `@dztooltip/dzgrid` on
    `@dzgrid/dom` `^1.13.0` (published).
  - Checked and found fine: `safeHtml` against SVG / MathML namespaces and foreign content, `javascript:`, `style` and
    `url(`, entities, attribute case, `noscript`, `template`, foster parenting, DOM clobbering (kept as a guard test);
    shapes (path data only); Escape and the focus in nested popovers; observers, listeners, frames and timers taken
    down on hide and destroy (the page's, the popover's, the bridge's); a trigger removed while opening or closing;
    the Angular directives' destroy; messages carrying no content; logical sides and colours (the guards).
- Release tooling as DzGrid's: `npm run release:check` (pack, the built manifests — one version, peer ranges, `dist`
  only, no runtime dependency in core, README and LICENSE in each —, typings importing only published entries, every
  published entry compiled by ngc with strict templates and `skipLibCheck: false` on Angular 19 and 22, DzGrid from
  npm), `npm run publish:latest -- --otp=CODE` (core → theme → angular → dzgrid, what npm has skipped, then the
  registry asked), `npm run publish:verify`; `docs/release-1.0.0.md`. Each package has its README; the published
  manifests carry `repository`, `license`, `keywords`.
- Measured (minified, gzipped; before the hard cases → now): `@dztooltip/core` whole 6 337 → 7 820 B (`tooltip()`
  alone 4 786 → 6 365, `popover()` alone 4 650 → 5 877); the bridge with core 3 199 → 4 527; `@dztooltip/angular`
  2 751 → 2 858 over core and Angular; `dztooltip.css` 3 059 → 3 126 (unlayered 3 024 → 3 081). No size budgets yet.
