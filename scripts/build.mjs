/**
 * Builds every package into its own dist/, ready for `npm publish dist` (the owner publishes). The repository's
 * manifests point at TypeScript sources (the workspace and the tests use them); each dist/ gets a manifest of its own,
 * written here from the source one. Refuses a manifest pointing at src/, and a runtime dependency in core.
 * Layout taken from tzslot's scripts/build.mjs.
 */
import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const pkg = (name) => join(root, 'packages', name);
const read = (file) => JSON.parse(readFileSync(file, 'utf8'));
const run = (cmd, args, cwd = root) => execFileSync(cmd, args, { cwd, stdio: 'inherit' });

const shared = (name) => ({
  license: 'MIT',
  repository: { type: 'git', url: 'git+https://github.com/plinthworks/dztooltip.git', directory: `packages/${name}` },
  homepage: 'https://github.com/plinthworks/dztooltip#readme',
  bugs: { url: 'https://github.com/plinthworks/dztooltip/issues' },
  keywords: ['tooltip', 'popover', 'placement', 'animation', 'rtl', 'accessibility'],
});

/** The workspace's own packages, pinned to the versions being built together. */
const internal = (deps = {}) =>
  Object.fromEntries(Object.entries(deps).map(([n, v]) => (n.startsWith('@dztooltip/') ? [n, `^${read(join(pkg(n.slice(11)), 'package.json')).version}`] : [n, v])));

/** README and LICENSE travel with every package (the package's own, else the repository's). */
function extras(name) {
  for (const file of ['README.md', 'LICENSE']) {
    const own = join(pkg(name), file);
    const source = existsSync(own) ? own : existsSync(join(root, file)) ? join(root, file) : null;
    if (source) cpSync(source, join(pkg(name), 'dist', file));
  }
}

function typescript(name) {
  const dir = pkg(name);
  rmSync(join(dir, 'dist'), { recursive: true, force: true });
  run('npx', ['tsc', '-p', join(dir, 'tsconfig.build.json')]);
  const source = read(join(dir, 'package.json'));
  const exports = Object.fromEntries(
    Object.keys(source.exports)
      .filter((k) => k !== './package.json')
      .map((k) => {
        const base = k === '.' ? 'index' : k.slice(2);
        return [k, { types: `./${base}.d.ts`, default: `./${base}.js` }];
      }),
  );
  const manifest = {
    name: source.name,
    version: source.version,
    description: source.description,
    ...shared(name),
    type: 'module',
    sideEffects: false,
    main: './index.js',
    module: './index.js',
    types: './index.d.ts',
    exports: { ...exports, './package.json': './package.json' },
    ...(source.dependencies ? { dependencies: internal(source.dependencies) } : {}),
    ...(source.peerDependencies ? { peerDependencies: source.peerDependencies } : {}),
  };
  writeFileSync(join(dir, 'dist', 'package.json'), JSON.stringify(manifest, null, 2) + '\n');
  extras(name);
}

function angular() {
  const dir = pkg('angular');
  rmSync(join(dir, 'dist'), { recursive: true, force: true });
  run('npx', ['ng-packagr', '-p', 'ng-package.json', '-c', 'tsconfig.lib.json'], dir);
  const file = join(dir, 'dist', 'package.json');
  const manifest = read(file);
  delete manifest.main;
  delete manifest.types;
  Object.assign(manifest, shared('angular'));
  manifest.dependencies = internal(manifest.dependencies);
  writeFileSync(file, JSON.stringify(manifest, null, 2) + '\n');
  extras('angular');
}

function theme() {
  const dir = pkg('theme');
  rmSync(join(dir, 'dist'), { recursive: true, force: true });
  mkdirSync(join(dir, 'dist'));
  run('node', ['scripts/build-theme.mjs']);
  const source = read(join(dir, 'package.json'));
  for (const file of source.files) cpSync(join(dir, file), join(dir, 'dist', file));
  const { files: _files, ...manifest } = source;
  writeFileSync(join(dir, 'dist', 'package.json'), JSON.stringify({ ...manifest, ...shared('theme') }, null, 2) + '\n');
  extras('theme');
}

// Order matters: the bridge and the Angular directives compile against core's declarations.
typescript('core');
typescript('dzgrid');
angular();
theme();

for (const name of ['core', 'dzgrid', 'angular', 'theme']) {
  const m = read(join(pkg(name), 'dist', 'package.json'));
  if (JSON.stringify(m).includes('src/')) {
    console.error(`packages/${name}/dist/package.json still points at src/`);
    process.exit(1);
  }
}
if (Object.keys(read(join(pkg('core'), 'dist', 'package.json')).dependencies ?? {}).length) {
  console.error('@dztooltip/core has a runtime dependency: it must have none');
  process.exit(1);
}
console.log('\nBuilt: packages/{core,dzgrid,angular,theme}/dist');
