/**
 * The test page (owner 2026-11-16, « je veux une page de test »): `npm run playground`, then http://localhost:4740/.
 * DzTooltip from this repository's sources (TypeScript compiled on the fly, scripts/kit.mjs), DzGrid 1.13.0 from npm
 * (devDependencies): its import map is written from the packages' own `exports`, so every entry DzGrid imports resolves.
 * Made-up content only. Port 4740 (DzGrid's playground 4700, the owner's app 4730/4731).
 */
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, handle } from './kit.mjs';

const PORT = Number(process.env.PORT ?? 4740);

/** `@dzgrid/<p>/<entry>` → its file under /node_modules, from each package's `exports`. */
function importMap() {
  const imports = {
    '@dztooltip/core': '/packages/core/src/index.ts',
    '@dztooltip/core/internal': '/packages/core/src/internal.ts',
    '@dztooltip/dzgrid': '/packages/dzgrid/src/index.ts',
  };
  for (const p of ['core', 'dom']) {
    const { exports } = JSON.parse(readFileSync(join(ROOT, 'node_modules', '@dzgrid', p, 'package.json'), 'utf8'));
    for (const [k, v] of Object.entries(exports)) {
      const to = typeof v === 'string' ? v : v?.default;
      if (typeof to !== 'string' || !to.endsWith('.js')) continue;
      imports[`@dzgrid/${p}${k === '.' ? '' : k.slice(1)}`] = `/node_modules/@dzgrid/${p}/${to.replace(/^\.\//, '')}`;
    }
  }
  return JSON.stringify({ imports }, null, 1);
}

const server = createServer((req, res) => {
  const path = new URL(req.url ?? '/', 'http://x').pathname;
  if (path === '/' || path === '/playground' ) {
    res.writeHead(302, { location: '/playground/' });
    return res.end();
  }
  if (path === '/playground/' || path === '/playground/index.html') {
    const html = readFileSync(join(ROOT, 'playground', 'index.html'), 'utf8').replace('<!-- importmap -->', `<script type="importmap">${importMap()}</script>`);
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
    return res.end(html);
  }
  handle(req, res).catch((err) => {
    console.error(`[playground] ${req.url}: ${err?.message ?? err}`);
    if (!res.headersSent) res.writeHead(500);
    res.end();
  });
});
server.listen(PORT, '127.0.0.1', () => console.log(`DzTooltip playground: http://localhost:${PORT}/`));
