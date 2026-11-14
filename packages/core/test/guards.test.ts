// @vitest-environment node
// The sources and the theme hold DzTooltip's rules (CLAUDE.md): no colour literal, no visible text written, logical
// sides only (`dir.ts` aside), no HTML sink (`parseFromString` in `html.ts` only), no raw invisible character. The
// guard itself is checked against planted violations first. Expectations written by hand.
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkScss, checkSource } from './guards.js';

const here = (p: string) => fileURLToPath(new URL(p, import.meta.url));
const files = (dir: string, ext: RegExp): string[] =>
  !existsSync(dir) ? [] : readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    if (f === 'node_modules' || f === 'dist') return [];
    return statSync(p).isDirectory() ? files(p, ext) : ext.test(p) ? [p] : [];
  });

describe('the guards catch what is planted', () => {
  it('a colour, a word, a physical side, an HTML sink, a raw invisible character', () => {
    expect(checkSource("el.style.color = '#f00';", 'src/a.ts').map((f) => f.rule)).toContain('colour');
    expect(checkSource("el.textContent = 'Close';", 'src/a.ts').map((f) => f.rule)).toContain('literal-text');
    expect(checkSource('const x = r.left;', 'src/a.ts').map((f) => f.rule)).toContain('physical');
    expect(checkSource('el.innerHTML = h;', 'src/a.ts').map((f) => f.rule)).toContain('html');
    expect(checkSource("const s = 'a‏b';", 'src/a.ts').map((f) => f.rule)).toContain('invisible');
  });

  it('let dir.ts name sides, and html.ts parse in an inert document — and only them', () => {
    expect(checkSource('const x = r.left;', 'src/dir.ts')).toEqual([]);
    const parse = "const d = new DOMParser().parseFromString(h, 'text/html');";
    expect(checkSource(parse, 'src/html.ts')).toEqual([]);
    expect(checkSource(parse, 'src/tooltip.ts').map((f) => f.rule)).toEqual(['html']);
    expect(checkSource('el.innerHTML = h;', 'src/html.ts').map((f) => f.rule)).toEqual(['html']);
  });

  it('SCSS: a colour outside the palette, a physical side', () => {
    expect(checkScss('.dzt-x { color: #000; }\n.dzt-y { margin-left: 2px; }').map((f) => `${f.line}:${f.rule}`)).toEqual(['1:colour', '2:physical']);
  });
});

describe('the rules hold', () => {
  for (const pkg of ['core', 'angular', 'dzgrid']) {
    it(`for every source of @dztooltip/${pkg}`, () => {
      const src = here(`../../${pkg}/src`);
      const found = files(src, /\.ts$/).flatMap((f) => checkSource(readFileSync(f, 'utf8'), f.slice(src.length + 1)).map((x) => `${f.slice(src.length + 1)}:${x.line} ${x.rule} ${x.why}`));
      // One read, never a write: Angular's sanitizer's output read back as text, cleaned again by safeHtml (tooltip.ts).
      expect(found.filter((x) => !(pkg === 'angular' && /^tooltip\.ts:\d+ html innerHTML$/.test(x)))).toEqual([]);
    });
  }

  it('for the theme', () => {
    const found = files(here('../../theme'), /\.scss$/).flatMap((f) => checkScss(readFileSync(f, 'utf8')).map((x) => `${f}:${x.line} ${x.rule}`));
    expect(found).toEqual([]);
  });
});
