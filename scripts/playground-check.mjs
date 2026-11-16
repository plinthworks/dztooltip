/**
 * The test page checked in a real browser (owner 2026-11-16): `node scripts/playground-check.mjs [chrome|firefox|webkit]`
 * against the running `npm run playground` (http://127.0.0.1:4740/). Each section exercised as a person would — hover,
 * keyboard, click, drag, select —, no console error, axe 0 (light and left to right, then dark and right to left), and
 * screenshots in `SHOTS` (default /tmp/dzt-playground). One browser, closed in finally.
 */
import { mkdirSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { browser } from './kit.mjs';

const name = process.argv[2] ?? 'chrome';
const BASE = process.env.PLAYGROUND ?? 'http://127.0.0.1:4740/playground/';
const SHOTS = process.env.SHOTS ?? '/tmp/dzt-playground';
mkdirSync(SHOTS, { recursive: true });
const AXE = (() => {
  try {
    return readFileSync(createRequire(import.meta.url).resolve('axe-core/axe.min.js'), 'utf8');
  } catch {
    return readFileSync(new URL('../../dzgrid/node_modules/axe-core/axe.min.js', import.meta.url), 'utf8');
  }
})();
const results = [];
const check = (label, ok, detail) => {
  results.push(!!ok);
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}: ${label}${ok ? '' : `  ${JSON.stringify(detail ?? null).slice(0, 600)}`}`);
};
/** The page's own tooltip bubble (not a grid's), shown. */
const TIP = '.dzt-tooltip.dzt-float:not([hidden]):not(.dzg *)';
const POP = '.dzt-popover:not([hidden])';

const b = await browser(name);
try {
  const page = await b.newPage({ viewport: { width: 1200, height: 800 } });
  const errors = [];
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(BASE);
  await page.waitForFunction(() => window.ready === true, null, { timeout: 30000 });
  await page.waitForTimeout(300);
  const tipText = () => page.evaluate((s) => document.querySelector(s)?.textContent ?? null, TIP);
  const away = () => page.mouse.move(2, 790);
  const hoverBtn = async (sel, wait = 400) => {
    await away();
    await page.waitForTimeout(250);
    await into(sel);
    await page.hover(sel);
    await page.waitForTimeout(wait);
  };
  const btn = (scope, text) => `${scope} button:text-is("${text}")`;
  /** Into view, and its scroll heard (a scroll hides a tooltip) before the next gesture. */
  const into = async (sel) => {
    await page.locator(sel).first().evaluate((e) => e.scrollIntoView({ block: 'center' }));
    await page.waitForTimeout(300);
  };

  // Tones.
  for (const tone of ['info', 'danger', 'success', 'warning', 'neutral']) {
    await hoverBtn(btn('#tones', tone), 700);
    const t = await page.evaluate((s) => document.querySelector(s)?.dataset.tone, TIP);
    check(`tone ${tone}`, t === tone, t);
  }
  await page.screenshot({ path: `${SHOTS}/${name}-tone.png` });

  // Placements.
  for (const [p, side] of [['top-start', 'block-start'], ['bottom-end', 'block-end'], ['start', 'inline-start'], ['right', 'inline-end']]) {
    await hoverBtn(btn('#places', p), 450);
    const s = await page.evaluate((x) => document.querySelector(x)?.dataset.side, TIP);
    check(`placement ${p} → ${side}`, s === side, s);
  }

  // The draggable anchor near the edges: dragged to the window's end (the stage's visible end), the popover slides
  // back inside, still on its anchor; near the window's top it flips below.
  await away();
  await page.evaluate(() => { const st = document.getElementById('stage'); window.scrollTo(0, st.getBoundingClientRect().top + scrollY - 150); });
  await page.waitForTimeout(300);
  await page.click('#drag-open');
  await page.waitForTimeout(300);
  const d2 = await page.locator('#drag').boundingBox();
  const st = await page.locator('#stage').boundingBox();
  await page.mouse.move(d2.x + 10, d2.y + 10);
  await page.mouse.down();
  await page.mouse.move(st.x + st.width - 40, d2.y + 10, { steps: 10 });
  await page.waitForTimeout(300);
  let pop = await page.evaluate(() => { const p = document.querySelector('.dzt-popover:not([hidden])'); const a = document.getElementById('drag').getBoundingClientRect(); return { r: p?.getBoundingClientRect().toJSON(), a: a.toJSON(), log: document.getElementById('drag-log').textContent }; });
  check('drag: open while dragged; at the window\'s edge, slid back inside, still on its anchor', pop.r && pop.r.right <= 1200 && pop.r.left >= 0 && pop.r.right > pop.a.left, pop);
  await page.screenshot({ path: `${SHOTS}/${name}-drag-edge.png` });
  await page.mouse.up();
  await page.evaluate(() => { const d = document.getElementById('drag'); window.scrollTo(0, d.getBoundingClientRect().top + scrollY - 60); });
  await page.waitForTimeout(300);
  await page.focus('#drag');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowUp');
  await page.waitForTimeout(300);
  pop = await page.evaluate(() => { const p = document.querySelector('.dzt-popover:not([hidden])'); const a = document.getElementById('drag').getBoundingClientRect(); return p && { side: p.dataset.side, r: p.getBoundingClientRect().toJSON(), a: a.toJSON() }; });
  check('drag: near the top of the window, flipped below its anchor', pop?.side === 'block-end' && pop.r.top >= pop.a.bottom, pop);
  await page.screenshot({ path: `${SHOTS}/${name}-drag.png` });
  await page.keyboard.press('Escape');

  // Offset.
  await into('#off-main');
  await page.evaluate(() => { const r = document.getElementById('off-main'); r.value = '30'; r.dispatchEvent(new Event('input', { bubbles: true })); });
  await page.waitForTimeout(250);
  // Below or above, whichever fits: the gap on its side.
  const off = await page.evaluate((s) => { const t = document.querySelector(s); const r = t?.getBoundingClientRect(); const a = document.getElementById('off-anchor').getBoundingClientRect(); return r && { side: t.dataset.side, gap: t.dataset.side === 'block-end' ? r.top - a.bottom : a.top - r.bottom }; }, TIP);
  check('offset: a 30 px gap (arrow included)', off && off.gap >= 30 && off.gap <= 42, off);

  // Animations.
  for (const a of ['fade', 'pop', 'morph']) {
    await hoverBtn(btn('#anims', a), 500);
    const v = await page.evaluate((s) => document.querySelector(s)?.dataset.animation, TIP);
    check(`animation ${a}`, v === a, v);
  }
  // Reduced motion: none.
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await hoverBtn(btn('#anims', 'scale'), 500);
  const rm = await page.evaluate((s) => { const t = document.querySelector(s); return t && getComputedStyle(t).transitionDuration; }, TIP);
  check('reduced motion: no transition', rm && rm.split(',').every((x) => parseFloat(x) === 0), rm);
  await page.emulateMedia({ reducedMotion: 'no-preference' });

  // Shapes.
  for (const [label, shape] of [['ticket', 'ticket'], ['pill', 'pill'], ['forme de l’appli', '']]) {
    await hoverBtn(btn('#shapes', label), 500);
    const v = await page.evaluate((s) => { const t = document.querySelector(s); return t && { shape: t.dataset.shape, svg: !!t.querySelector('svg.dzt-tip-shape path[d]') }; }, TIP);
    check(`shape ${label || 'app'}`, v?.shape === shape && (shape !== '' || v.svg), v);
  }

  // Rich content: the hostile string neutralised.
  await hoverBtn(btn('#rich', 'HTML hostile'), 500);
  const hostile = await page.evaluate((s) => { const t = document.querySelector(s); return t && { b: !!t.querySelector('b'), bad: !!t.querySelector('img, script, a[href^=javascript], [style], [onerror]'), pwned: window.__pwned }; }, TIP);
  check('rich: hostile HTML shown neutralised, nothing ran', hostile?.b && !hostile.bad && hostile.pwned === undefined, hostile);
  await hoverBtn(btn('#rich', 'Nœuds'), 500);
  check('rich: nodes', (await tipText())?.includes('12 kg'), await tipText());
  await page.screenshot({ path: `${SHOTS}/${name}-rich.png` });
  await away();

  // Popovers: click, Escape, focus back; modal trap; hover card.
  await page.locator('#pop-click').scrollIntoViewIfNeeded();
  await page.click('#pop-click');
  await page.waitForTimeout(250);
  check('popover: opened by a click, the focus inside', await page.evaluate(() => !!document.activeElement?.closest('.dzt-popover')));
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  check('popover: Escape closes it, the focus back on its trigger', await page.evaluate(() => !document.querySelector('.dzt-popover') && document.activeElement?.id === 'pop-click'));
  await page.click('#pop-modal');
  await page.waitForTimeout(250);
  const inside = [];
  for (let i = 0; i < 6; i++) {
    await page.keyboard.press('Tab');
    // Inside, or (WebKit, buttons not in its Tab order) out to the browser's own controls — never on the page outside.
    inside.push(await page.evaluate(() => !!document.activeElement?.closest('.dzt-popover') || document.activeElement === document.body));
  }
  const inert = await page.evaluate(() => document.querySelector('main').inert || document.querySelector('main').closest('[inert]') !== null || [...document.body.children].some((c) => c.inert));
  check('modal: Tab stays inside (6 presses), the page inert', inside.every(Boolean) && inert, { inside, inert });
  await page.screenshot({ path: `${SHOTS}/${name}-modal.png` });
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  check('modal: Escape gives the page back, the focus on its trigger', await page.evaluate(() => ![...document.querySelectorAll('[inert]')].length && document.activeElement?.id === 'pop-modal'));
  await hoverBtn('#pop-card', 800);
  check('hover card: opened by resting on the link', await page.evaluate(() => !!document.querySelector('.dzt-popover')?.textContent?.includes('Maraîchère')));
  await away();
  await page.waitForTimeout(700);
  check('hover card: closed when the pointer leaves', await page.evaluate(() => !document.querySelector('.dzt-popover')));

  // Delay groups.
  await hoverBtn('#toolbar button:nth-child(1)', 300);
  check('group: the first waits its delay', (await tipText()) === null, await tipText());
  await page.waitForTimeout(600);
  check('group: … then shows', (await tipText()) === 'Gras', await tipText());
  await page.hover('#toolbar button:nth-child(2)');
  await page.waitForTimeout(80);
  check('group: the next shows at once', (await tipText()) === 'Italique', await tipText());
  await away();

  // A native dialog.
  await page.locator('#dlg-open').scrollIntoViewIfNeeded();
  await page.click('#dlg-open');
  await page.waitForTimeout(200);
  await page.hover('#dlg-tip');
  await page.waitForTimeout(500);
  check('dialog: the tooltip inside the open dialog', await page.evaluate((s) => document.querySelector(s)?.parentElement?.id === 'dlg', TIP));
  await page.click('#dlg-pop');
  await page.waitForTimeout(250);
  check('dialog: the popover inside, its field focused', await page.evaluate(() => document.querySelector('.dzt-popover')?.parentElement?.id === 'dlg' && !!document.activeElement?.closest('.dzt-popover')));
  await page.screenshot({ path: `${SHOTS}/${name}-dialog.png` });
  await page.keyboard.press('Escape');
  await page.click('#dlg-close');
  await page.waitForTimeout(200);

  // Size limited: the button near the window's bottom.
  await page.evaluate(() => { const t = document.getElementById('tall'); window.scrollTo(0, t.getBoundingClientRect().top + scrollY - 700); });
  await page.waitForTimeout(200);
  await page.click('#tall');
  await page.waitForTimeout(300);
  const tall = await page.evaluate(() => { const p = document.querySelector('.dzt-popover'); const body = p?.querySelector('.dzt-popover-body'); const r = p?.getBoundingClientRect(); return r && { top: r.top, bottom: r.bottom, scrolls: body.scrollHeight > body.clientHeight }; });
  check('size: the tall popover within the window, its body scrolls', tall && tall.top >= 0 && tall.bottom <= 800 && tall.scrolls, tall);
  await page.screenshot({ path: `${SHOTS}/${name}-size.png` });
  await page.keyboard.press('Escape');

  // Following: a growing anchor; an animated one with and without everyFrame.
  await page.locator('#grow-go').scrollIntoViewIfNeeded();
  await page.click('#grow-go');
  await page.waitForTimeout(900);
  const grown = await page.evaluate(() => { const p = document.querySelector('.dzt-popover')?.getBoundingClientRect(); const a = document.getElementById('grow').getBoundingClientRect(); return p && { mid: (p.left + p.right) / 2, amid: (a.left + a.right) / 2 }; });
  check('follow: the popover moved with its grown anchor', grown && Math.abs(grown.mid - grown.amid) < 3, grown);
  await page.click('#run-every');
  await page.waitForTimeout(700);
  const ev = await page.evaluate(() => { const p = document.querySelector('.dzt-popover')?.getBoundingClientRect(); const a = document.getElementById('runner').getBoundingClientRect(); return p && Math.abs((p.left + p.right) / 2 - (a.left + a.right) / 2); });
  check('everyFrame: the popover on its animated anchor', ev !== null && ev < 12, ev);
  await page.click('#run-plain');
  await page.waitForTimeout(1200);
  const pl = await page.evaluate(() => { const p = document.querySelector('.dzt-popover')?.getBoundingClientRect(); const a = document.getElementById('runner').getBoundingClientRect(); return p && Math.abs((p.left + p.right) / 2 - (a.left + a.right) / 2); });
  // Without it the observers still see a transform's move (Chrome), a step late: open, near it.
  check('without everyFrame: still open, by its anchor', pl !== null && pl < 60, pl);
  await page.keyboard.press('Escape');

  // Virtual anchors: the cursor, a selection.
  await into('#cursor-both');
  const z = await page.locator('#cursor-both').boundingBox();
  await page.mouse.move(z.x + 30, z.y + 50);
  await page.mouse.move(z.x + 60, z.y + 60, { steps: 4 });
  await page.waitForTimeout(200);
  const cur = await page.evaluate((s) => { const r = document.querySelector(s)?.getBoundingClientRect(); return r && { mid: (r.left + r.right) / 2, bottom: r.bottom }; }, TIP);
  check('follow the cursor: the tooltip over the pointer', cur && Math.abs(cur.mid - (z.x + 60)) < 3 && cur.bottom <= z.y + 60, { cur, x: z.x + 60 });
  await away();
  await into('#selectable');
  const p = await page.locator('#selectable').boundingBox();
  await page.mouse.move(p.x + 5, p.y + 8);
  await page.mouse.down();
  await page.mouse.move(p.x + 160, p.y + 8, { steps: 5 });
  await page.mouse.up();
  await page.waitForTimeout(300);
  const sel = await page.evaluate((s) => ({ tip: document.querySelector(s)?.textContent ?? null, sel: getSelection().toString().length }), TIP);
  check('selection: a tooltip on the selected text', /caractères? sélectionnés?/.test(sel.tip ?? ''), sel);
  await page.screenshot({ path: `${SHOTS}/${name}-selection.png` });
  await page.evaluate(() => getSelection().removeAllRanges());
  await page.keyboard.press('Escape');

  // A link broken over lines: placed on the hovered piece (its second line).
  await into('#wrapped');
  const pieces = await page.evaluate(() => [...document.getElementById('wrapped').getClientRects()].map((r) => r.toJSON()));
  const second = pieces[1];
  await away();
  await page.waitForTimeout(250);
  await page.mouse.move(second.left + 10, (second.top + second.bottom) / 2);
  await page.waitForTimeout(400);
  const lt = await page.evaluate((s) => document.querySelector(s)?.getBoundingClientRect().toJSON(), TIP);
  check('inline: on the hovered line piece', pieces.length > 1 && lt && lt.bottom <= second.top + 1 && lt.bottom >= second.top - 16, { pieces: pieces.length, lt, second });

  // Shadow DOM.
  await away();
  await page.waitForTimeout(250);
  const sh = page.locator('#card').locator('button', { hasText: 'Info (shadow)' });
  await sh.scrollIntoViewIfNeeded();
  await sh.hover();
  await page.waitForTimeout(500);
  const shadow = await page.evaluate((s) => { const b = document.getElementById('card').shadowRoot.querySelector('button'); const t = document.querySelector(s); return { text: t?.textContent, linked: (b.ariaDescribedByElements ?? []).includes(t) || b.getAttribute('aria-description') === t?.textContent }; }, TIP);
  check('shadow: shown, the anchor described across the boundary', shadow.text?.includes('shadow root') && shadow.linked, shadow);

  // An iframe: with root the bubble above it, in the page.
  await away();
  await into('#frame');
  const fr = page.frameLocator('#frame');
  await fr.locator('#with-root').hover();
  await page.waitForTimeout(500);
  const ifr = await page.evaluate((s) => { const t = document.querySelector(s); const f = document.getElementById('frame').getBoundingClientRect(); return t && { inPage: t.ownerDocument === document, top: t.getBoundingClientRect().top, frameTop: f.top, frameBottom: f.bottom }; }, TIP);
  check('iframe: with root, the bubble in the page over the frame', ifr?.inPage && ifr.top > ifr.frameTop, ifr);
  await page.screenshot({ path: `${SHOTS}/${name}-iframe.png` });
  await page.mouse.move(2, 790);
  await page.waitForTimeout(400);

  // The DzGrid bridge: a cell's HTML tooltip (cleaned), a number's tone, a header's.
  await into('#grid-host');
  const GT = '.dzt-tooltip:not([hidden])';
  const cell = page.locator('#grid-host [role=rowheader][aria-colindex="1"]').first();
  await cell.hover();
  await page.waitForTimeout(700);
  const gt = await page.evaluate((s) => { const t = [...document.querySelectorAll(s)].pop(); return t && { b: !!t.querySelector('b'), img: !!t.querySelector('img'), text: t.textContent }; }, GT);
  check('grid: a cell\'s cleaned HTML tooltip', gt?.b && !gt.img, gt);
  await page.mouse.move(2, 790);
  await page.waitForTimeout(400);
  const kg = page.locator('#grid-host [role=gridcell][aria-colindex="3"]').nth(3);
  await kg.hover();
  await page.waitForTimeout(700);
  const tone = await page.evaluate((s) => [...document.querySelectorAll(s)].pop()?.dataset.tone, GT);
  check('grid: a number\'s tone', ['success', 'warning', 'info'].includes(tone), tone);
  await page.screenshot({ path: `${SHOTS}/${name}-grid.png` });
  await page.mouse.move(2, 790);
  await page.waitForTimeout(400);

  // axe, light and left to right, then dark and right to left (the grid made again).
  await page.addScriptTag({ content: AXE });
  const axe = () => page.evaluate(async () => (await window.axe.run(document, { runOnly: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'] })).violations.map((x) => `${x.id}: ${x.nodes.slice(0, 3).map((n) => n.target).join(' ')}`));
  let v = await axe();
  check('axe 0, light, left to right', v.length === 0, v);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: `${SHOTS}/${name}-light-ltr.png`, fullPage: true });
  await page.click('#theme');
  await page.click('#dir');
  await page.waitForTimeout(400);
  v = await axe();
  check('axe 0, dark, right to left', v.length === 0, v);
  // Right to left: a start placement opens on the right.
  await hoverBtn(btn('#places', 'start'), 450);
  const rtl = await page.evaluate((s) => { const t = document.querySelector(s)?.getBoundingClientRect(); const a = [...document.querySelectorAll('#places button')].find((x) => x.textContent === 'start').getBoundingClientRect(); return t && { tl: t.left, ar: a.right }; }, TIP);
  check('RTL: start is on the right', rtl && rtl.tl >= rtl.ar, rtl);
  // The RTL iframe: its anchor's bubble still placed over the frame.
  await away();
  await page.locator('#frame').scrollIntoViewIfNeeded();
  await page.waitForTimeout(200);
  await fr.locator('#with-root').hover();
  await page.waitForTimeout(500);
  const ifr2 = await page.evaluate((s) => { const t = document.querySelector(s); const f = document.getElementById('frame'); const b = f.contentDocument.getElementById('with-root').getBoundingClientRect(); const fr = f.getBoundingClientRect(); const r = t?.getBoundingClientRect(); return r && { dir: t.dir, mid: (r.left + r.right) / 2, amid: fr.left + f.clientLeft + (b.left + b.right) / 2 }; }, TIP);
  check('RTL iframe: the bubble centred on its anchor, right to left', ifr2 && ifr2.dir === 'rtl' && Math.abs(ifr2.mid - ifr2.amid) < 3, ifr2);
  await page.evaluate(() => window.scrollTo(0, 0));
  await away();
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${SHOTS}/${name}-dark-rtl.png`, fullPage: true });
  check('no console error', errors.length === 0, errors);
} finally {
  await b.close();
}
const failed = results.filter((x) => !x).length;
console.log(`${name}: ${results.length - failed} / ${results.length} ok`);
process.exit(failed ? 1 : 0);
