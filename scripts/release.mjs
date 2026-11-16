/**
 * The release: check, publish, verify (1.0.0; docs/release-1.0.0.md). Taken from DzGrid's scripts/release.mjs.
 *
 *   npm run release:check                     build, pack, the built manifests and typings checked, every published
 *                                             entry compiled in a strict Angular project (scripts/entries.mjs)
 *   npm run publish:latest -- --otp=123456   build, then publish core → theme → angular → dzgrid with one code,
 *                                             what the registry has already skipped, then the registry asked
 *   npm run publish:verify                    the registry asked alone
 *   node scripts/release.mjs publish --dry-run
 *
 * Lessons from tzslot and DzGrid: dependencies first, so a half-finished release is still coherent; a version the
 * registry already has is skipped, so a failed run is simply run again; and a release is finished when the registry
 * says so, not when `npm publish` printed something (the publish is asynchronous, a tarball can lag its metadata).
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Dependencies before dependents. */
export const ORDER = ['core', 'theme', 'angular', 'dzgrid'];
/** Each is published from its build output (`npm run build`). */
export const FOLDERS = Object.fromEntries(ORDER.map((n) => [n, `packages/${n}/dist`]));
/** The ranges the published manifests must ask (owner 2026-11-16: DzGrid 1.13.0 is on npm; Angular as DzGrid's). */
export const PEERS = {
  '@dztooltip/dzgrid': { '@dzgrid/dom': '^1.13.0' },
  '@dztooltip/angular': { '@angular/core': '^19.0.0 || ^20.0.0 || ^21.0.0 || ^22.0.0', '@angular/common': '^19.0.0 || ^20.0.0 || ^21.0.0 || ^22.0.0' },
};
/** Runtime dependencies allowed besides our own packages. */
const ALLOWED = { '@dztooltip/angular': ['tslib'] };

/** The files an exports map points at (`types`, `default`, `sass`… — nested conditions too). */
const targets = (v) => (typeof v === 'string' ? [v] : Object.values(v ?? {}).flatMap(targets));

/**
 * Problems with a release, as sentences; empty when it can go. `manifests`: `{ '@dztooltip/core': manifest, … }` as
 * they will be published; `exists(name, file)`: whether a file is in that package's folder.
 */
export function releaseProblems(manifests, exists = () => true) {
  const problems = [];
  const version = manifests['@dztooltip/core']?.version;
  if (!version) return ['@dztooltip/core has no version'];
  if (version.includes('-')) problems.push(`${version} is a prerelease: run npm run build`);
  for (const [name, m] of Object.entries(manifests)) {
    if (m.version !== version) problems.push(`${name} is ${m.version}, not ${version}`);
    if (m.license !== 'MIT') problems.push(`${name} has no MIT licence`);
    if (!m.repository?.url?.includes('plinthworks/dztooltip')) problems.push(`${name} has no repository`);
    if (!m.keywords?.length) problems.push(`${name} has no keywords`);
    if (JSON.stringify(m).includes('src/')) problems.push(`${name} points at src/`);
    for (const [dep, range] of Object.entries(m.dependencies ?? {})) {
      if (dep.startsWith('@dztooltip/')) {
        if (range !== `^${version}`) problems.push(`${name} depends on ${dep} ${range}, not ^${version}`);
      } else if (!(ALLOWED[name] ?? []).includes(dep)) problems.push(`${name} has a runtime dependency ${dep}`);
    }
    for (const [dep, range] of Object.entries(PEERS[name] ?? {})) {
      if (m.peerDependencies?.[dep] !== range) problems.push(`${name} asks ${dep} ${m.peerDependencies?.[dep] ?? 'nothing'}, not ${range}`);
    }
    for (const dep of Object.keys(m.peerDependencies ?? {})) if (!PEERS[name]?.[dep]) problems.push(`${name} asks an unexpected peer ${dep}`);
    for (const f of [...targets(m.exports), m.main, m.module, m.types, m.typings, m.style, m.sass].filter(Boolean)) {
      if (!exists(name, f)) problems.push(`${name}: ${f} is not in the package`);
    }
    if (!exists(name, 'README.md')) problems.push(`${name} has no README.md`);
    if (!exists(name, 'LICENSE')) problems.push(`${name} has no LICENSE`);
  }
  return problems;
}

/**
 * Every `@dztooltip/<pkg>/<sub>` a built declaration file imports must be an entry that package exports (DzGrid 1.7.0:
 * its typings imported an entry its core does not publish, « Cannot find module »). `files`: `[path, text]`.
 */
export function typingProblems(manifests, files) {
  const bad = [];
  for (const [file, text] of files)
    for (const m of text.matchAll(/(?:from|import)\s*\(?\s*['"](@dztooltip\/[a-z-]+)(\/[a-z0-9-/]+)?['"]/g)) {
      const sub = m[2] ? `.${m[2]}` : '.';
      const exp = manifests[m[1]]?.exports;
      if (!exp || !(sub in exp)) bad.push(`${file} imports ${m[1]}${m[2] ?? ''}, which is not a published entry`);
    }
  return bad;
}

/** The packages to publish, in order: those whose registry listing (`{ core: ['0.9.0'], … }`) lacks `version`. */
export function toPublish(version, listed) {
  return ORDER.filter((n) => !(listed[n] ?? []).includes(version));
}

const root = fileURLToPath(new URL('..', import.meta.url));
const nameOf = (n) => `@dztooltip/${n}`;
const sleep = (ms) => new Promise((resume) => setTimeout(resume, ms));

function* dts(dir) {
  if (!existsSync(dir)) return;
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) yield* dts(p);
    else if (name.endsWith('.d.ts')) yield p;
  }
}

function check() {
  const missing = ORDER.filter((n) => !existsSync(join(root, FOLDERS[n], 'package.json')));
  if (missing.length) {
    console.error(`✖ not built: ${missing.join(', ')} — run npm run build`);
    process.exit(1);
  }
  const manifests = Object.fromEntries(ORDER.map((n) => [nameOf(n), JSON.parse(readFileSync(join(root, FOLDERS[n], 'package.json'), 'utf8'))]));
  const folderOf = (name) => join(root, FOLDERS[name.slice('@dztooltip/'.length)]);
  const problems = releaseProblems(manifests, (name, f) => existsSync(join(folderOf(name), f)));
  const files = ORDER.flatMap((n) => [...dts(join(root, FOLDERS[n]))].map((f) => [f.slice(root.length), readFileSync(f, 'utf8')]));
  problems.push(...typingProblems(manifests, files));
  for (const p of problems) console.error(`✖ ${p}`);
  if (problems.length) process.exit(1);
  const version = manifests['@dztooltip/core'].version;
  console.log(`Release check: the ${ORDER.length} packages at ${version}; peers, dist manifests, typings (${files.length} files) right.`);
  return version;
}

/** The versions the registry lists for a package, bypassing every cache ([] for a package not there yet). */
async function listedVersions(n) {
  const response = await fetch(`https://registry.npmjs.org/${encodeURIComponent(nameOf(n))}`, { headers: { accept: 'application/json' }, cache: 'no-store' });
  if (response.status === 404) return { versions: [], latest: null, tarballs: {} };
  if (!response.ok) throw new Error(`the registry answered ${response.status} for ${nameOf(n)}`);
  const body = await response.json();
  const tarballs = Object.fromEntries(Object.entries(body.versions ?? {}).map(([v, m]) => [v, m.dist?.tarball]));
  return { versions: Object.keys(body.versions ?? {}), latest: body['dist-tags']?.latest ?? null, tarballs };
}

async function publish(version, { dryRun, otp }) {
  const listed = Object.fromEntries(await Promise.all(ORDER.map(async (n) => [n, (await listedVersions(n)).versions])));
  const todo = toPublish(version, listed);
  for (const n of ORDER) if (!todo.includes(n)) console.log(`  ${nameOf(n)}@${version} is already on npm: skipped`);
  for (const n of todo) {
    console.log(`\nPublishing ${nameOf(n)}@${version}${dryRun ? ' (dry run)' : ''}`);
    const args = ['publish', '--access', 'public', '--provenance=false'];
    if (dryRun) args.push('--dry-run');
    if (otp) args.push(`--otp=${otp}`);
    const run = spawnSync('npm', args, { cwd: join(root, FOLDERS[n]), stdio: 'inherit' });
    if (run.status !== 0) {
      console.error(`\n✖ ${nameOf(n)} did not publish. The ones before it did; run the same command again once fixed:\n  what is already on npm is skipped.`);
      process.exit(1);
    }
  }
  return todo.length;
}

/** Waits (up to ten minutes each) until the registry lists every package at `version` and serves its tarball. */
async function verify(version) {
  console.log('\nAsking the registry what arrived (npm publishes asynchronously, so this waits).');
  let missing = 0;
  for (const n of ORDER) {
    const deadline = Date.now() + 600_000;
    let state = null;
    for (;;) {
      state = await listedVersions(n).catch(() => null);
      if (state?.versions.includes(version) || Date.now() > deadline) break;
      await sleep(10_000);
    }
    if (!state?.versions.includes(version)) { console.error(`  ✖ ${nameOf(n)}@${version} is NOT on npm`); missing++; continue; }
    if (!state.tarballs[version]) { console.error(`  ✖ ${nameOf(n)}@${version} is listed without a tarball URL`); missing++; continue; }
    let ok = false;
    while (!ok && Date.now() < deadline + 180_000) {
      ok = (await fetch(state.tarballs[version], { method: 'HEAD', cache: 'no-store' }).catch(() => null))?.ok ?? false;
      if (!ok) await sleep(5_000);
    }
    if (!ok) { console.error(`  ✖ ${nameOf(n)}@${version} is listed but its tarball is not served`); missing++; continue; }
    console.log(`  ✔ ${nameOf(n)}@${version} is there and installable${state.latest === version ? '' : ` (latest is ${state.latest})`}`);
  }
  if (missing) {
    console.error(`\n${missing} of ${ORDER.length} packages are missing: the others ask for them, so they cannot be installed yet.`);
    process.exit(1);
  }
  console.log(`\nAll ${ORDER.length} are on npm.`);
}

const main = async () => {
  const [command, ...rest] = process.argv.slice(2);
  const dryRun = rest.includes('--dry-run');
  // Two-factor auth on writes: one code for the four (tzslot's lesson: a prompt per package expires).
  const otp = rest.find((a) => a.startsWith('--otp='))?.slice(6);
  if (command === 'check') return void check();
  if (command === 'verify') return verify(check());
  if (command === 'publish') {
    const version = check();
    await publish(version, { dryRun, otp });
    if (!dryRun) await verify(version);
    return;
  }
  console.error('Usage: node scripts/release.mjs check|publish|verify [--dry-run] [--otp=123456]');
  process.exit(1);
};

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) await main();
