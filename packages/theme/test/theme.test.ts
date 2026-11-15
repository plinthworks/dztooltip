// @vitest-environment node
// @dztooltip/theme (docs/behaviors/tooltips-popovers.md 4, 6–8, 15, 20): tones, four-sided arrows, the animations, the
// shapes and the popover's look, both copies. Expectations written by hand (moved from DzGrid 1.12's work, the names
// renamed `--dzt-*`); the computed looks, the motion and its absence under reduced motion are checked in real browsers
// by scripts/browser.mjs.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { compileString } from 'sass';
import { sheet as read } from './css-tree.js';

const here = (p: string) => fileURLToPath(new URL(p, import.meta.url));
const file = (p: string) => readFileSync(here(p), 'utf8');
const B = ':is(.dzt-tooltip, .dzt-popover)';
const COPIES = ['', '.unlayered'] as const;

describe('dztooltip.scss compiles to both copies (no drift), layered and not', () => {
  for (const [c, src] of [['', '@use "dztooltip";'], ['.unlayered', '@use "dztooltip" with ($layered: false);']] as const) {
    it(`dztooltip${c}.css`, () => {
      expect(file(`../dztooltip${c}.css`)).toBe(`${compileString(src, { loadPaths: [here('..')], style: 'expanded' }).css}\n`);
    });
  }
  it('the layered copy in dztooltip.theme, the unlayered one in no layer', () => {
    expect(read(file('../dztooltip.css')).rules.every((r) => r.layers.join() === 'dztooltip.theme')).toBe(true);
    expect(read(file('../dztooltip.unlayered.css')).rules.every((r) => r.layers.length === 0)).toBe(true);
  });
});

for (const c of COPIES) {
  const css = file(`../dztooltip${c}.css`);
  const rules = read(css).rules;
  const body = (sel: string, at?: string) => rules.filter((r) => r.selector === sel && (at === undefined || r.at.join() === at)).map((r) => r.body).join('\n');

  describe(`dztooltip${c}.css`, () => {
    it('the plain tooltip: its box, colours and text each a variable, the palette\'s by default', () => {
      const b = body('.dzt-tooltip');
      for (const d of ['max-inline-size: var(--dzt-tooltip-max-width, 20rem);', 'padding-block: var(--dzt-tooltip-padding-block, 0.25rem);', 'padding-inline: var(--dzt-tooltip-padding-inline, 0.5rem);',
        'border-radius: var(--dzt-tooltip-radius, var(--dzt-radius, 0.375rem));', 'color: var(--dzt-tooltip-fg, var(--tz-bg));', 'background: var(--dzt-tooltip-bg, var(--tz-fg));',
        'font-size: var(--dzt-tooltip-font-size, inherit);', 'white-space: var(--dzt-tooltip-white-space, normal);']) expect(b, d).toContain(d);
    });

    it('five tones, each its background, text, edge and arrow as variables; today\'s info by default', () => {
      const tones = { info: ['var(--dzt-tooltip-bg, var(--tz-fg))', 'var(--dzt-tooltip-fg, var(--tz-bg))', 'transparent'], neutral: ['var(--tz-bg-raised)', 'var(--tz-fg)', 'var(--tz-border)'], success: ['var(--tz-success)', 'var(--tz-bg)', 'transparent'], warning: ['var(--tz-warning)', 'var(--tz-bg)', 'transparent'], danger: ['var(--tz-danger)', 'var(--tz-bg)', 'transparent'] };
      for (const [t, [bg, fg, edge]] of Object.entries(tones)) {
        const b = body(`${B}[data-tone=${t}]`);
        expect(b, t).toContain(`background: var(--dzt-tooltip-${t}-bg, ${bg});`);
        expect(b, t).toContain(`color: var(--dzt-tooltip-${t}-fg, ${fg});`);
        expect(b, t).toContain(`outline: var(--dzt-line, 1px) solid var(--dzt-tooltip-${t}-border, ${edge});`);
        expect(b, t).toContain(`--dzt-tip-arrow-bg: var(--dzt-tooltip-${t}-arrow, var(--dzt-tooltip-${t}-bg, ${bg}));`);
      }
    });

    it('the arrow: on the side opened, at the anchor\'s middle; the four sides; turned in right to left', () => {
      expect(body(`${B}::before, .dzt-popover::after`)).toContain('inset-inline-start: calc(var(--dzt-tip-at, 1rem) - var(--dzt-tooltip-arrow-size, 0.375rem));');
      expect(body(`${B}::before, .dzt-popover::after`)).toContain('background: var(--dzt-tip-arrow-bg);');
      expect(body(`${B}[data-side=block-start]::before, .dzt-popover[data-side=block-start]::after`)).toContain('rotate: 180deg;');
      const inl = body(`${B}:is([data-side=inline-end], [data-side=inline-start])::before, .dzt-popover:is([data-side=inline-end], [data-side=inline-start])::after`);
      expect(inl).toContain('inset-block: calc(var(--dzt-tip-at, 1rem) - var(--dzt-tooltip-arrow-size, 0.375rem)) auto;');
      expect(inl).toContain('inset-inline: auto 100%;');
      expect(body(`${B}:is([data-side=inline-end], [data-side=inline-start]):dir(rtl)::before, .dzt-popover:is([data-side=inline-end], [data-side=inline-start]):dir(rtl)::after`)).toBe('scale: -1 1;');
      // The gap: the margin on every side, which the grid reads.
      expect(body('.dzt-tooltip, .dzt-popover')).toContain('margin-block-start: var(--dzt-tooltip-arrow-size, 0.375rem);');
    });

    it('animation: opacity, translate and scale only, display and overlay discrete; open and close timings as variables', () => {
      const b = body('.dzt-tooltip, .dzt-popover');
      expect(b).toContain('transition-property: opacity, translate, scale, display, overlay;');
      expect(b).toContain('transition-behavior: allow-discrete;');
      expect(b).toContain('transition-duration: var(--dzt-tooltip-open-duration, 140ms);');
      expect(b).toContain('transition-delay: var(--dzt-tooltip-open-delay, 0s);');
      const closing = body(`${B}:is([hidden], [data-closing])`);
      expect(closing).toContain('opacity: 0;');
      expect(closing).toContain('transition-duration: var(--dzt-tooltip-close-duration, 100ms);');
      expect(closing).toContain('transition-timing-function: var(--dzt-tooltip-close-easing, ease-in);');
      expect(body('.dzt-popover')).toContain('transition-duration: var(--dzt-popover-open-duration, var(--dzt-tooltip-open-duration, 140ms));');
      // Opening from the starting style; every preset's start.
      expect(body(`${B}:not([hidden])`, '@starting-style')).toBe('opacity: 0;');
      expect(body(`${B}:is([data-animation=scale], [data-animation=pop]):not([hidden])`, '@starting-style')).toBe('scale: var(--dzt-tip-scale);');
      expect(body(`${B}:is([data-animation=slide], [data-animation=rise]):not([hidden])`, '@starting-style')).toBe('translate: var(--dzt-tip-from);');
      // Nothing that lays out.
      for (const r of rules) expect(r.body, r.selector).not.toMatch(/transition-property:[^;]*(width|height|inset|margin|top)/);
    });

    it('slide and rise from the anchor\'s side, following the flip and the reading direction', () => {
      const SR = `${B}:is([data-animation=slide], [data-animation=rise])`;
      expect(body(SR)).toContain('--dzt-tip-dist: var(--dzt-tooltip-slide, 6px);');
      expect(body(SR)).toContain('--dzt-tip-from: 0 calc(-1 * var(--dzt-tip-dist));');
      expect(body(`${SR}[data-side=block-start]`)).toBe('--dzt-tip-from: 0 var(--dzt-tip-dist);');
      expect(body(`${SR}[data-side=inline-end]`)).toBe('--dzt-tip-from: calc(-1 * var(--dzt-tip-dist) * var(--dzt-tip-sign)) 0;');
      expect(body(`${B}:dir(rtl)`)).toBe('--dzt-tip-sign: -1;');
    });

    it('the richer presets, opt-in: pop from 80 % with a slight overshoot, rise 12 px with a long soft ease; closing as short as the others', () => {
      expect(body(`${B}[data-animation=pop]`)).toContain('transition-duration: var(--dzt-tooltip-pop-duration, 260ms);');
      expect(body(`${B}[data-animation=pop]`)).toContain('transition-timing-function: var(--dzt-tooltip-pop-easing, cubic-bezier(0.34, 1.4, 0.64, 1));');
      expect(body(`${B}[data-animation=pop]`)).toContain('--dzt-tip-scale: var(--dzt-tooltip-pop-scale, 0.8);');
      expect(body(`${B}[data-animation=rise]`)).toContain('transition-duration: var(--dzt-tooltip-rise-duration, 320ms);');
      expect(body(`${B}[data-animation=rise]`)).toContain('--dzt-tip-dist: var(--dzt-tooltip-rise, 12px);');
      // The closing rule comes after their timings, at the same weight: it wins when hidden.
      const at = (sel: string) => rules.findIndex((r) => r.selector === sel && r.body.includes('transition-duration'));
      expect(at(`${B}:is([hidden], [data-closing])`)).toBeGreaterThan(at(`${B}[data-animation=pop]`));
      expect(at(`${B}:is([hidden], [data-closing])`)).toBeGreaterThan(at(`${B}[data-animation=rise]`));
    });

    it('none, the app\'s own, a grid without motion, reduced motion: no transition', () => {
      expect(body(`${B}:is([data-animation=none], [data-animation=custom]), [data-motion=off] .dzt-tooltip, [data-motion=off] .dzt-tooltip::after, [data-motion=off] .dzt-tooltip > *`)).toBe('transition: none; animation: none;');
      // The morph's layer and a part's elements too (it animates them).
      expect(body(`.dzt-tooltip, .dzt-popover, ${B}[data-animation=morph], ${B}[data-animation=morph] > *, .dzt-tooltip[data-animation=morph]::after, .dzt-popover[data-animation=morph][data-side]::before`, '@media (prefers-reduced-motion: reduce)')).toBe('transition: none; animation: none;');
      // Unless the app asks a short fade: opacity only, nothing moves or grows.
      const fade = body(`${B}[data-reduced=fade]:not([data-animation=none], [data-animation=custom], [data-motion=off] *)`, '@media (prefers-reduced-motion: reduce)');
      expect(fade).toContain('transition: opacity var(--dzt-tooltip-reduced-duration, 120ms) linear');
      expect(fade).toContain('translate: none !important;');
      expect(fade).toContain('scale: none !important;');
    });

    it('forced colours: an edge and the arrow in the system\'s colour', () => {
      expect(body('.dzt-tooltip, .dzt-popover', '@media (forced-colors: active)')).toBe('outline: 1px solid CanvasText;');
      expect(body(`${B}::before, .dzt-popover::after`, '@media (forced-colors: active)')).toContain('background: CanvasText;');
    });

    it('the popover\'s look: every part a variable', () => {
      const b = body('.dzt-popover');
      for (const v of ['--dzt-popover-max-width', '--dzt-popover-padding', '--dzt-popover-border', '--dzt-popover-radius', '--dzt-popover-fg', '--dzt-popover-bg', '--dzt-popover-shadow', '--dzt-popover-font-size', '--dzt-popover-arrow-color']) expect(b, v).toContain(`var(${v}`);
    });

    it('an app shape: no box nor arrow, its path filled and edged in the tone\'s colours, under the content', () => {
      expect(body(`${B}[data-shape=""]`)).toContain('background: transparent;');
      expect(body(`${B}[data-shape=""]::before, .dzt-popover[data-shape=""]::after`)).toBe('display: none;');
      expect(body('.dzt-tip-shape')).toContain('z-index: -1;');
      expect(body('.dzt-tip-shape > path')).toContain('fill: var(--dzt-tip-arrow-bg);');
      expect(body('.dzt-tip-shape > path')).toContain('stroke: var(--dzt-tip-arrow-edge);');
      // Its shadow around the path (owner 2026-11-15): `--dzt-shape-shadow`, none by default (today's look).
      expect(body('.dzt-tip-shape')).toContain('filter: var(--dzt-shape-shadow, none);');
    });

    it('ready-made shapes (20): the edge and a shadow around the whole outline; pill, ticket, bubble', () => {
      const S = `${B}:is([data-shape=bubble], [data-shape=ticket], [data-shape=pill]`;
      const all = body(`${S}, [data-animation=morph])`);
      expect(all).toContain('outline-color: transparent;');
      expect(all).toContain('box-shadow: none;');
      expect(all).toContain('filter: drop-shadow(var(--dzt-line, 1px) 0 0 var(--dzt-tip-arrow-edge)) drop-shadow(calc(-1 * var(--dzt-line, 1px)) 0 0 var(--dzt-tip-arrow-edge)) drop-shadow(0 var(--dzt-line, 1px) 0 var(--dzt-tip-arrow-edge)) drop-shadow(0 calc(-1 * var(--dzt-line, 1px)) 0 var(--dzt-tip-arrow-edge)) var(--dzt-tip-shadow);');
      // `--dzt-shape-shadow` over their own (the app shapes' too); their soft shadow by default, as before.
      expect(body(`${S})`)).toContain('--dzt-tip-shadow: var(--dzt-shape-shadow, var(--dzt-tooltip-shape-shadow, drop-shadow(0 0.125rem 0.375rem color-mix(in srgb, var(--tz-fg) 25%, transparent))));');
      expect(body(`${B}[data-shape=pill]`)).toContain('border-radius: 999px;');
      expect(body(`${B}[data-shape=pill]`)).toContain('padding-inline: var(--dzt-tooltip-pill-padding, 0.75rem);');
      // The ticket: four round bites out of its background, the tone's colour.
      const t = body(`${B}[data-shape=ticket]`);
      expect(t.match(/radial-gradient\(circle at /g)).toHaveLength(4);
      expect(t).toContain('transparent var(--dzt-tooltip-ticket-notch, 0.375rem), var(--dzt-tip-bg)');
      expect(t).toContain('background: var(--dzt-tip-fill);');
      // The bubble: rounder, its tail the arrow turned per side (the gap the grid reads is its size).
      expect(body(`${B}[data-shape=bubble]`)).toContain('border-radius: var(--dzt-tooltip-bubble-radius, 0.75rem);');
      expect(body(`${B}[data-shape=bubble]`)).toContain('--dzt-tooltip-arrow-size: var(--dzt-tooltip-bubble-tail, 0.5rem);');
      const tail = body('.dzt-tooltip[data-shape=bubble][data-side]::before, .dzt-popover[data-shape=bubble][data-side]::after');
      expect(tail).toContain('clip-path: polygon(0% 58%');
      expect(tail).toContain('scale: none;');
      expect(body('.dzt-tooltip[data-shape=bubble][data-side=block-start]::before, .dzt-popover[data-shape=bubble][data-side=block-start]::after')).toContain('rotate: 180deg;');
      expect(body('.dzt-tooltip[data-shape=bubble]:is([data-side=inline-end], [data-side=inline-start])::before, .dzt-popover[data-shape=bubble]:is([data-side=inline-end], [data-side=inline-start])::after')).toContain('rotate: calc(-90deg * var(--dzt-tip-sign));');
      expect(body('.dzt-tooltip[data-shape=bubble][data-side=inline-start]::before, .dzt-popover[data-shape=bubble][data-side=inline-start]::after')).toContain('rotate: calc(90deg * var(--dzt-tip-sign));');
      // The popover's edge triangle not drawn under a shape (the drop-shadows draw the edge).
      expect(body('.dzt-popover:is([data-shape=bubble], [data-shape=ticket], [data-shape=pill])::before')).toBe('display: none;');
    });

    it('morph (7): from a pill at the arrow to the whole box, a layer\'s clip-path; the content from its first third; closing reversed, faster', () => {
      const M = `${B}[data-animation=morph]`;
      expect(body(M)).toContain('--dzt-tip-cx: calc(50% + (var(--dzt-tip-at, 1rem) - 50%) * var(--dzt-tip-sign));');
      // The pill's corners 1.25rem: round, and easing into the bubble's own (from 999px they snapped at the end).
      expect(body(M)).toContain('--dzt-tip-pill: inset(0 var(--dzt-tip-x1) 55% var(--dzt-tip-x0) round 1.25rem);');
      expect(body(M)).toContain('background: transparent;');
      // One frame ahead (16 ms; owner 2026-11-14 « pas aussi fluide que GSAP »): its first painted frame already moves.
      expect(body(M)).toContain('transition-delay: calc(var(--dzt-tooltip-open-delay, 0s) - 16ms);');
      expect(body(M)).toContain('animation: dzt-tip-words var(--dzt-tooltip-morph-content-duration, 200ms) ease-out calc(var(--dzt-tooltip-morph-content-delay, 120ms) - 16ms) backwards;');
      expect(body(`${M} > *`)).toContain('animation: dzt-tip-rise var(--dzt-tooltip-morph-content-duration, 200ms) ease-out calc(var(--dzt-tooltip-morph-content-delay, 120ms) - 16ms) backwards;');
      expect(body(`${M}[data-side=block-start]`)).toBe('--dzt-tip-pill: inset(55% var(--dzt-tip-x1) 0 var(--dzt-tip-x0) round 1.25rem);');
      expect(body(`${M}[data-side=inline-end]`)).toBe('--dzt-tip-pill: inset(var(--dzt-tip-y0) calc(27.5% + 27.5% * var(--dzt-tip-sign)) var(--dzt-tip-y1) calc(27.5% - 27.5% * var(--dzt-tip-sign)) round 1.25rem);');
      const L = '.dzt-tooltip[data-animation=morph]::after, .dzt-popover[data-animation=morph][data-side]::before';
      expect(body(L)).toContain('z-index: -1;');
      expect(body(L)).toContain('background: var(--dzt-tip-fill);');
      expect(body(L)).toContain('clip-path: inset(0 round 0);');
      // 320 ms, GSAP's power3.out as a curve (the owner's app's tween), one frame ahead.
      expect(body(L)).toContain('animation: dzt-tip-morph var(--dzt-tooltip-morph-duration, 320ms) var(--dzt-tooltip-morph-easing, cubic-bezier(0.33, 1, 0.68, 1)) calc(-1 * 16ms);');
      expect(body('from', '@keyframes dzt-tip-morph')).toBe('clip-path: var(--dzt-tip-pill);');
      expect(body('from', '@keyframes dzt-tip-rise')).toBe('opacity: 0; translate: 0 0.25rem;');
      // Closing: the content first, the shape back to the pill, the bubble fading last; 180 ms in all.
      const C = body(`${M}:is([hidden], [data-closing])`);
      expect(C).toContain('transition-duration: calc(var(--dzt-tooltip-morph-close-duration, 180ms) * 0.45), calc(var(--dzt-tooltip-morph-close-duration, 180ms) * 0.3), var(--dzt-tooltip-morph-close-duration, 180ms), var(--dzt-tooltip-morph-close-duration, 180ms);');
      expect(body('.dzt-tooltip[data-animation=morph]:is([hidden], [data-closing])::after, .dzt-popover[data-animation=morph][data-side]:is([hidden], [data-closing])::before')).toContain('clip-path: var(--dzt-tip-pill);');
      // Paint only: no layout property moves.
      for (const r of rules) expect(r.body, r.selector).not.toMatch(/(transition|animation)[^;]*\b(width|height|inset|margin|padding|top)\b/);
    });

    it('logical sides only', () => {
      expect(css).not.toMatch(/\b(left|right)\b/);
    });
  });
}
