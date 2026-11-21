// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
// @ts-expect-error a plain .mjs script
import { check, readBudget } from '../size.mjs';

const root = new URL('../..', import.meta.url).pathname;

/**
 * The size guard (scripts/size.mjs, `npm run check:size`; owner 2026-11-21). Each line is the published 1.0.0
 * measured on the built dist/ (bundled, minified, gzip level 9; the Angular directives and the bridge without what a
 * consumer already has) + about 5 %, rounded up to 50 B. Measured 2026-11-21: core 12 204, core/internal 7 793,
 * angular 3 356, dzgrid 2 115, dztooltip.css 2 994, dztooltip.unlayered.css 2 966. A line moves only by a written
 * owner decision: change it here and in size-budget.json's `$comment` together.
 */
describe('size-budget.json', () => {
  const budget = readBudget() as { $comment: string; entries: Record<string, { file: string; maxGzip: number; external?: string[] }> };

  it('pins every line', () => {
    const lines = Object.fromEntries(Object.entries(budget.entries).map(([name, e]) => [name, e.maxGzip]));
    expect(lines).toEqual({
      '@dztooltip/core': 12850,
      '@dztooltip/core/internal': 8200,
      '@dztooltip/angular': 3550,
      '@dztooltip/dzgrid': 2250,
      '@dztooltip/theme/dztooltip.css': 3150,
      '@dztooltip/theme/dztooltip.unlayered.css': 3150,
    });
    expect(budget.$comment).toContain('owner 2026-11-21');
  });

  it('measures the built files a consumer imports, without what it already has', () => {
    expect(budget.entries['@dztooltip/core']!.file).toBe('packages/core/dist/index.js');
    expect(budget.entries['@dztooltip/core/internal']!.file).toBe('packages/core/dist/internal.js');
    expect(budget.entries['@dztooltip/angular']!.file).toBe('packages/angular/dist/fesm2022/dztooltip-angular.mjs');
    expect(budget.entries['@dztooltip/angular']!.external).toEqual(['@angular/*', '@dztooltip/*', 'tslib']);
    expect(budget.entries['@dztooltip/dzgrid']!.file).toBe('packages/dzgrid/dist/index.js');
    expect(budget.entries['@dztooltip/dzgrid']!.external).toEqual(['@dztooltip/*', '@dzgrid/*']);
    expect(budget.entries['@dztooltip/theme/dztooltip.css']!.file).toBe('packages/theme/dist/dztooltip.css');
    expect(budget.entries['@dztooltip/theme/dztooltip.unlayered.css']!.file).toBe('packages/theme/dist/dztooltip.unlayered.css');
  });

  // The JS entries of every exports map, and the shipped stylesheets (the .scss is a source, not shipped bytes).
  it('has a line for every published entry', () => {
    const missing: string[] = [];
    for (const name of ['core', 'angular', 'dzgrid', 'theme']) {
      const m = JSON.parse(readFileSync(join(root, 'packages', name, 'package.json'), 'utf8')) as { name: string; exports?: Record<string, unknown> };
      for (const key of Object.keys(m.exports ?? { '.': null })) {
        if (key === './package.json' || key.endsWith('.scss')) continue;
        // The theme's `.` is dztooltip.css, measured under its own name.
        const entry = name === 'theme' && key === '.' ? `${m.name}/dztooltip.css` : key === '.' ? m.name : m.name + key.slice(1);
        if (!(entry in budget.entries)) missing.push(entry);
      }
    }
    expect(missing).toEqual([]);
  });
});

describe('size.mjs on planted files', () => {
  function planted(budgetOf: (dir: string) => object) {
    const dir = mkdtempSync(join(tmpdir(), 'dzt-size-'));
    // 200 distinct numbers: about 400 B gzipped, far over 100 and far under 5 000.
    writeFileSync(join(dir, 'big.js'), `export const big = [${Array.from({ length: 200 }, (_, i) => i * 7919).join(', ')}];\n`);
    writeFileSync(join(dir, 'look.css'), '.a { color: var(--dzt-x); }\n');
    const file = join(dir, 'budget.json');
    writeFileSync(file, JSON.stringify(budgetOf(dir)));
    return { dir, file };
  }

  it('fails an oversize entry: check:size exits 1 and names it', () => {
    const { dir, file } = planted((d) => ({ entries: { big: { file: join(d, 'big.js'), maxGzip: 100 }, look: { file: join(d, 'look.css'), maxGzip: 5000 } } }));
    try {
      const r = spawnSync('node', [join(root, 'scripts', 'size.mjs'), '--budget', file], { encoding: 'utf8' });
      expect(r.status).toBe(1);
      expect(r.stdout).toMatch(/^OVER big: \d+ B min, \d+ B gz \(budget 100\)$/m);
      expect(r.stdout).toMatch(/^ok {3}look: /m);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('passes entries under budget', () => {
    const { dir, file } = planted((d) => ({ entries: { big: { file: join(d, 'big.js'), maxGzip: 5000 } } }));
    try {
      expect(spawnSync('node', [join(root, 'scripts', 'size.mjs'), '--budget', file], { encoding: 'utf8' }).status).toBe(0);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('fails a file that is not there (not built)', async () => {
    const [r] = await check({ entries: { gone: { file: 'packages/none/dist/index.js', maxGzip: 1 } } });
    expect(r).toMatchObject({ name: 'gone', gz: null, ok: false });
  });
});
