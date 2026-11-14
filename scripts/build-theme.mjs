/**
 * Compiles the theme: dztooltip.scss → dztooltip.css (in `@layer dztooltip.theme`) and dztooltip.unlayered.css
 * ($layered: false). packages/theme/test/theme.test.ts compiles the same way and fails when a file drifts.
 */
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { compileString } from 'sass';

const dir = fileURLToPath(new URL('../packages/theme/', import.meta.url));
const out = (source, file) => {
  const { css } = compileString(source, { loadPaths: [dir], style: 'expanded' });
  writeFileSync(`${dir}${file}`, `${css}\n`);
  console.log(`build:theme: ${file}`);
};
out('@use "dztooltip";', 'dztooltip.css');
out('@use "dztooltip" with ($layered: false);', 'dztooltip.unlayered.css');
