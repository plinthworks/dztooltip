import { defineConfig } from 'vitest/config';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import angular from '@analogjs/vite-plugin-angular';

const here = (p: string) => fileURLToPath(new URL(p, import.meta.url));
const alias = {
  '@dztooltip/core/internal': here('./packages/core/src/internal.ts'),
  '@dztooltip/core': here('./packages/core/src/index.ts'),
  '@dztooltip/angular': here('./packages/angular/src/index.ts'),
  '@dztooltip/dzgrid': here('./packages/dzgrid/src/index.ts'),
};

/**
 * The bridge's tests run against DzGrid's sources (its seam, 1.12.0, is not on npm yet): a checkout next to this one
 * (`../dzgrid`, or `DZGRID_SRC`). Without it they are skipped (set `DZGRID_SRC` to point elsewhere).
 */
const dzgrid = process.env['DZGRID_SRC'] ?? here('../dzgrid');
const hasGrid = existsSync(`${dzgrid}/packages/dom/src/index.ts`);
const gridAlias = [
  { find: /^@dzgrid\/(core|dom)$/, replacement: `${dzgrid}/packages/$1/src/index.ts` },
  { find: /^@dzgrid\/(core|dom)\/(.+)$/, replacement: `${dzgrid}/packages/$1/src/$2.ts` },
  ...Object.entries(alias).map(([find, replacement]) => ({ find, replacement })),
];

if (!hasGrid) console.warn(`[dztooltip] no DzGrid checkout at ${dzgrid}: the bridge's grid tests are skipped (DZGRID_SRC).`);

export default defineConfig({
  test: {
    globals: true,
    projects: [
      { resolve: { alias }, test: { name: 'core', globals: true, environment: 'jsdom', include: ['packages/core/test/**/*.test.ts'] } },
      // Without a DzGrid checkout beside this one, the bridge's grid tests are not collected (said once below).
      { resolve: { alias: gridAlias }, test: { name: 'dzgrid', globals: true, environment: 'jsdom', passWithNoTests: true, include: hasGrid ? ['packages/dzgrid/test/**/*.test.ts'] : [] } },
      // Components are compiled for the tests, not stubbed (tzslot, DzGrid): only rendering a template catches a
      // binding that silently fails.
      {
        plugins: [angular({ jit: false, tsconfig: here('./packages/angular/tsconfig.spec.json') })],
        resolve: { alias },
        test: { name: 'angular', globals: true, environment: 'jsdom', setupFiles: ['packages/angular/test/setup.ts'], include: ['packages/angular/test/**/*.test.ts'] },
      },
      { test: { name: 'theme', globals: true, environment: 'node', include: ['packages/theme/test/**/*.test.ts'] } },
      { test: { name: 'tools', globals: true, environment: 'node', include: ['scripts/test/**/*.test.ts'] } },
    ],
  },
});
