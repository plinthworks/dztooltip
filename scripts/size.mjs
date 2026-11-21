/**
 * Measures each published entry the way a consumer ships it — the built dist/ file bundled, minified, gzipped —
 * against size-budget.json (owner 2026-11-21: DzGrid's size guard, adapted). Exits 1 over budget, or when an entry
 * cannot be measured (run `npm run build` first). A budget is raised only by a written owner decision, recorded in the
 * file's `$comment`.
 *
 *   npm run check:size                         after npm run build
 *   node scripts/size.mjs --budget <file>       another budget document (the tests plant one)
 *
 * An entry: `{ file, maxGzip, external? }`. `file` is a path from the repository's root to a built JS or CSS file;
 * `external`: packages a consumer already has (the Angular directives are measured without Angular and the core).
 * A stylesheet is minified by esbuild's CSS loader, as an app's build would.
 */
import { build } from 'esbuild';
import { existsSync, readFileSync } from 'node:fs';
import { isAbsolute, join, resolve } from 'node:path';
import { gzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));

/** `{ min, gz }` in bytes: the file bundled and minified, then gzipped at level 9. */
export async function measure(file, external = []) {
  const out = await build({ entryPoints: [file], bundle: true, minify: true, format: 'esm', target: 'es2022', write: false, treeShaking: true, external, logLevel: 'silent' });
  const code = out.outputFiles[0].contents;
  return { min: code.length, gz: gzipSync(code, { level: 9 }).length };
}

/** Per entry, `{ name, gz, min, ok, line }`: `gz` null when the file could not be measured. */
export async function check(budget, base = root) {
  const results = [];
  for (const [name, { file, maxGzip, external = [] }] of Object.entries(budget.entries)) {
    const path = isAbsolute(file) ? file : join(base, file);
    if (!existsSync(path)) {
      results.push({ name, gz: null, min: null, ok: false, line: `OVER ${name}: ${file} is missing — run npm run build` });
      continue;
    }
    const { min, gz } = await measure(path, external);
    const ok = gz <= maxGzip;
    results.push({ name, gz, min, ok, line: `${ok ? 'ok  ' : 'OVER'} ${name}: ${min} B min, ${gz} B gz (budget ${maxGzip})` });
  }
  return results;
}

export const readBudget = (file = join(root, 'size-budget.json')) => JSON.parse(readFileSync(file, 'utf8'));

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const file = args.includes('--budget') ? resolve(args[args.indexOf('--budget') + 1]) : undefined;
  const results = await check(readBudget(file));
  for (const r of results) console.log(r.line);
  process.exit(results.some((r) => !r.ok) ? 1 : 0);
}
