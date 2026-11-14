# Clean room

DzTooltip is written from scratch. It reproduces what a person **sees and does** with tooltips and popovers — never
how another library does it.

## Allowed

- Public documentation and live demos of other libraries, to learn observable behaviour. Floating UI's public
  documentation (MIT) was read as a reference for positioning concepts and their edge cases — placements, offset,
  flip, shift, arrow, size, following on scroll and resize, hiding a clipped anchor (owner 2026-11-14, « s'inspirer
  sans copier »); no line of its code was read, copied or translated, and it is no dependency.
- Standards: WAI-ARIA Authoring Practices (tooltip, disclosure, non-modal dialog), WCAG 2.2, the HTML `popover`
  attribute, CSS (`@starting-style`, `transition-behavior`, `clip-path`).
- Our own code: DzGrid (where this code was first written), tzslot, DzCalendar.

## Not allowed

- Reading, copying or translating another tooltip, popover or positioning library's source code, tests, CSS or build
  setup; decompiling or reverse-engineering their bundles.
- Pasting their documentation text into ours.
- Anything from `/Users/nadou/Dev/dz-grid-migration/`.

## How a behaviour is borrowed

Each behaviour gets lines in `docs/behaviors/tooltips-popovers.md`, in our own words, before the code; the tests point
to them. This applies to every contributor, human or agent.
