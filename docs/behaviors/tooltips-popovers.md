# Tooltips and popovers

**Moved from DzGrid (owner 2026-11-14, « ok partout »).** Written for DzGrid 1.12.0, never published there; the lines
keep their numbers. Names since the move: `@dzgrid/dom/tooltip` and `/popover` → `@dztooltip/core` (`tooltip()`,
`popover()`, `safeHtml`); `@dzgrid/angular/tooltip` and `/popover` → `@dztooltip/angular`; `@dzgrid/theme/tooltips.css`
→ `@dztooltip/theme` (`dztooltip.css`); the grid feature `tooltips()` → the bridge `dzTooltips()` of `@dztooltip/dzgrid`,
whose options take the look the grid's `tooltips` setting held (`tone`, `animation`, `reducedMotion`, `animate`,
`placement`, `flip`, `shape`, `style`, `maxWidth`; `header`; `html: true` for `html: safeHtml`) — the grid keeps
`delayMs` and `cells`, and a column's `tooltip` and `headerTooltip` (DzGrid's `tooltips.md` 10–13: their words, `when`,
`content`, `delayMs`, and the seam the bridge uses). Classes and variables: `dzg-tooltip` / `dzg-popover` / `dzg-float`
→ `dzt-*` (a grid's bubble takes `dzt-tooltip` once the bridge shows it), `--dzg-tooltip-*`, `--dzg-popover-*`,
`--dzg-tip-*` → `--dzt-*`, defaults kept. The grid's grace before hiding (`hideDelayMs`) stayed 150 ms, not a setting.


Owner 2026-11-13: « là où on souhaite activer l'infobulle, on pourra le faire », « travaille bien l'animation et la
possibilité d'afficher tout ce qu'on veut ». Sources: WAI-ARIA Authoring Practices (tooltip pattern, disclosure and
non-modal dialog), WCAG 2.2 (1.4.13 content on hover or focus, 2.3.3 animation from interactions, 2.4.3 focus order),
the HTML `popover` attribute, CSS `@starting-style` and `transition-behavior`. Behaviour of other libraries from their
public pages only (CLEANROOM.md). For positioning, Floating UI's public documentation (MIT; owner 2026-11-14, « s'inspirer
sans copier ») was read as a reference for the concepts and their edge cases — placements, offset, flip, shift, arrow,
size, following on scroll and resize, hiding a clipped anchor; no line of its code was read, copied or translated, and
nothing of it is a dependency. Plan and API: `docs/plan/tooltips-plan.md`. The grid's own tooltip
(`tooltips.md`) keeps every rule written there; this sheet adds to it.

## What the user does
Rests the pointer on something (a cell, a header, a header's button, a button anywhere in the page) or reaches it with
the keyboard; clicks a control that opens a bubble that stays (a popover); presses Escape, clicks elsewhere, tabs away.

## What they observe

### Tooltips
1. Only where the application asked for one. In the grid: a column's `tooltip` (cells) and `headerTooltip` (its
   header) as before; the header's buttons (filter, column menu, floating filter toggle) show their name when the grid
   says `tooltips: { header: true }` with the `tooltips()` feature — off by default. A column's sort is its header itself: the header's tooltip is the
   column's `headerTooltip`. `tooltips: { cells: false }` silences every column's `tooltip` at once (a failed save's
   reason is the grid's own message and still shows). Anywhere in the page: an element given a tooltip by the
   application (`tooltip(el, …)` in the DOM layer, `dzTooltip` in Angular).
2. Hover: it appears after a delay (`delayMs`, 500 by default); keyboard focus (a focus that follows a key): at once.
   A click's focus shows nothing. It is never shown on touch alone (no hover there): a tap does not open it.
3. The pointer can move onto it (WCAG 1.4.13 « hoverable »); it goes when the pointer leaves both, after a short grace
   (`hideDelayMs`, 150 by default). Escape dismisses it without moving the focus (« dismissable »); it stays until then
   (« persistent »). One tooltip on screen at a time in a page: showing another hides the first (the page's tooltips,
   and a grid's with `tooltips()`).
4. It never covers its anchor. It opens where the application places it (owner 2026-11-14, « à droite, à gauche, en
   haut, en bas… »): `placement` is a side — `top`, `bottom`, `start`, `end` (the line's start and end: mirrored in
   Arabic) or `left`, `right` (the screen's, whatever the direction: resolved by the direction module into the line's
   start or end) — optionally followed by `-start` or `-end` to line its start or end up with the anchor's along the
   other axis (for `top` / `bottom` the line's start and end; for the inline sides, the top and the bottom); without it
   the bubble is centred on its anchor: 12 placements, and `auto` — below, the grid's at its cell's start (1.11's place),
   a page's centred (an explicit `'auto'`: the side with the most room, 26). When the window has no room on that side it
   tries the opposite one, then the sides across (26; `flip: false` keeps the side asked); along the other axis it
   slides to stay inside the window, `--dzt-viewport-padding` from its edges; it is never bigger than the room (25). An arrow points at the anchor's
   middle, kept 12 px inside the bubble's corners; it follows the flip. `data-side` tells the side it opened on, in
   logical terms. In the grid the placement (grid-wide, or a column's `{ placement }`) needs `tooltips()`.
5. It is not interactive: the pointer may rest on it, but nothing in it is meant to be focused or clicked (the
   application's content is not checked: a control there is the application's mistake); a bubble meant to be clicked
   is a popover.
6. Tones say what kind of message it is: `info` (today's dark bubble, the default), `neutral` (a raised surface with an
   edge), `success`, `warning`, `danger` — each a background, a text colour, an edge and an arrow colour as variables,
   readable in light and dark (text 4.5:1, checked by `check:contrast`). The tone is never the only sign: the words
   say it; a forced-colours display draws every tone in the system's colours with a visible edge.
7. Animation (opening and closing, set per grid, per tooltip, or for the page by variables): `fade` (the default),
   `scale` (from 96 % with a fade, from the arrow's side), `slide` (a few pixels from the anchor's side: below → moves
   down into place, above → up, after → toward the end; it follows the flip and the reading direction), `none`; and two
   richer presets, opt-in (owner 2026-11-14, « à activer si le client la veut »): `pop` (grows from 80 % with a slight
   overshoot, 260 ms) and `rise` (12 px from the anchor's side with a long, soft deceleration, 320 ms). Every preset
   closes the same short way (100 ms).
   A third opt-in preset, `morph` (owner 2026-11-14, « ok »): the bubble opens as a small pill at its anchor's side
   (60 % of its width, 45 % of its height, at the arrow, the arrow already there) and grows into its full shape, then its
   content fades in from the shape's first third (a part's elements also rise a few pixels); it closes the reverse way,
   faster (the content first, then the shape back to the pill, fading). 320 ms to open the shape (GSAP's `power3.out`
   as a curve), the content over 200 ms from 120 ms; 180 ms to close — each a variable (`--dzg-tooltip-morph-duration`, `-easing`, `-content-duration`, `-content-delay`,
   `-close-duration`). It follows the side it opened on (after a flip too) and the reading direction. Pure CSS: the
   shape is a layer under the content whose `clip-path` grows (paint only, no layout per frame); no library.
   As quick as an app's GSAP one (owner 2026-11-14 « pas aussi fluide que GSAP, elle prend du temps pour s'afficher »,
   measured side by side): its first frame is the one after its delay — it opens one frame ahead (16 ms), and the
   bubble is dressed (preset, shape, variables) before it is shown, so the browser starts the right opening; the pill's
   corners ease into the bubble's (no snap at the end). Its delay is the grid's `tooltips.delayMs` (500 ms by default,
   as a page tooltip's `delayMs`), a column's `delayMs` over it.
   Only `opacity` and `transform` move (no layout during the animation; no read of the layout per frame). Duration,
   easing and delay of the opening and of the closing are variables. A tooltip moving straight from one anchor to the
   next does not close and reopen: it jumps.
8. Reduced motion (`prefers-reduced-motion: reduce`) or a grid with `motion: false`: no animation at all, opening and
   closing are instant — the grid's rule since Phase 5 (`motion.md`: « nothing moves, nothing fades »). An application
   may ask instead for a short fade under reduced motion (`reducedMotion: 'fade'`, opacity only, 120 ms: nothing moves
   or grows); `none` is the default. A grid with `motion: false` stays instant. The app's own animation is told it is
   asked to reduce motion and decides (below).
9. Content: words (a column's text, `{ text, tone }`), or anything the application draws — a part / an Angular
   component or `<ng-template>` (a small table, an icon and a title), or HTML given as text **only** when the application
   opted in, cleaned first (below). A screen reader hears the content's text through `aria-describedby` on the anchor
   while it is shown (the header buttons' name tooltips excepted: they are the name already, not read twice).

### Ready-made shapes (owner 2026-11-14, « ok »)
20. `shape: 'bubble' | 'ticket' | 'pill'` beside an app's SVG path (below): `bubble` — a soft speech bubble, rounder
    corners, its point a curved tail that is part of its outline (no seam, one shadow around both), mirrored for each
    side and in right to left; `ticket` — its four corners notched (round bites); `pill` — fully rounded ends, the arrow
    kept. Drawn by `@dzgrid/theme/tooltips.css` (no SVG, no script): colours from the tone; the edge (a tone with one)
    and a soft shadow drawn around the whole outline, tail and notches included (`--dzg-tooltip-shape-shadow`; sizes
    `--dzg-tooltip-bubble-radius`, `--dzg-tooltip-bubble-tail`, `--dzg-tooltip-ticket-notch`,
    `--dzg-tooltip-pill-padding`). The arrow is hidden only where the shape carries its own point (`bubble`). Each works
    with every animation, `morph` included. Without the sheet: today's box.

### Per column, per cell (owner 2026-11-14: « toutes les situations par colonne… des variables simples ou un ajout très simple »)
21. A column's `tooltip` says it in one line, with `tooltips()`:
    - `tooltip: true` — the cell's text **as displayed** (formatted dates, numbers, translated values), always;
    - `tooltip: { when: 'truncated' }` — the same, only on cells whose text is cut (ellipsis); the grid-wide
      `tooltips: { cells: 'truncated' }` gives that to every column that says nothing;
    - `tooltip: false` — none for this column, whatever the grid says;
    - `tooltip: { text, tone, shape, animation, placement, delayMs, maxWidth, style, when }` — fixed options for the
      column; `text` left out means the cell's displayed text;
    - `tooltip: (value, row) => string | spec | null` — per cell, as before; or `tooltip: { …options, content: (value,
      row) => … }`, the cell's answer laid over the column's options.
    Merge: the grid's `tooltips` ← the column's object ← the cell's answer (an option the cell leaves out keeps the
    column's, then the grid's). The same names everywhere: `tooltips` (grid), a column's `tooltip`, `tooltip()` /
    `dzTooltip` (page, which also take `when: 'truncated'`). Keyboard focus on the cell opens it at once, like any cell
    tooltip; hover after its `delayMs`.
22. `headerTooltip` takes a string or the same spec object (`{ text, tone, shape, animation, placement, … }`): the text
    and tone work without `tooltips()`, the rest with it.
23. A column's own look goes through variables only: `style: { '--dzg-tooltip-info-bg': …, '--dzg-tooltip-radius': … }`
    — only custom properties (`--…`) are written on the bubble while it shows this column's tooltip; anything else is
    ignored. `maxWidth` (a number of px or a CSS length) caps its width.
24. Without `tooltips()`: a column's `tooltip` function and `headerTooltip` work as before (text and tone); `true`, an
    object, `tooltips.cells: 'truncated'`, `style` and `maxWidth` are told once (`missing-feature`, path
    `columns[i].tooltip` or `settings.tooltips`, detail `tooltips`), and nothing shows for them.

### Popovers (the bubble that stays)
10. Opened by a click on its trigger (or a key that clicks it: Enter, Space), or by the application's code; a second
    click on the trigger closes it. Closed by Escape (the focus goes back to the trigger), by a pointer press outside it
    and its trigger (the focus stays where that press puts it), by the focus leaving it for something outside (Tab past
    its last control), and by code.
11. The focus moves into it when it has something focusable (its first control, or the element marked `autofocus`);
    otherwise it stays on the trigger. On close by Escape or by code while the focus was inside, the focus returns to
    the trigger. Tab inside it goes through its controls in order; it is not modal (no trap): Tab past the last control
    closes it and moves on to what follows its trigger in the page, Shift+Tab before the first goes back to the trigger
    (the bubble sits at the page's end, in the top layer: the page's order is kept as if it followed its trigger).
12. The trigger says it: `aria-haspopup="dialog"`, `aria-expanded` true / false, `aria-controls` the popover's id. The
    popover is `role="dialog"` with an accessible name (`label`, or the trigger's own name), not modal.
13. Placed by the same rules as the tooltip (4), arrow included, in the browser's top layer (nothing of the page clips
    it); it stays by its trigger when the page or a scroll container scrolls, the window resizes or its own content
    changes size (placed again at the next frame); it closes when the trigger leaves the page, scrolls out of the
    window or out of a scrolling box around it (clipped there), or — inside a grid — when the trigger's row is
    recycled to show another row (its `aria-rowindex` changed). A tall content scrolls inside it (its body is capped
    at the window's height less 32 px, `--dzg-popover-max-height`), its arrow outside that body, never clipped. The
    arrow stays 12 px inside the bubble's corners (the default radius, 6 px, plus half the arrow): a radius over 6 px
    wants a smaller arrow. The window's edges are padded by `--dzt-viewport-padding` (25; 0 without the theme: a bubble may touch them, as
    1.12.0's tooltip did). It also follows its trigger when it moves or grows with no scroll (27).
14. One open at a time in a group (`group`, `'default'` unless given): opening one closes the others of its group,
    except one it is nested in (a popover opened from inside another keeps its parent open). A tooltip shown while a
    popover is open stays possible (on another element); the popover's trigger shows no tooltip while it is open.
15. It can hold anything: a component, a template, a form, even a DzGrid grid. Same tones and animations as the tooltip;
    its default look is the raised surface with an edge and a shadow (`--dzg-popover-*`).

### HTML content (opt-in)
16. HTML is shown only when the application says so: in the grid `tooltips: { html: safeHtml }` (the cleaner imported
    from `@dzgrid/dom/tooltip`, so the grid's base never carries it), a column's `tooltip` returning `{ html }`; in the
    page `content: { html }`; in Angular `[dzTooltip]="{ html }"`, first through Angular's `DomSanitizer`, then ours.
    Without the opt-in a column's `{ html }` shows its `text` if it has one, otherwise nothing — never the raw markup
    (no problem is told: it would cost the base what it cannot spare, plan Q-T1).
17. Cleaning keeps text and a fixed list of harmless elements (`b strong i em u s small mark sub sup code kbd br p span
    div ul ol li dl dt dd table thead tbody tr th td hr h1…h6 abbr time`) with a fixed list of attributes (`class`,
    `lang`, `dir`, `title`, `colspan`, `rowspan`, `datetime`); everything else is dropped with its content when it can
    run or load (`script style iframe object embed link meta img svg math template form input button a video audio
    source`), unwrapped otherwise. No event attribute, no `style`, no URL of any kind survives (so no `javascript:` and
    no external load). Parsed in an inert document (nothing loads or runs while parsing). Its risk, documented: the
    application decides what text reaches it; cleaning stops scripts and loads, not misleading words.

### A show still waiting, and the page's colour scheme (owner 2026-11-14, « oui », in 1.12.0)
18. **A tooltip waiting for its delay never appears late.** Its show is dropped by a press (`pointerdown`) or a click on
    its anchor, Escape, the focus leaving its anchor (in a grid: the focus leaving a cell or the grid), a scroll,
    `disabled: true` (`update()`, Angular's `dzTooltipDisabled`), `destroy()`, and a popover opening from its anchor or
    from inside it (a grid cell holding the popover's trigger). When the delay ends it is also dropped if its anchor has
    left the page, is `:disabled`, or is (or holds) the trigger of an open popover (`aria-controls` naming it) — so a
    tooltip never appears over its own popover. A tooltip already shown: the page's goes on a press, a click, Escape,
    the focus leaving, a scroll and `disabled: true` (as before); the page's and the grid's go when a popover opens from
    their anchor or inside it. A grid's shown cell tooltip still stays on a press (tooltips.md). A shown tooltip whose
    anchor only turns `disabled` by its attribute stays until the pointer or the focus leaves it (nothing watches the
    attribute); one whose anchor leaves the page or stops being drawn goes at the next frame (28; before 1.0.0: with `destroy()`), the grid's
    too.
19. **Tooltips and popovers follow the colour scheme of their anchor's context, as the grid does.** The bubble takes
    `color-scheme: var(--tz-color-scheme, light dark)` (in the layout injected with `tooltip()` / `popover()`: the
    layered and unlayered sheets alike), so its `light-dark()` colours (the palette's `--tz-*`) and the system colours
    resolve as the grid's. It sits at the page's end and in the top layer, so it inherits the page's scheme (`:root`,
    `body`: `data-theme`, Tailwind's `.dark` mapped by `tailwind.css` / `tailwind3.css`) — a page switching while a
    bubble is open is followed at once; when its anchor's context says another (a `data-theme` or a class on a wrapper,
    a grid's host), the bubble takes that `--tz-color-scheme` at each opening (a wrapper switching while it is open:
    at its next opening). An app's own dark class is mapped once: `.my-dark { --tz-color-scheme: dark }` (and
    `:root:not(.my-dark) { --tz-color-scheme: light }` to force light). The page's `color-scheme` property alone is not
    read (the grid does not read it either: without `--tz-color-scheme`, both follow the system).

### Robust in the hard cases (owner 2026-11-16, « ★ partout »: the audit's six gaps closed before 1.0.0)
Behaviour from Floating UI's public documentation only (size, flip, autoPlacement, autoUpdate, FloatingDelayGroup,
FloatingPortal), in our words; `docs/audit-floating-ui.md` holds the evidence pages these lines answer.

25. **Never bigger than the room (size).** Once its side is chosen the bubble is told the room it has there: on its
    side, from the gap by its anchor to the window's edge; across, the window's width (or height) — each less the
    padding to the window's edges. It never grows past that room: a popover's body scrolls inside (its arrow outside,
    never clipped); a tooltip taller than its room scrolls itself (`data-overflow`; its arrow is then clipped — a tooltip
    that tall wants to be a popover). The room is written on the bubble as `--dzt-available-block-size` and
    `--dzt-available-inline-size` (px, for an app's CSS too; a popover's body gets its own block room, the bubble's
    padding and edge taken off). `--dzt-viewport-padding` (px; 0 without the theme, `8px` with it) keeps the bubble that
    far from the window's edges: in the room, in the slide along the other axis and in the choice of a side. The
    window here is the viewport less its scrollbars (review 1.0.0): a fixed bubble's end edge is the scrollbar's, so a
    bubble never slides under it and a right-to-left one is measured from it.
26. **The side chosen (flip, auto).** The side asked when the bubble fits there whole; otherwise its opposite; otherwise
    the two sides across (asked above or below: the line's end, then its start; asked at the start or the end: below,
    then above) — the first where it fits whole. When it fits nowhere: the side where the most of it can be seen once
    its size is held to the room (the side asked first on a tie). `flip: false` keeps the side asked (its size still held
    to the room). `placement: 'auto'` picks, among the sides where it fits, the one with the most room left around it
    (below, above, the line's end, its start on a tie); none fits: as above. No placement given stays below (a grid's at
    its cell's start) with the fallbacks above — a popover of 524 px no longer opens 140 px off screen while the room is
    on its right.
27. **Following the anchor (autoUpdate).** While a tooltip or a popover is on screen it is placed again, at most once
    per frame, when its anchor changes size, the bubble changes size, the anchor moves with no scroll (a column widened,
    a panel folded: an `IntersectionObserver` fitted to the anchor's box, fitted again after each placement), the window
    is resized, a box around it scrolls (a popover; a page tooltip still hides on a scroll, 18), or nodes are added to
    or taken from the page. Nothing is watched while it is closed: the observers are made when it shows and taken down
    when it closes.
28. **The anchor gone.** Checked at the same frames: a tooltip whose anchor left the page or is no longer drawn
    (`display: none` on it or around it, `visibility: hidden`) hides — the page's with its closing, a grid's through the
    grid's own hide; a popover closes (`gone`), now also when its trigger is no longer drawn. An anchor that is neither an
    element nor a virtual anchor (38) is refused without throwing: `tooltip()` and `popover()` give back a handle that
    does nothing and report one error (`reportError`, a `TypeError` whose message starts `dztooltip: not-an-element`
    and names the argument, `tooltip(el)` or `popover(trigger)` — nothing of the value itself).
29. **Delay groups (a toolbar).** A tooltip on screen makes its group warm: resting on another anchor of the same group
    shows that one's tooltip at once, in place of the first (it jumps, 7: no closing and opening between) — while a
    tooltip of the group is on screen, and for 300 ms after it hid. The group (owner A, automatic): the anchor's parent by
    default (the buttons of one toolbar), `group: 'name'` for anchors anywhere that share a name, `group: false` for an
    anchor that always waits its own delay. A keyboard focus shows at once anyway (2). With the bridge and `header:
    true`, a grid's header buttons are one group; the grid's cell and header tooltips keep the grid's delay (DzGrid
    decides when they show).
30. **Inside a modal `<dialog>` (FloatingPortal).** A bubble opened from an anchor inside an open `<dialog>` is put in
    that dialog (its last child) rather than at the page's end, so a modal dialog does not make it inert: a popover's
    fields take clicks and the focus, a tooltip can be hovered. It is still shown in the top layer, above the dialog.
    `root: element` (`tooltip()`, `popover()`, `[dzTooltipRoot]`, `[dzPopoverRoot]`) puts it in that element instead (an
    app's own modal layer).

### Finished (owner 2026-11-16, « je veux que tu finisses la lib bien comme il faut »: every partial and missing row of the audit)
Behaviour from Floating UI's public documentation only (offset, shift and limitShift, inline, virtual elements,
useClientPoint, autoUpdate's animationFrame, safePolygon, FloatingFocusManager, useHover), from WAI-ARIA's dialog
pattern and from the HTML `inert` attribute and ARIA element reflection, in our words.

31. **The gap and a slide of the app's (offset).** `offset` on `tooltip()`, `popover()`, the bridge and the directives
    (`dzTooltipOffset`, `dzPopoverOffset`): a number is the gap between the anchor and the tip of the arrow (4 px when
    none is given, as before; negative: the bubble overlaps its anchor); an object `{ mainAxis, crossAxis,
    alignmentAxis }` adds a slide along the other axis — `crossAxis` towards the line's end (a bubble above or below)
    or towards the block's end (a bubble at the start or the end), so right to left mirrors it; `alignmentAxis`, only
    for an aligned placement (`-start`, `-end`), replaces `crossAxis` and slides inwards from the edge it is aligned
    on. A function is asked at each placement, for each side tried, with `{ side, align, anchor, bubble }` (sizes as
    `inlineSize`, `blockSize`) and answers a number or the object. A value that is not a finite number counts as
    none; a function that throws is reported and counts as none. The room (25) and the side chosen (26) use the gap.
32. **Sliding, and how far (shift).** `shift: true` (the default, as before) slides the bubble along the other axis to
    keep it in the window; `shift: 'attached'` slides it too but never so far that it leaves its anchor: at least 12
    px of the bubble past its corner stays beside the anchor, so the arrow still points at it — near a window's edge
    with the anchor half off screen, the bubble follows the anchor out rather than detach from it; `shift: false`
    never slides (aligned as asked, even past the window's edge). The arrow keeps pointing at the anchor's middle,
    held 12 px from the bubble's corners.
33. **An anchor inside a shadow root.** The bubble still goes to the page's end (the page's stylesheets reach it),
    and what links them crosses the shadow boundary: a tooltip describes its anchor through ARIA element reflection
    (`ariaDescribedByElements`, the anchor's own descriptions kept) where the browser has it and the bubble's tree is
    an ancestor of the anchor's; otherwise its words are the anchor's `aria-description` while it shows. A popover's
    trigger gets `ariaControlsElements` the same way (nothing where it is missing: `aria-expanded` still says it);
    the popover is named by its `label`, or by the trigger's `aria-label` or words (an id cannot reach into the
    shadow root). A press on the trigger inside the shadow root is not « outside », and Tab past the popover's end
    goes on after the shadow host. Nothing is added or left behind once it closes.
34. **An anchor inside an iframe.** `root` may be an element of another document of the same origin up the frames
    (the page holding the iframe: `root: parent.document.body`): the bubble is then made in that document and placed
    over the iframe, by the anchor's box moved by each frame's place (its border and padding counted), so a small
    iframe no longer traps it. Followed while shown: a scroll or a resize in either document, the anchor's size. The
    two documents cannot share ids: the tooltip's words go in the anchor's `aria-description`; a popover's trigger
    keeps `aria-expanded`; presses outside are heard in both documents. A `root` that cannot be reached (another
    origin, not up the frames) is ignored: the bubble stays in the anchor's document, as without it. The iframe taken
    out of the page while the bubble shows: the anchor is gone (28) — the tooltip hides, the popover closes.
35. **The way to the bubble (safe triangle).** When the pointer leaves the anchor of a shown tooltip or hover card
    (40) towards the bubble, the bubble stays while the pointer is in the region between the point where it left and
    the bubble (the smallest shape holding that point and the bubble's box, a few pixels wider): a diagonal path to the
    bubble's far corner no longer closes it. It goes (after its grace, `hideDelayMs`) when the pointer leaves that
    region, leaves the window, or rests in it without reaching the bubble for 400 ms; reaching the bubble or the
    anchor ends the region (the usual rules hold there). Nothing is listened to once it ends.
36. **A modal popover (focus management).** `modal: true` (`dzPopoverModal`) makes the popover a modal dialog: the
    bubble says `aria-modal="true"`; everything else in the page is made `inert` while it is open (the elements
    beside the path from the bubble to the page, other DzTooltip bubbles excepted; what the page had already made
    inert is left as it was), with `aria-hidden="true"` and two focus guards (empty focusable ends of the bubble that
    send the focus back in) where a browser has no `inert`; Tab and Shift+Tab wrap inside it (only over controls that
    are drawn and not inert; from a static element given the focus, the browser's own move while a control lies on the
    way — in any popover); a focus that lands
    outside is brought back; the focus leaving does not close it. Escape always closes it (anywhere in the page),
    a press outside too, and closing gives everything back before the focus returns. `initialFocus` says where the
    focus goes when it opens: an element, a function given the bubble that returns one, or `false` (none moved: the
    focus stays where it was — for a modal, the bubble itself takes it); by default the element marked `autofocus`,
    else the first control, else (modal) the bubble. `returnFocus` says where it goes back: `true` (the default) the
    trigger — for a non-modal popover only when it closes by Escape, the trigger or code with the focus inside, as
    before; for a modal one on every close —, an element instead of the trigger, or `false` (never moved). Not modal
    (the default): as before. A hover card (40) is never modal.
37. **A link broken over lines (inline).** An anchor whose box breaks over lines (an inline link, a text selection)
    is placed by one of its line pieces, not by the box around them all: the piece under the pointer that opened it
    (hover, a click), else the nearest to it; opened by the keyboard or by code, the first piece (the line where it
    starts). Pieces on one line count as one. An anchor in one piece is placed as before.
38. **Virtual anchors.** `tooltip()` and `popover()` take, besides an element, any object with a
    `getBoundingClientRect()` (a rectangle in the window: a cursor's point, a chart's mark, a `Range` of selected
    text as it is) and an optional `contextElement` (the element it belongs to: its document, its dialog, its
    direction and scheme, and « gone » when it leaves the page; a `Range`'s own container when none is given); with a
    `getClientRects()` its pieces count (37). It has no events: shown and hidden by code (`show()`, `hide()`;
    `open()`, `close()`); Escape, a scroll (tooltip), a press outside (popover) and the rules of 27 and 28 still hold;
    a rectangle that changes is followed when `everyFrame` (39) is set, or placed again by `show()` / `reposition()`.
    No element is described by a virtual tooltip, no trigger carries a virtual popover's ARIA (its `label` names it);
    a virtual popover gives the focus back to the element that had it before it opened. A `getBoundingClientRect` that
    throws or answers something that is not a rectangle is reported and the bubble is hidden, never a throw. **Following
    the cursor** (`followCursor`, `dzTooltipFollowCursor`): a tooltip placed by the pointer's point over its anchor
    rather than the anchor's box, moved with the pointer at most once a frame — `true` both ways, `'inline'` along the
    line only (the block from the anchor), `'block'` the other way; a keyboard focus places it by the anchor.
39. **An animated anchor (every frame).** `everyFrame: true` (`dzTooltipEveryFrame`, `dzPopoverEveryFrame`, the bridge)
    checks the anchor's box at every frame while the bubble is on screen and places it again when it moved — for an
    anchor moved by a CSS animation or a transform, which the observers see late or not at all (measured 2026-11-16:
    Chrome follows a moving transform a step behind without it). One box read per frame; placed only when
    it changed; the frames stop when the bubble closes (nothing runs while it is closed).
40. **A hover card.** `openOn: 'hover'` (`dzPopoverOpenOn="hover"`): a popover that opens when the pointer rests on its
    trigger (`delayMs`, 500 by default; never on touch alone) or at once on a keyboard focus, and goes when the pointer
    leaves the trigger and the card (`hideDelayMs`, 150 by default; the safe triangle 35 between them; not while the
    focus is inside it), on Escape, a press outside, or the focus leaving both. Opening it moves no focus (the trigger
    keeps it); Tab from the trigger goes into the card's first control, and on past its end as for any popover. A click
    on the trigger is its own (a link follows it): it does not toggle the card. Its close reason when the pointer
    leaves is `leave`. The pattern, documented: the card adds to what the trigger already says and does (a link's
    preview, a person's details) — nothing only it holds, since touch and screen reader users may never open it.

## What DzGrid does
- **One implementation, the weight opt-in** (owner Q-T1 B, 2026-11-14): the base (`render/tooltip.ts`) places (one
  `place()`: 4 sides, 3 alignments, flip, the arrow), shows with its tone, CSS preset and reduced-motion mark, and
  hides at once; its seams (`at`, `close`, `onShow`) take the rest from the opt-in entries' shared engine
  (`tooltip/engine.ts`): placements, the app's `animate`, a closing that waits for the end of the fade (a part, a
  template or HTML stays drawn while it fades), one tooltip at a time. The grid gets it through the feature
  `tooltips()` (`@dzgrid/dom/tooltip`); without it `tooltips.header`, `.animate` or `.placement` are told once
  (`missing-feature`, path `settings.tooltips`, detail `tooltips`) and the base's behaviour stays. The page's
  `tooltip()` and `popover()` (`@dzgrid/dom/tooltip`, `@dzgrid/dom/popover`) always have it, Angular's directives too
  (`@dzgrid/angular/tooltip`, `@dzgrid/angular/popover`). The tones, the four-sided arrow, the animations and the
  popover's look are the opt-in sheet `@dzgrid/theme/tooltips.css` (with its unlayered copy). Without that sheet a
  tooltip looks as in 1.12.0 and appears without animation.
- **Today's apps unchanged**: `tooltips: { delayMs }`, a column's `tooltip` returning a string or null, `headerTooltip`
  and a `tooltip` part behave as in 1.11; `data-side` keeps its two values for the grid's tooltip (it opens below or
  above its cell).
- **Animation design**: CSS transitions on `opacity` and `transform` from `@starting-style`, with `display` and
  `overlay` transitioned discretely so a closing bubble stays drawn (and in the top layer) until its fade ends — the
  JavaScript only sets and clears `hidden`; nothing is measured during the animation (the closing's end is the bubble's
  own `getAnimations()` settling). `data-animation` on the bubble
  picks the preset. An application's own animation (owner 2026-11-14, « CSS normal, ou GSAP pour du morphing »):
  `animate(el, phase, info)` (`phase` `'open'` | `'close'`; `info` `{ side, tone, dir, reduced, shape }`) is called after
  the bubble is placed and before it is hidden; while it is given the CSS presets are off (`data-animation="custom"`),
  and a closing bubble is hidden when the promise (or thenable — WAAPI's `finished`, a GSAP tween or timeline) it
  returns settles, at once if it returns nothing or throws (the throw is reported). Under reduced motion it is still
  called, told `reduced: true` (the app gives an instant or a fade-only version); on a grid with `motion: false`, never.
  Shown again while its closing runs, it is told `open` again (the app stops its closing there); the late settling is
  ignored. DzGrid never depends on GSAP: the presets are CSS; GSAP is the app's choice.
- **Shapes and morph in CSS** (20, 7): a named shape is `data-shape="bubble|ticket|pill"` on the bubble; the bubble's
  tail is the arrow's own pseudo-element given a curved outline (a square across the edge, turned to the side); the
  ticket's notches are its background (four radial gradients, `--dzg-tip-fill`); the edge and shadow are `filter:
  drop-shadow()`s, so they follow the outline. `morph` paints the bubble's fill in a layer under its content (the
  tooltip's `::after`, the popover's `::before`) whose `clip-path` runs from the pill (`--dzg-tip-pill`) to the whole
  box; the content's colour (and a part's elements' opacity and position) follow. Under reduced motion, nothing moves
  (8), `reducedMotion: 'fade'` a fade.
- **An app's shape** (for morphing): `shape`, SVG path data in a 100 × 100 box stretched over the bubble, is drawn as an
  `<svg class="dzg-tip-shape">` first in the bubble, filled and edged in the tone's colours (`data-shape=""`: tooltips.css
  draws no box and no arrow — the arrow, if wanted, is part of the path); `info.shape` is that `<path>`, which a GSAP
  MorphSVG tween can morph. Only path commands and numbers are taken (no `url()`, nothing that loads or runs); anything
  else and the box is kept. The path is drawn as given in both directions: an asymmetric shape is mirrored by the app
  (`info.dir`).
  Its shadow (owner 2026-11-15, an app needed a CSS rule of its own): `--dzt-shape-shadow`, a `filter` value (one or
  more `drop-shadow()`s) drawn around the path — none by default, as before. The ready-made shapes (20) read it too,
  over their own `--dzt-tooltip-shape-shadow` (their soft shadow by default, as before): one variable gives every shape
  the same shadow; `none` takes it away.
- **Grid recycling**: a grid tooltip hides at the paint where its cell shows another row (tooltips.md); a popover whose
  trigger sits in a grid row closes when that row's `aria-rowindex` changes or the trigger leaves the page.

## Where DzGrid differs on purpose
- Tooltips never show on touch alone and never hold controls (WAI-ARIA tooltip pattern); popovers are non-modal
  dialogs, not menus (no arrow-key roving: their content is the application's).
- Right to left is designed in: sides are logical, the slide and the arrow follow them.
- Reduced motion means no animation at all, not a shorter one.

## Tests
`packages/dom/test/float-place.test.ts` (sides, flip at each edge, shift, arrow clamp, RTL), `tooltip-anywhere.test.ts`
(hover delay, keyboard focus, grace, Escape, one at a time, `aria-describedby`, tone, animation attribute, hook,
destroy), `tooltip-grid-1-12.test.ts` (header buttons on / off, `cells: false`, `{ text, tone }`, `{ html }` with and
without the cleaner, compatibility), `popover.test.ts` (click, Escape, outside, focus out, code, focus in and back,
ARIA, group and nesting, scroll and recycling), `safe-html.test.ts` (hand-written hostile inputs);
`packages/theme/test/tooltips-sheet.test.ts`; `packages/angular/test/tooltip-directives.test.ts`; browser:
`scripts/browser-1-12.mjs` (tones, presets, reduced motion, flips, popover gestures, focus, outside the grid, cleaned
HTML, a component and a template, axe). Since the move (DzTooltip): `packages/core/test/float-place.test.ts` (25, 26:
the room, the padding, the fallbacks, `auto`), `follow.test.ts` (27, 28, 30), `tooltip-group.test.ts` (29),
`packages/dzgrid/test/tooltip-robust-grid.test.ts` (27–29 in a grid); browser: `scripts/browser.mjs` section 12, « the
hard cases » (25–30, the audit's evidence pages). Finished (31–40): `packages/core/test/finish-place.test.ts` (offset,
shift, an iframe's anchor, line pieces, virtual anchors, the followed cursor, every frame), `finish-interact.test.ts`
(shadow roots, the safe triangle, modal popovers, hover cards, the review's defects), the Angular inputs in
`tooltip-directives.test.ts`; browser: `scripts/browser.mjs` section 13, « finished » (`--section=finished`).
