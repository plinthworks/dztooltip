// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
// @ts-expect-error a plain .mjs script
import { baselineFile, breaks, compatible, format, parse, PACKAGES, surfaceOf } from '../api.mjs';

const root = new URL('../..', import.meta.url).pathname;
const built = PACKAGES.every((p: string) => existsSync(join(root, 'packages', p, 'dist', 'package.json')));

/**
 * The public type surface guard (scripts/api.mjs, `npm run check:api`; owner 2026-11-21). The comparison is text, so
 * what it lets through is pinned here, case by case: additions pass, removals and narrowing fail.
 */
describe('api.mjs, what counts as a compatible change', () => {
  const iface = (...members: string[]) => ['export interface Opts {', ...members.map((m) => `    ${m}`), '}'].join('\n');

  it('passes an optional member added, fails a required one', () => {
    expect(compatible(iface('readonly a: string;'), iface('readonly a: string;', 'readonly b?: number;'))).toBe(true);
    expect(compatible(iface('readonly a: string;'), iface('readonly a: string;', 'readonly b: number;'))).toBe(false);
  });

  it('fails a member removed or retyped, or an optional one made required', () => {
    expect(compatible(iface('readonly a: string;', 'readonly b?: number;'), iface('readonly a: string;'))).toBe(false);
    expect(compatible(iface('readonly a: string;'), iface('readonly a: number;'))).toBe(false);
    expect(compatible(iface('readonly a?: string;'), iface('readonly a: string;'))).toBe(false);
  });

  it('passes union members added, but not null or undefined; fails one removed', () => {
    expect(compatible("export type TipTone = 'info' | 'danger';", "export type TipTone = 'info' | 'danger' | 'brand';")).toBe(true);
    expect(compatible("export type TipTone = 'info' | 'danger';", "export type TipTone = 'info';")).toBe(false);
    expect(compatible('export declare function g(): Node | undefined;', 'export declare function g(): Node | null | undefined;')).toBe(false);
  });

  it('passes an optional parameter added, fails a required one', () => {
    expect(compatible('export declare function g(a: string): void;', 'export declare function g(a: string, b?: number): void;')).toBe(true);
    expect(compatible('export declare function g(a: string): void;', 'export declare function g(a: string, b: number): void;')).toBe(false);
  });

  it('passes any member added to a class, fails one removed', () => {
    const cls = (...m: string[]) => ['declare class DzTooltip {', ...m.map((x) => `    ${x}`), '}'].join('\n');
    expect(compatible(cls('show(): void;'), cls('show(): void;', 'hide(): void;'))).toBe(true);
    expect(compatible(cls('show(): void;', 'hide(): void;'), cls('show(): void;'))).toBe(false);
  });

  it('reports an export or an entry gone, and lets a new export through', () => {
    const accepted = { '@x/a': { f: 'export declare function f(): void;', g: 'export declare function g(): void;' }, '@x/b': { h: 'export type H = 1;' } };
    const current = { '@x/a': { f: 'export declare function f(): void;', n: 'export type N = 2;' } };
    expect(breaks(accepted, current).map((b: { entry: string; name: string; kind: string }) => `${b.entry}#${b.name} ${b.kind}`)).toEqual(['@x/a#g removed', '@x/b#* entry removed']);
  });

  it('reads back what it writes', () => {
    const surface = { '@x/a': { f: 'export declare function f(o: {\n    readonly a?: string;\n}): void;' } };
    expect(parse(format(surface, ['first']))).toEqual({ surface, history: ['first'] });
  });
});

describe('the 1.0.0 baseline', () => {
  it('guards the four published packages', () => {
    expect(PACKAGES).toEqual(['core', 'theme', 'angular', 'dzgrid']);
  });

  it('has a baseline for each package, starting with the published 1.0.0', () => {
    for (const name of PACKAGES) {
      const { surface, history } = parse(readFileSync(baselineFile(name), 'utf8'));
      expect(history[0]).toBe('owner 2026-11-21: baseline of the published 1.0.0');
      expect(Object.keys(surface).length).toBeGreaterThan(0);
    }
  });

  // An entry of an exports map without a section would not be guarded at all; a new one fails here until accepted.
  it('has a section for every published entry of every package (./internal aside: no semver promise)', () => {
    const missing: string[] = [];
    for (const name of PACKAGES) {
      const manifest = JSON.parse(readFileSync(join(root, 'packages', name, 'package.json'), 'utf8')) as { name: string; exports?: Record<string, unknown> };
      const { surface } = parse(readFileSync(baselineFile(name), 'utf8'));
      // The Angular package's map is written by ng-packagr at build: one entry, the package itself.
      for (const key of Object.keys(manifest.exports ?? { '.': null })) {
        if (key === './package.json' || key === './internal') continue;
        const entry = key === '.' ? manifest.name : manifest.name + key.slice(1);
        if (!(entry in surface)) missing.push(entry);
      }
    }
    expect(missing).toEqual([]);
  });

  it('holds the published functions and directives by name', () => {
    const exportsOf = (name: string, entry: string) => Object.keys(parse(readFileSync(baselineFile(name), 'utf8')).surface[entry] ?? {});
    expect(exportsOf('core', '@dztooltip/core')).toEqual(expect.arrayContaining(['tooltip', 'popover', 'safeHtml', 'TooltipOptions', 'PopoverOptions']));
    expect(exportsOf('angular', '@dztooltip/angular')).toEqual(expect.arrayContaining(['DzTooltip', 'DzPopover']));
    expect(exportsOf('dzgrid', '@dztooltip/dzgrid')).toContain('dzTooltips');
    expect(Object.keys(parse(readFileSync(baselineFile('theme'), 'utf8')).surface)).toEqual(
      expect.arrayContaining(['@dztooltip/theme', '@dztooltip/theme/dztooltip.css', '@dztooltip/theme/dztooltip.unlayered.css', '@dztooltip/theme/dztooltip.scss']),
    );
  });
});

describe.skipIf(!built)('check:api on a planted change (needs npm run build)', () => {
  /** Copies of the four dist/ folders, the core's index.d.ts rewritten by `plant`, checked with `--from`. */
  function check(plant: (text: string) => string) {
    const dir = mkdtempSync(join(tmpdir(), 'dzt-api-'));
    try {
      for (const p of PACKAGES) cpSync(join(root, 'packages', p, 'dist'), join(dir, p), { recursive: true });
      const file = join(dir, 'core', 'index.d.ts');
      writeFileSync(file, plant(readFileSync(file, 'utf8')));
      return spawnSync('node', [join(root, 'scripts', 'api.mjs'), '--from', dir], { encoding: 'utf8' });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }

  it('passes the build as it is', () => {
    expect(check((t) => t).status).toBe(0);
  });

  it('fails an export removed', () => {
    const r = check((t) => t.replace("export { safeHtml } from './html.js';\n", ''));
    expect(r.status).toBe(1);
    expect(r.stderr).toContain('@dztooltip/core#safeHtml: removed');
  });

  it('passes an export added', () => {
    const r = check((t) => `${t}\nexport declare const planted: number;\n`);
    expect(r.status).toBe(0);
  });

  it('reads the same surface from the build as the baseline holds', () => {
    const current = surfaceOf(join(root, 'packages', 'core', 'dist'));
    expect(breaks(parse(readFileSync(baselineFile('core'), 'utf8')).surface, current)).toEqual([]);
  });
});
