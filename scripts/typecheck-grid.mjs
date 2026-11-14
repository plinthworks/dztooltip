/**
 * The bridge against DzGrid's own types (packages/dzgrid/test/fits-dzgrid.ts), when a DzGrid checkout sits beside this
 * one (`../dzgrid`); said and skipped otherwise. Part of `npm run typecheck`.
 */
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
if (!existsSync(`${root}../dzgrid/packages/dom/src/index.ts`)) {
  console.log('typecheck: no DzGrid checkout beside this one, the bridge\'s fit is not checked');
  process.exit(0);
}
execFileSync('npx', ['tsc', '-p', 'packages/dzgrid/tsconfig.grid.json'], { cwd: root, stdio: 'inherit' });
