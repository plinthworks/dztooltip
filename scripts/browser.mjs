/**
 * DzTooltip in real browsers (docs/behaviors/tooltips-popovers.md): `node scripts/browser.mjs`. Moved from DzGrid's
 * scripts/browser-1-12.mjs (sections 11, 11b–11e, owner 2026-11-14) with the code; the page is
 * packages/core/test/browser/tips.html, its grid a DzGrid from the checkout beside this one (`../dzgrid`, served under
 * /dzgrid/) drawn through the bridge, `dzTooltips({ header: true, html: true })`. The matrix: Chrome, Firefox, WebKit ×
 * layered and unlayered sheets × light and dark × French and Arabic × without and with Tailwind 3's preflight. One
 * browser at a time, closed in finally. `--only=chrome` runs one browser; `--first` one run per browser.
 *
 * Wired, not yet run here (0.1.0): the checks were green in DzGrid (16 272 / 16 272 at its 65faeec); after the move
 * their names were renamed (`dzt-*`, `--dzt-*`) and the grid's header and HTML options moved into the bridge's options.
 * The Angular fixture's checks (`angularTips`, section 11b) wait for an Angular fixture of this repository.
 */
import { mkdirSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { serve, browser } from './kit.mjs';

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
  if (!ok || process.env.VERBOSE) console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}  ${ok ? '' : JSON.stringify(detail ?? null).slice(0, 900)}`);
};
const site = await serve(new URL('../packages/core/test/browser/tips.html', import.meta.url).href);
const SHOTS = process.env.SHOTS;
if (SHOTS) mkdirSync(SHOTS, { recursive: true });
const frames = (page) => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(r)))));
const RED = 'rgb(255, 0, 0)';

/** Relative luminance of a computed colour (`rgb()` or `color(srgb …)`), for the tones' contrast. */
const lum = (c) => {
  const m = c.match(/rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)/) ?? c.match(/color\(srgb ([\d.]+) ([\d.]+) ([\d.]+)/);
  const k = c.startsWith('color(') ? 1 : 255;
  const [r, g, b] = [1, 2, 3].map((i) => { const v = Number(m[i]) / k; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };

/**
 * (11) Tooltips and popovers (docs/behaviors/tooltips-popovers.md; owner 2026-11-13 and Q-T1 B, 2026-11-14), page
 * tips.html: every tone readable (4.5:1 measured), each animation preset's transitions (opacity, translate, scale
 * only; the richer `pop` and `rise`), none under reduced motion and a fade only with `reducedMotion: 'fade'`, no layout
 * while it runs (Chrome's layout count), the 12 placements on the screen's or the line's sides with their alignment and
 * the arrow over the anchor, a flip at each edge (and none with `flip: false`), the popover by click, Escape, a press
 * outside, Tab past its end and code, its focus in and back, nested; cleaned HTML that ran nothing; the grid's header
 * button and HTML tooltips with `tooltips()`, a cell's popover; axe with both open.
 */
async function tipsChecks(page, tag, cfg, name) {
  const { css, dark, lang, preflight } = cfg;
  const rtl = lang === 'ar';
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto(site.url(`tips.html?lang=${lang}&css=${css}${dark ? '&dark=1' : ''}${preflight ? '&preflight=1' : ''}`));
  await page.waitForFunction(() => window.ready === true, null, { timeout: 30000 });
  await frames(page);
  const B = '.dzt-tooltip.dzt-float';
  const settle = () => page.waitForTimeout(450);

  // Tones: text 4.5:1 on its background, the arrow in the background's colour.
  for (const tone of ['info', 'neutral', 'success', 'warning', 'danger']) {
    const t = await page.evaluate(({ tone, B }) => {
      window.tip('c', { tone, animation: 'none' });
      const el = document.querySelector(B);
      const s = getComputedStyle(el);
      return { fg: s.color, bg: s.backgroundColor, arrow: getComputedStyle(el, '::before').backgroundColor, tone: el.dataset.tone };
    }, { tone, B });
    check(`${tag}: tone ${tone}: its text ${ratio(t.fg, t.bg).toFixed(2)}:1 on its background, the arrow its colour`, t.tone === tone && ratio(t.fg, t.bg) >= 4.5 && t.arrow === t.bg, t);
  }

  // Presets: what each transition moves, on opening.
  const PRESETS = { fade: ['opacity'], scale: ['opacity', 'scale'], slide: ['opacity', 'translate'], pop: ['opacity', 'scale'], rise: ['opacity', 'translate'], none: [] };
  // Hidden, drawn hidden (a frame), then shown: the opening runs from its starting style.
  const anims = async (animation, extra = {}) => {
    await page.evaluate(() => window.tips.get('c')?.destroy());
    await settle();
    return page.evaluate(({ animation, extra, B }) => {
    window.tip('c', { animation, ...extra });
    const el = document.querySelector(B);
    return el.getAnimations().map((a) => ({ p: a.transitionProperty, d: a.effect.getTiming().duration })).filter((a) => a.p !== 'display' && a.p !== 'overlay');
  }, { animation, extra, B });
  };
  for (const [preset, want] of Object.entries(PRESETS)) {
    const a = await anims(preset);
    const props = [...new Set(a.map((x) => x.p))].sort();
    check(`${tag}: preset ${preset}: ${want.join(', ') || 'nothing'} moves`, JSON.stringify(props) === JSON.stringify([...want].sort()), a);
    if (preset === 'pop' || preset === 'rise') check(`${tag}: preset ${preset}: the richer, longer opening`, a.every((x) => x.d === (preset === 'pop' ? 260 : 320)), a);
    await settle();
  }
  // Closing: short, then hidden and out of the window's way.
  await anims('slide');
  await settle();
  const closing = await page.evaluate((B) => { window.tips.get('c').hide(); return document.querySelector(B).getAnimations().filter((a) => a.transitionProperty === 'opacity').map((a) => a.effect.getTiming().duration); }, B);
  check(`${tag}: a closing fades in 100 ms`, closing.length === 1 && closing[0] === 100, closing);
  await settle();
  // No layout while it runs (Chrome: the layout count over the animation's frames).
  if (name === 'chrome') {
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Performance.enable');
    const count = async () => (await cdp.send('Performance.getMetrics')).metrics.find((m) => m.name === 'LayoutCount').value;
    // Layouts while each preset runs a whole second (its duration set long by its variable), against the same second with
    // the bubble still: at most one more (the moving box's overflow settled once, at its end) — never one per frame.
    const over = async (animation) => {
      await page.evaluate(() => window.tips.get('c')?.destroy());
      await settle();
      await page.evaluate((animation) => {
        for (const v of ['--dzt-tooltip-open-duration', '--dzt-tooltip-pop-duration', '--dzt-tooltip-rise-duration']) document.documentElement.style.setProperty(v, '1000ms');
        window.tip('c', { animation });
      }, animation);
      await frames(page);
      const l0 = await count();
      await page.waitForTimeout(1100);
      const n = (await count()) - l0;
      await page.evaluate(() => document.documentElement.removeAttribute('style'));
      return n;
    };
    const still = await over('none');
    for (const preset of ['fade', 'scale', 'slide', 'pop', 'rise']) {
      const moving = await over(preset);
      check(`${tag}: ${preset}: no layout per frame while it runs a second (${moving} against ${still} still)`, moving <= still + 1, { moving, still });
    }
    await cdp.detach();
    await settle();
  }
  // Reduced motion: nothing; with reducedMotion 'fade', the opacity only.
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const still = await anims('pop');
  check(`${tag}: reduced motion: no animation`, still.length === 0, still);
  const faded = await anims('pop', { reducedMotion: 'fade' });
  check(`${tag}: reduced motion with reducedMotion 'fade': a short fade, opacity only`, faded.length === 1 && faded[0].p === 'opacity' && faded[0].d === 120, faded);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await settle();

  // The 12 placements on the centred button, still (animation none): the side on screen, the alignment, the arrow.
  const geo = (id, o) => page.evaluate(({ id, o, B }) => {
    window.tip(id, { animation: 'none', ...o });
    const el = document.querySelector(B);
    const r = (x) => { const b = x.getBoundingClientRect(); return { l: b.left, r: b.right, t: b.top, b: b.bottom }; };
    const arrow = getComputedStyle(el, '::before');
    const a = r(document.getElementById(id));
    const t = r(el);
    // The arrow's middle on screen: its box measured through a probe at its place.
    const probe = document.createElement('div');
    probe.style.cssText = `position:absolute;inset-inline-start:${arrow.insetInlineStart};inset-block-start:${arrow.insetBlockStart};inset-inline-end:${arrow.insetInlineEnd};inset-block-end:${arrow.insetBlockEnd};inline-size:${arrow.inlineSize};block-size:${arrow.blockSize}`;
    el.append(probe);
    const p = r(probe);
    probe.remove();
    return { side: el.dataset.side, a, t, p, win: { w: innerWidth, h: innerHeight } };
  }, { id, o, B });
  const near = (x, y) => Math.abs(x - y) < 1.5;
  const SIDES = rtl ? { left: 'inline-end', right: 'inline-start', start: 'inline-start', end: 'inline-end' } : { left: 'inline-start', right: 'inline-end', start: 'inline-start', end: 'inline-end' };
  for (const side of ['top', 'bottom', 'left', 'right', 'start', 'end']) for (const al of ['', '-start', '-end']) {
    if ((side === 'start' || side === 'end') && al) continue; // the line's sides: their alignments are the left / right ones'
    const g = await geo('c', { placement: `${side}${al}` });
    // Physical side on screen: start/end through the direction.
    const phys = side === 'start' ? (rtl ? 'right' : 'left') : side === 'end' ? (rtl ? 'left' : 'right') : side;
    const sideOk = { top: g.t.b <= g.a.t, bottom: g.t.t >= g.a.b, left: g.t.r <= g.a.l, right: g.t.l >= g.a.r }[phys];
    const logical = { top: 'block-start', bottom: 'block-end', ...SIDES }[side];
    let alignOk;
    if (phys === 'top' || phys === 'bottom') {
      // -start / -end: the line's start and end (left / right in French, right / left in Arabic).
      const st = rtl ? near(g.t.r, g.a.r) : near(g.t.l, g.a.l);
      const en = rtl ? near(g.t.l, g.a.l) : near(g.t.r, g.a.r);
      alignOk = al === '-start' ? st : al === '-end' ? en : near((g.t.l + g.t.r) / 2, (g.a.l + g.a.r) / 2);
    } else alignOk = al === '-start' ? near(g.t.t, g.a.t) : al === '-end' ? near(g.t.b, g.a.b) : near((g.t.t + g.t.b) / 2, (g.a.t + g.a.b) / 2);
    // The arrow points at the anchor: its middle over the anchor along the other axis.
    const arrowOk = phys === 'top' || phys === 'bottom' ? (g.p.l + g.p.r) / 2 >= g.a.l && (g.p.l + g.p.r) / 2 <= g.a.r : (g.p.t + g.p.b) / 2 >= g.a.t && (g.p.t + g.p.b) / 2 <= g.a.b;
    check(`${tag}: placement ${side}${al}: on the ${phys}, aligned, the arrow at the anchor`, g.side === logical && sideOk && alignOk && arrowOk, g);
  }
  // A flip at each edge, and none with flip: false; kept inside the window.
  const inside = (g) => g.t.l >= -0.5 && g.t.r <= g.win.w + 0.5 && g.t.t >= -0.5 && g.t.b <= g.win.h + 0.5;
  for (const [id, placement, want] of [['top', 'top', 'block-end'], ['bottom', 'bottom', 'block-start'], ['lft', 'left', rtl ? 'inline-start' : 'inline-end'], ['rgt', 'right', rtl ? 'inline-end' : 'inline-start']]) {
    const g = await geo(id, { placement });
    check(`${tag}: at the ${id} edge, ${placement} flips to ${want}, inside the window`, g.side === want && inside(g), g);
    const kept = await geo(id, { placement, flip: false });
    check(`${tag}: at the ${id} edge, flip: false keeps ${placement}`, kept.side !== want, kept);
  }
  await page.evaluate(() => { for (const h of window.tips.values()) h.destroy(); });

  // The app's own animation through the hook (CSS keyframes by the Web Animations API), with an app shape: told open then
  // close, the bubble kept drawn until its closing animation has finished; the shape drawn, no box, no arrow.
  const hooked = await page.evaluate(async (B) => {
    const phases = [];
    window.tip('c', {
      shape: 'M0 0 H100 V80 H60 L50 100 L40 80 H0 Z',
      animate: (el, phase, info) => {
        phases.push(`${phase}:${info.side}:${info.reduced}:${!!info.shape}`);
        const k = [{ opacity: 0, scale: '0.6' }, { opacity: 1, scale: '1' }];
        return el.animate(phase === 'open' ? k : k.reverse(), { duration: 200, easing: 'ease-out' }).finished;
      },
    });
    const el = document.querySelector(B);
    await new Promise((r) => setTimeout(r, 300));
    // The shape's box stretched over the bubble (the path's own box may count its stroke's corners: Firefox).
    const svg = el.querySelector(':scope > svg.dzt-tip-shape').getBoundingClientRect();
    const path = el.querySelector(':scope > svg.dzt-tip-shape > path').getBoundingClientRect();
    const look = { bg: getComputedStyle(el).backgroundColor, arrow: getComputedStyle(el, '::before').display, fill: getComputedStyle(el.querySelector('svg path')).fill, w: svg.width, pw: path.width, h: path.height, box: el.getBoundingClientRect().width };
    window.tips.get('c').hide();
    await new Promise((r) => setTimeout(r, 100));
    const mid = !el.hidden;
    await new Promise((r) => setTimeout(r, 250));
    return { phases, look, mid, end: el.hidden };
  }, B);
  check(`${tag}: the app's keyframes through animate(): told open and close, kept drawn until its closing ends`, hooked.phases.length === 2 && hooked.phases[0].startsWith('open:') && hooked.phases[1].startsWith('close:') && hooked.mid && hooked.end, hooked);
  check(`${tag}: an app shape drawn over the bubble, no box, no arrow`, hooked.look.bg === 'rgba(0, 0, 0, 0)' && hooked.look.arrow === 'none' && hooked.look.fill !== 'none' && Math.abs(hooked.look.w - hooked.look.box) < 2 && hooked.look.h > 10, hooked.look);
  await page.evaluate(() => window.tips.get('c').destroy());

  // Cleaned HTML: the bold kept, no image, nothing ran.
  const h = await page.evaluate((B) => { window.tip('html', { content: { html: '<b>ok</b><img src="x" onerror="window.__hit=1"><script>window.__hit=1</script><a href="javascript:window.__hit=1">x</a>' } }); return document.querySelector(B).innerHTML; }, B);
  await page.waitForTimeout(100);
  check(`${tag}: HTML cleaned: the bold kept, no image, script or link, nothing ran`, h === '<b>ok</b>' && (await page.evaluate(() => window.__hit)) === undefined, h);
  await page.evaluate(() => window.tips.get('html').destroy());

  // The popover: click, the focus in; Escape, the focus back; a press outside; code; Tab past its end; nested.
  await page.evaluate(() => { window.pop('pop', { content: window.form, label: 'Note' }); window.pop('pop2', { content: 'Autre' }); });
  await page.click('#pop');
  const o1 = await page.evaluate(() => ({ dlg: document.querySelector('.dzt-popover')?.getAttribute('role'), exp: document.getElementById('pop').getAttribute('aria-expanded'), ctl: document.getElementById('pop').getAttribute('aria-controls') === document.querySelector('.dzt-popover')?.id, focus: document.activeElement?.className }));
  check(`${tag}: popover by click: a dialog, expanded, controlled, the focus in its field`, o1.dlg === 'dialog' && o1.exp === 'true' && o1.ctl && o1.focus === 'note', o1);
  await page.keyboard.press('Escape');
  const o2 = await page.evaluate(() => ({ open: !!document.querySelector('.dzt-popover:not([hidden])'), exp: document.getElementById('pop').getAttribute('aria-expanded'), focus: document.activeElement?.id }));
  check(`${tag}: Escape closes it, the focus back on its trigger`, !o2.open && o2.exp === 'false' && o2.focus === 'pop', o2);
  await settle();
  await page.click('#pop');
  await page.mouse.click(5, 690);
  check(`${tag}: a press outside closes it`, !(await page.evaluate(() => window.pops.get('pop').isOpen)));
  await page.evaluate(() => window.pops.get('pop').open());
  const byCode = await page.evaluate(() => { const was = window.pops.get('pop').isOpen; window.pops.get('pop').close(); return { was, now: window.pops.get('pop').isOpen, focus: document.activeElement?.id }; });
  check(`${tag}: open() and close() by code, the focus back from inside`, byCode.was && !byCode.now && byCode.focus === 'pop', byCode);
  await settle();
  // From its last control (WebKit's Tab skips buttons: the focus put there), Tab: on to what follows the trigger.
  await page.click('#pop');
  await page.evaluate(() => document.querySelector('.dzt-popover .ok').focus());
  await page.keyboard.press('Tab');
  const tabbed = await page.evaluate(() => ({ open: window.pops.get('pop').isOpen, focus: document.activeElement?.id || document.activeElement?.className }));
  check(`${tag}: Tab past its last control closes it, the focus on what follows its trigger`, !tabbed.open && tabbed.focus === 'pop2', tabbed);
  await page.click('#pop');
  await page.keyboard.press('Shift+Tab');
  const back = await page.evaluate(() => ({ open: window.pops.get('pop').isOpen, focus: document.activeElement?.id }));
  check(`${tag}: Shift+Tab before its first control closes it, the focus on its trigger`, !back.open && back.focus === 'pop', back);
  await settle();
  await page.evaluate(() => window.pops.get('pop').open());
  const nested = await page.evaluate(() => {
    const inner = document.querySelector('.dzt-popover .inner');
    const h = window.popover(inner, { content: 'Encore', group: 'default' });
    h.open();
    const both = window.pops.get('pop').isOpen && h.isOpen;
    window.pops.get('pop2').open();
    const r = { both, after: window.pops.get('pop').isOpen || h.isOpen, other: window.pops.get('pop2').isOpen };
    window.pops.get('pop2').close();
    return r;
  });
  check(`${tag}: a popover nested in another keeps it; another in the group closes both`, nested.both && !nested.after && nested.other, nested);
  await settle();

  // The grid with tooltips(): a header button names itself, a cell's HTML cleaned, a cell's popover about its row.
  const head = await page.evaluate(() => {
    const b = document.querySelector('.dzg-hcell[data-col=seed] .dzg-fbtn');
    b.dispatchEvent(new PointerEvent('pointerover', { bubbles: true, pointerType: 'mouse' }));
    const t = document.querySelector('.dzg .dzt-tooltip');
    return { shown: !t.hidden, text: t.textContent, label: b.getAttribute('aria-label') };
  });
  check(`${tag}: in the grid, the filter button's tooltip is its name`, head.shown && head.text === head.label, head);
  const cellHtml = await page.evaluate(() => {
    const c = document.querySelector('.dzg-layer .dzg-row[aria-rowindex="3"] .dzg-cell[data-col=seed]');
    c.dispatchEvent(new PointerEvent('pointerover', { bubbles: true, pointerType: 'mouse' }));
    return document.querySelector('.dzg .dzt-tooltip').innerHTML;
  });
  check(`${tag}: in the grid, a cell's HTML tooltip cleaned`, /^<b>[^<]+<\/b>$/.test(cellHtml) && (await page.evaluate(() => window.__hit)) === undefined, cellHtml);
  await page.click('.dzg-layer .dzg-row[aria-rowindex="4"] .act');
  const about = await page.evaluate(() => ({ text: document.querySelector('.dzt-popover .about')?.textContent, seed: window.grid.api.rowAt?.(2)?.seed }));
  check(`${tag}: a cell's action icon opens a popover about its row`, /2$/.test(about.text ?? ''), about);

  // axe with a tooltip and a popover open.
  if (name === 'chrome') {
    await page.evaluate(() => window.tip('c', { animation: 'none' }));
    await settle();
    await page.addScriptTag({ content: AXE });
    const v = await page.evaluate(async () => (await window.axe.run(document.body, { runOnly: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'] })).violations.map((x) => `${x.id}: ${x.nodes.map((n) => n.target).join(' ')}`));
    check(`${tag}: tooltips and popovers, axe finds nothing`, v.length === 0, v);
  }
  await shapesMorph(page, tag, cfg, name, B, settle);
  await waitingAndScheme(page, tag, cfg, B, settle);
  check(`${tag}: tooltips page: nothing told`, (await page.evaluate(() => window.told.length)) === 0, await page.evaluate(() => window.told));
}


/**
 * A screenshot of a region read back in the page (a canvas): the box of the pixels near `rgb` (the bubble's fill), and
 * whether each of `points` (page coordinates) is that colour. Looks, not computed styles: what the user sees.
 */
async function pixels(page, box, rgb, points = []) {
  const shot = await page.screenshot({ clip: box });
  return page.evaluate(async ({ data, box, rgb, points }) => {
    const img = await createImageBitmap(await (await fetch(`data:image/png;base64,${data}`)).blob());
    const c = document.createElement('canvas');
    c.width = img.width;
    c.height = img.height;
    const x = c.getContext('2d');
    x.drawImage(img, 0, 0);
    const d = x.getImageData(0, 0, c.width, c.height).data;
    const k = c.width / box.width;
    const near = (i) => Math.abs(d[i] - rgb[0]) < 14 && Math.abs(d[i + 1] - rgb[1]) < 14 && Math.abs(d[i + 2] - rgb[2]) < 14;
    let l = Infinity, t = Infinity, r = -Infinity, b = -Infinity, n = 0;
    for (let y = 0; y < c.height; y++) for (let i = 0; i < c.width; i++) if (near((y * c.width + i) * 4)) { n++; l = Math.min(l, i); r = Math.max(r, i); t = Math.min(t, y); b = Math.max(b, y); }
    const at = points.map(([px, py]) => near((Math.round((py - box.y) * k) * c.width + Math.round((px - box.x) * k)) * 4));
    return { n, l: box.x + l / k, r: box.x + (r + 1) / k, t: box.y + t / k, b: box.y + (b + 1) / k, at };
  }, { data: shot.toString('base64'), box, rgb, points });
}

/**
 * (11d) Ready-made shapes and the morph preset (tooltips-popovers.md 7, 20, 21; owner 2026-11-14 « ok »): on each side
 * (mirrored in Arabic), the morph's frames held still and looked at — the first a pill at the anchor's side, 60 % × 45 %
 * of the bubble at the arrow, the arrow already drawn, the words not yet; the middle between; the end the whole bubble
 * with its words — then its closing (the content first, the shape back, 180 ms in all); the shapes' looks (the pill's
 * ends, the ticket's notches, the bubble's tail across its edge at the anchor, the arrow kept or not); reduced motion;
 * no layout per frame; and a grid column's `tooltip: { when: 'truncated', shape: 'bubble', animation: 'morph' }` — by
 * hover on a cut cell only, and by keyboard focus. `SHOTS=dir` keeps the frames, to set beside the owner's capture.
 */
async function shapesMorph(page, tag, cfg, name, B, settle) {
  const rtl = cfg.lang === 'ar';
  const shoot = async (file, box) => { if (SHOTS) await page.screenshot({ path: `${SHOTS}/${tag.replace(/ /g, '-')}-${file}.png`, clip: box }); };
  const fresh = async () => { await page.evaluate(() => { for (const h of window.tips.values()) h.destroy(); window.tips.clear(); }); await settle(); };
  /** Shown, every animation held at `t` ms (the first frame: 0). */
  const held = (o, t) => page.evaluate(({ o, t, B }) => {
    window.tip('c', o);
    const el = document.querySelector(B);
    const all = el.getAnimations({ subtree: true });
    // The bubble's own fade-in finished: the frame's shape seen as drawn (its first frames are see-through).
    for (const a of all) { a.pause(); a.currentTime = a.transitionProperty === 'opacity' ? 1e4 : t; }
    const r = el.getBoundingClientRect();
    const tail = getComputedStyle(el, '::before');
    return {
      side: el.dataset.side, names: all.map((a) => a.animationName ?? a.transitionProperty).sort(), color: getComputedStyle(el).color,
      fill: getComputedStyle(el, '::after').backgroundColor, box: { x: r.left, y: r.top, w: r.width, h: r.height },
      at: parseFloat(el.style.getPropertyValue('--dzt-tip-at')), tail: tail.display, rotate: tail.rotate,
    };
  }, { o, t, B });
  const seek = (t) => page.evaluate(({ t, B }) => { for (const a of document.querySelector(B).getAnimations({ subtree: true })) if (a.transitionProperty !== 'opacity') a.currentTime = t; }, { t, B });
  const rgbOf = (c) => c.match(/[\d.]+/g).slice(0, 3).map(Number);
  const around = (b) => ({ x: Math.max(0, b.x - 16), y: Math.max(0, b.y - 16), width: b.w + 32, height: b.h + 32 });
  const alpha = (c) => (c.startsWith('rgba') ? Number(c.match(/[\d.]+/g)[3]) : 1);

  for (const placement of ['bottom', 'top', 'end', 'start']) {
    await fresh();
    const h = await held({ animation: 'morph', shape: 'bubble', tone: 'success', placement }, 0);
    const block = h.side.startsWith('block');
    // The arrow's place on screen along the bubble's edge (`--dzt-tip-at` from the line's start; in Arabic from the right).
    const ax = block ? (rtl ? h.box.x + h.box.w - h.at : h.box.x + h.at) : null;
    const ay = block ? null : h.box.y + h.at;
    const rgb = rgbOf(h.fill);
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
    const p0 = await pixels(page, around(h.box), rgb);
    await shoot(`morph-${placement}-0`, around(h.box));
    // The pill: about 60 % × 45 % of the bubble (its tail beside it), at the arrow, against the side it opened on.
    const physical = { 'block-end': 'top', 'block-start': 'bottom', 'inline-end': rtl ? 'right' : 'left', 'inline-start': rtl ? 'left' : 'right' }[h.side];
    const pw = p0.r - p0.l;
    const ph = p0.b - p0.t;
    const atSide = { top: p0.t < h.box.y, bottom: p0.b > h.box.y + h.box.h, left: p0.l < h.box.x, right: p0.r > h.box.x + h.box.w }[physical];
    const small = block ? pw < h.box.w * 0.7 && ph < h.box.h * 0.85 : pw < h.box.w * 0.62 && ph <= h.box.h * 0.85;
    const centred = block ? Math.abs((p0.l + p0.r) / 2 - ax) < h.box.w * 0.2 + 2 : Math.abs((p0.t + p0.b) / 2 - ay) < h.box.h * 0.35 + 2;
    check(`${tag}: morph ${placement} (${h.side}): its first frame a pill at the arrow, the tail already there, no words yet`, p0.n > 20 && small && atSide && centred && h.tail !== 'none' && alpha(h.color) === 0 && JSON.stringify(h.names) === JSON.stringify(['dzt-tip-morph', 'dzt-tip-words', 'opacity']), { h, p0, physical });
    await seek(175);
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
    const p1 = await pixels(page, around(h.box), rgb);
    await shoot(`morph-${placement}-mid`, around(h.box));
    check(`${tag}: morph ${placement}: halfway, between the pill and the bubble`, p1.r - p1.l > pw && p1.r - p1.l <= h.box.w + 12, { p0, p1 });
    await seek(5000);
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
    const p2 = await pixels(page, around(h.box), rgb);
    await shoot(`morph-${placement}-end`, around(h.box));
    const end = await page.evaluate((B) => ({ color: getComputedStyle(document.querySelector(B)).color, clip: getComputedStyle(document.querySelector(B), '::after').clipPath }), B);
    // The whole bubble and its tail: as wide as the bubble (less its rounded corners' antialiasing), its words drawn.
    const whole = block ? p2.r - p2.l >= h.box.w - 2 && p2.b - p2.t >= h.box.h + 2 : p2.r - p2.l >= h.box.w + 2 && p2.b - p2.t >= h.box.h - 2;
    check(`${tag}: morph ${placement}: its end, the whole bubble with its tail, its words`, whole && alpha(end.color) === 1 && end.clip === 'inset(0px)', { p2, end, box: h.box });
    // The tail turned toward the anchor (the reading direction mirrors the inline sides).
    const turn = { 'block-end': 'none', 'block-start': '180deg', 'inline-end': rtl ? '90deg' : '-90deg', 'inline-start': rtl ? '-90deg' : '90deg' }[h.side];
    check(`${tag}: bubble ${placement}: its tail turned to the anchor (${turn})`, h.rotate === turn, h.rotate);
  }
  // Closing: the content first, then the shape back to the pill, the bubble fading last; 180 ms in all, then hidden.
  await page.evaluate(({ B }) => { for (const a of document.querySelector(B).getAnimations({ subtree: true })) a.finish(); }, { B });
  await settle();
  const closing = await page.evaluate((B) => {
    window.tips.get('c').hide();
    const el = document.querySelector(B);
    return el.getAnimations({ subtree: true }).filter((a) => a.transitionProperty && a.transitionProperty !== 'display' && a.transitionProperty !== 'overlay')
      .map((a) => ({ p: a.transitionProperty, pe: a.effect.pseudoElement, end: Math.round(a.effect.getTiming().delay + a.effect.getTiming().duration) }));
  }, B);
  const last = Math.max(...closing.map((c) => c.end));
  check(`${tag}: morph closing: the shape back to the pill, the bubble fading, 180 ms in all`, closing.some((c) => c.p === 'clip-path' && c.pe === '::after') && closing.some((c) => c.p === 'opacity') && last <= 181 && last >= 170, closing);
  await page.waitForTimeout(400);
  check(`${tag}: morph closing: then hidden`, await page.evaluate((B) => document.querySelector(B).hidden, B));

  // The shapes' looks, still: the pill's ends, the ticket's notches, the bubble's tail across its edge at the anchor.
  for (const shape of ['pill', 'ticket', 'bubble']) {
    await fresh();
    const s = await page.evaluate(({ shape, B }) => {
      window.tip('c', { animation: 'none', shape, tone: 'danger', placement: 'bottom' });
      const el = document.querySelector(B);
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      // The ticket's fill is its gradients': its colour read through a probe inside it (its colour scheme, its tone).
      const probe = document.createElement('i');
      probe.style.color = 'var(--dzt-tip-bg)';
      el.append(probe);
      const fill = getComputedStyle(probe).color;
      probe.remove();
      return { box: { x: r.left, y: r.top, w: r.width, h: r.height }, at: parseFloat(el.style.getPropertyValue('--dzt-tip-at')), radius: cs.borderStartStartRadius, filter: cs.filter, image: cs.backgroundImage, bg: shape === 'ticket' ? fill : cs.backgroundColor, arrow: getComputedStyle(el, '::before').display };
    }, { shape, B });
    const fillRgb = s.bg;
    const { x, y, w, h } = s.box;
    const ax = rtl ? x + w - s.at : x + s.at;
    // Corner (2 px in), the middle of the top edge (2 px in), the tail's middle above the edge, inside by the start edge.
    // The middle point by the start edge, clear of the words (a font's glyphs would cover the bubble's middle).
    const pts = [[x + 1.5, y + 1.5], [x + w / 2, y + 2], [ax, y - 3], [x + 4, y + h / 2]];
    const p = await pixels(page, around(s.box), rgbOf(fillRgb), pts);
    await shoot(`shape-${shape}`, around(s.box));
    const [corner, edge, tail, middle] = p.at;
    const ok = {
      pill: s.radius === '999px' && s.arrow !== 'none' && !corner && edge && tail,
      ticket: (s.image.match(/radial-gradient/g) ?? []).length === 4 && s.arrow !== 'none' && !corner && edge,
      bubble: s.radius === '12px' && s.arrow !== 'none' && !corner && edge && tail,
    }[shape];
    check(`${tag}: shape ${shape}: its outline as drawn (corner ${corner ? 'filled' : 'open'}, tail ${tail ? 'drawn' : 'none'}), the edge and shadow a drop-shadow`, ok && middle && s.filter.includes('drop-shadow'), { s, p });
  }

  // Reduced motion: no animation, the bubble whole at once; `reducedMotion: 'fade'`: the opacity only.
  await fresh();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const still = await page.evaluate((B) => { window.tip('c', { animation: 'morph', shape: 'bubble' }); const el = document.querySelector(B); return { a: el.getAnimations({ subtree: true }).map((a) => a.animationName ?? a.transitionProperty).filter((n) => n !== 'display' && n !== 'overlay'), clip: getComputedStyle(el, '::after').clipPath }; }, B);
  check(`${tag}: morph under reduced motion: nothing moves, the bubble whole at once`, still.a.length === 0 && still.clip === 'inset(0px)', still);
  await fresh();
  const fade = await page.evaluate((B) => { window.tip('c', { animation: 'morph', reducedMotion: 'fade' }); return document.querySelector(B).getAnimations({ subtree: true }).map((a) => a.animationName ?? a.transitionProperty).filter((n) => n !== 'display' && n !== 'overlay'); }, B);
  check(`${tag}: morph under reduced motion with reducedMotion 'fade': the opacity only`, JSON.stringify(fade) === '["opacity"]', fade);
  await page.emulateMedia({ reducedMotion: 'no-preference' });

  // No layout per frame while the morph runs a second (Chrome's layout count; as the presets above).
  if (name === 'chrome') {
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Performance.enable');
    const count = async () => (await cdp.send('Performance.getMetrics')).metrics.find((m) => m.name === 'LayoutCount').value;
    const over = async (animation) => {
      await fresh();
      await page.evaluate((animation) => {
        const r = document.documentElement.style;
        r.setProperty('--dzt-tooltip-morph-duration', '1000ms');
        r.setProperty('--dzt-tooltip-morph-content-delay', '700ms');
        r.setProperty('--dzt-tooltip-morph-content-duration', '300ms');
        window.tip('c', { animation, shape: 'bubble' });
      }, animation);
      await frames(page);
      const l0 = await count();
      await page.waitForTimeout(1100);
      const n = (await count()) - l0;
      await page.evaluate(() => document.documentElement.removeAttribute('style'));
      return n;
    };
    const quiet = await over('none');
    const moving = await over('morph');
    check(`${tag}: morph: no layout per frame while it runs a second (${moving} against ${quiet} still)`, moving <= quiet + 1, { moving, quiet });
    await cdp.detach();
  }
  await fresh();

  // A grid column in one line: `{ when: 'truncated', shape: 'bubble', animation: 'morph' }` — a cut cell's text as shown,
  // in the morph bubble; a cell that fits, none; the keyboard opens it at once.
  const T = '.dzg .dzt-tooltip';
  const cellAt = (row) => `.dzg-layer .dzg-row[aria-rowindex="${row}"] .dzg-cell[data-col=note]`;
  await page.mouse.move(2, 690);
  await settle();
  await page.hover(cellAt(3));
  await page.waitForTimeout(500);
  const cut = await page.evaluate(({ T, c }) => { const t = document.querySelector(T); return { shown: !t.hidden, text: t.textContent, cell: document.querySelector(c).textContent, shape: t.dataset.shape, anim: t.dataset.animation, tone: t.dataset.tone, op: getComputedStyle(t).opacity, color: getComputedStyle(t).color }; }, { T, c: cellAt(3) });
  check(`${tag}: a column's one-line tooltip: a cut cell's text as shown, in the morph bubble`, cut.shown && cut.text === cut.cell && cut.shape === 'bubble' && cut.anim === 'morph' && cut.tone === 'neutral' && cut.op === '1' && alpha(cut.color) === 1, cut);
  await page.mouse.move(2, 690);
  await settle();
  await page.hover(cellAt(2));
  await page.waitForTimeout(500);
  check(`${tag}: a cell that fits shows none`, await page.evaluate((T) => document.querySelector(T).hidden, T));
  await page.mouse.move(2, 690);
  await settle();
  // A click on a short note (no tooltip), then a key up onto a cut one.
  await page.click(cellAt(6));
  await page.keyboard.press('ArrowUp');
  await page.waitForTimeout(450);
  const keyed = await page.evaluate(({ T, c }) => { const t = document.querySelector(T); return { shown: !t.hidden, text: t.textContent, cell: document.querySelector(c).textContent, shape: t.dataset.shape, focus: document.activeElement === document.querySelector(c) }; }, { T, c: cellAt(5) });
  check(`${tag}: the keyboard's focus on a cut cell opens its bubble at once`, keyed.shown && keyed.focus && keyed.text === keyed.cell && keyed.shape === 'bubble', keyed);
  await page.keyboard.press('Escape');
  await page.evaluate(() => document.activeElement?.blur?.());
  await settle();
  await morphPacing(page, tag, name, cellAt(3), T, settle);
}

/**
 * (11e) The morph as quick as an app's GSAP one (owner 2026-11-14 « pas aussi fluide que GSAP, elle prend du temps pour
 * s'afficher »; measured against it in the owner's app: GSAP's first frame one frame after its delay, its words half
 * drawn 200 ms later, settled at 350 ms). A real hover on a cut cell, the grid's delay 300 ms, every frame's
 * `requestAnimationFrame` time read: the bubble's first visible frame no later than the delay and one frame; its words
 * half drawn within 200 ms of it; all still within 380 ms; no frame longer than 50 ms (Chrome: no long animation frame
 * either) and, in Chrome, no layout while it runs.
 */
async function morphPacing(page, tag, name, cell, T, settle) {
  const DELAY = 300;
  await page.evaluate((d) => window.grid.update({ tooltips: { delayMs: d, header: true, html: window.safeHtml } }), DELAY);
  await page.mouse.move(2, 690);
  await settle();
  const box = await page.evaluate((c) => { const r = document.querySelector(c).getBoundingClientRect(); return { x: r.left + 8, y: r.top + r.height / 2 }; }, cell);
  await page.evaluate(({ T, DELAY }) => {
    const w = window;
    const rec = (w.__pace = { frames: [], t0: null, loaf: [] });
    try { (rec.po = new PerformanceObserver((l) => rec.loaf.push(...l.getEntries().map((e) => Math.round(e.duration))))).observe({ type: 'long-animation-frame' }); } catch { /* not Chrome */ }
    document.addEventListener('pointerover', (e) => { rec.t0 ??= e.target.closest('.dzg-cell') ? performance.now() : null; }, { capture: true });
    const al = (c) => (c.startsWith('rgba') ? Number(c.match(/[\d.]+/g)[3]) : 1);
    const loop = (now) => {
      const t = document.querySelector(T);
      const cs = getComputedStyle(t);
      const on = !t.hidden && cs.display !== 'none';
      rec.frames.push({ now, op: on ? Number(cs.opacity) : 0, words: on ? Number(cs.opacity) * al(cs.color) : 0, sig: on ? [cs.opacity, cs.color, getComputedStyle(t, '::after').clipPath].join() : '' });
      if (now - (rec.start ??= now) < DELAY + 900) requestAnimationFrame(loop); else rec.done = true;
    };
    requestAnimationFrame(loop);
  }, { T, DELAY });
  let cdp = null;
  if (name === 'chrome') { cdp = await page.context().newCDPSession(page); await cdp.send('Performance.enable'); }
  const layouts = async () => (cdp ? (await cdp.send('Performance.getMetrics')).metrics.find((m) => m.name === 'LayoutCount').value : 0);
  await page.mouse.move(box.x, box.y);
  await page.waitForFunction(() => window.__pace.frames.some((f) => f.op > 0.01));
  const l0 = await layouts();
  await page.waitForFunction(() => window.__pace.done, null, { timeout: 5000 });
  const l1 = await layouts();
  if (cdp) await cdp.detach();
  const { frames, t0, loaf } = await page.evaluate(() => { window.__pace.po?.disconnect(); const { frames, t0, loaf } = window.__pace; return { frames, t0, loaf }; });
  const deltas = frames.slice(1).map((f, i) => f.now - frames[i].now);
  const frame = [...deltas].sort((a, b) => a - b)[deltas.length >> 1];
  const fi = frames.findIndex((f) => f.op > 0.01);
  const wi = frames.findIndex((f) => f.words >= 0.5);
  let last = fi;
  for (let i = fi + 1; i < frames.length; i++) if (frames[i].sig !== frames[i - 1].sig) last = i;
  const m = { t0: Math.round(t0), frame: Math.round(frame * 10) / 10, first: Math.round(frames[fi]?.now - t0), words: Math.round(frames[wi]?.now - frames[fi]?.now), settled: Math.round(frames[last]?.now - frames[fi]?.now), maxGap: Math.round(Math.max(...deltas.slice(Math.max(0, fi - 1), last + 1))), loaf, layouts: l1 - l0 };
  if (process.env.VERBOSE) console.log(`     ${tag} morph pacing`, JSON.stringify(m), process.env.VERBOSE === "2" ? JSON.stringify(frames.slice(Math.max(0, fi - 3), fi + 4).map((f) => [Math.round(f.now - t0), f.op, f.sig]))  : "");
  check(`${tag}: morph by hover: its first visible frame within the grid's delay and one frame (${m.first} ms, delay ${DELAY})`, t0 != null && fi >= 0 && m.first <= DELAY + frame + 4, m);
  check(`${tag}: morph by hover: its words half drawn within 200 ms of its first frame (${m.words} ms), all still within 380 ms (${m.settled} ms)`, m.words <= 200 && m.settled <= 380, m);
  check(`${tag}: morph by hover: no long frame while it opens (longest ${m.maxGap} ms${name === 'chrome' ? `, ${loaf.length} long animation frames, ${m.layouts} layouts` : ''})`, m.maxGap <= 50 && loaf.length === 0 && (name !== 'chrome' || m.layouts <= 1), m);
  await page.evaluate(() => window.grid.update({ tooltips: { delayMs: 0, header: true, html: window.safeHtml } }));
  await page.mouse.move(2, 690);
  await settle();
}

/**
 * (11c) 1.12.0 review (tooltips-popovers.md 18–19, owner 2026-11-14 « oui »): a tooltip waiting for its delay never
 * appears late — a click on its trigger, the trigger disabled, a popover opened from it by code, a click on a grid cell;
 * and the page's bubbles take the scheme of their trigger's context as the grid does — the page's `data-theme`, a
 * wrapper's, a page switching while a popover is open, Tailwind 3's `.dark` class through tailwind3.css's mapping.
 */
async function waitingAndScheme(page, tag, cfg, B, settle) {
  const { dark } = cfg;
  const away = async () => { await page.mouse.move(2, 690); await settle(); };
  const shown = () => page.evaluate((B) => !(document.querySelector(B)?.hidden ?? true), B);
  await page.evaluate(() => { for (const h of window.tips.values()) h.destroy(); for (const h of window.pops.values()) h.destroy(); window.tips.clear(); window.pops.clear(); });
  await away();
  // A click on the trigger while its tooltip waits (400 ms): never shown.
  await page.evaluate(() => window.tips.set('c', window.tooltip(document.getElementById('c'), { content: 'Attente', delayMs: 400 })));
  await page.hover('#c');
  await page.mouse.down();
  await page.mouse.up();
  await page.waitForTimeout(700);
  check(`${tag}: a click on the trigger while its tooltip waits: never shown`, !(await shown()));
  await away();
  // The trigger disabled while it waits.
  await page.hover('#c');
  await page.evaluate(() => { document.getElementById('c').disabled = true; });
  await page.waitForTimeout(700);
  check(`${tag}: the trigger disabled while its tooltip waits: never shown`, !(await shown()));
  await page.evaluate(() => { document.getElementById('c').disabled = false; });
  await away();
  // A popover opened by code from the same trigger while its tooltip waits: the popover alone.
  await page.evaluate(() => {
    window.tips.set('pop2', window.tooltip(document.getElementById('pop2'), { content: 'Attente', delayMs: 400 }));
    window.pops.set('pop2', window.popover(document.getElementById('pop2'), { content: 'Formulaire', openOn: 'manual' }));
  });
  await page.hover('#pop2');
  await page.evaluate(() => window.pops.get('pop2').open());
  await page.waitForTimeout(700);
  const both = { tip: await shown(), pop: await page.evaluate(() => window.pops.get('pop2').isOpen) };
  check(`${tag}: a popover opened from the trigger while its tooltip waits: the popover alone`, !both.tip && both.pop, both);
  await page.evaluate(() => window.pops.get('pop2').close());
  await away();
  // The grid: a click on a cell while its tooltip waits.
  await page.evaluate(() => window.grid.update({ tooltips: { delayMs: 400, header: true, html: window.safeHtml } }));
  await page.hover('.dzg-layer .dzg-row[aria-rowindex="5"] .dzg-cell[data-col=grams]');
  await page.mouse.down();
  await page.mouse.up();
  await page.waitForTimeout(700);
  check(`${tag}: a click on a grid cell while its tooltip waits: never shown`, await page.evaluate(() => document.querySelector('.dzg .dzt-tooltip').hidden));
  await page.evaluate(() => window.grid.update({ tooltips: { delayMs: 0, header: true, html: window.safeHtml } }));
  await away();

  // The scheme: a neutral tooltip's and a popover's surfaces, dark (luminance under .2) or light (over .5).
  const surfaces = (id) => page.evaluate(({ id, B }) => {
    for (const h of window.tips.values()) h.destroy();
    window.tips.clear();
    const t = window.tooltip(document.getElementById(id), { content: 'Schéma', tone: 'neutral', animation: 'none', delayMs: 0 });
    window.tips.set(id, t);
    t.show();
    const p = window.pops.get('pop') ?? window.popover(document.getElementById('pop'), { content: 'Bulle', openOn: 'manual', animation: 'none' });
    window.pops.set('pop', p);
    return { tip: getComputedStyle(document.querySelector(B)).backgroundColor, scheme: getComputedStyle(document.querySelector(B)).colorScheme };
  }, { id, B });
  const popBg = () => page.evaluate(() => getComputedStyle(window.pops.get('pop').el).backgroundColor);
  const isDark = (c) => lum(c) < 0.2;
  const isLight = (c) => lum(c) > 0.5;
  // The page's: html's data-theme in the dark runs, the system's (light) otherwise.
  const s = await surfaces('c');
  await page.evaluate(() => window.pops.get('pop').open());
  await frames(page);
  const p = await popBg();
  check(`${tag}: the page's tooltip and popover in the page's scheme (${dark ? 'dark' : 'light'})`, dark ? isDark(s.tip) && isDark(p) : isLight(s.tip) && isLight(p), { s, p });
  // The page switching while the popover is open: it follows at once.
  await page.evaluate((dark) => { document.documentElement.dataset.theme = dark ? 'light' : 'dark'; }, dark);
  await frames(page);
  const p2 = await popBg();
  check(`${tag}: the page switching scheme while a popover is open: it follows`, dark ? isLight(p2) : isDark(p2), p2);
  await page.evaluate((dark) => { if (dark) document.documentElement.dataset.theme = 'dark'; else delete document.documentElement.dataset.theme; }, dark);
  await page.evaluate(() => window.pops.get('pop').close());
  await settle();
  // A wrapper of its own (the other scheme): its trigger's bubble takes it, in the body and the top layer.
  await page.evaluate((dark) => {
    const w = document.createElement('div');
    w.id = 'wrap';
    w.dataset.theme = dark ? 'light' : 'dark';
    w.style.cssText = 'position:absolute;inset-block-start:520px;inset-inline-start:40px';
    w.innerHTML = '<button id="inwrap" type="button">Enveloppe</button>';
    document.querySelector('main').append(w);
  }, dark);
  const w = await surfaces('inwrap');
  const wp = await page.evaluate(() => {
    const h = window.popover(document.getElementById('inwrap'), { content: 'Bulle', openOn: 'manual', animation: 'none' });
    h.open();
    const bg = getComputedStyle(h.el).backgroundColor;
    h.destroy();
    return bg;
  });
  check(`${tag}: a wrapper's own scheme: its trigger's tooltip and popover take it`, dark ? isLight(w.tip) && isLight(wp) : isDark(w.tip) && isDark(wp), { w, wp });
  await page.evaluate(() => document.getElementById('wrap').remove());
  // Tailwind 3's class strategy: tailwind3.css's mapping (`.dark { --tz-color-scheme: dark }`), the class on html.
  if (!dark) {
    await page.evaluate(() => {
      const st = document.createElement('style');
      st.id = 'tw3dark';
      st.textContent = '@layer dzgrid.bridge { .dark { --tz-color-scheme: dark; } }';
      document.head.append(st);
      document.documentElement.classList.add('dark');
    });
    const t = await surfaces('c');
    check(`${tag}: Tailwind 3's .dark on html (tailwind3.css's mapping): the tooltip dark`, isDark(t.tip), t);
    await page.evaluate(() => { document.documentElement.classList.remove('dark'); document.getElementById('tw3dark').remove(); });
  }
  await page.evaluate(() => { for (const h of window.tips.values()) h.destroy(); for (const h of window.pops.values()) h.destroy(); window.tips.clear(); window.pops.clear(); });
  await settle();
}

/**
 * (11b) The Angular directives in a real build (packages/angular/browser, `?page=tips`: ngc, the linker, esbuild, as an
 * app ships): a template with its context and a component with its inputs in tooltips, cleaned HTML (Angular's
 * sanitizer, then DzGrid's), a popover holding a template whose `close()` closes it, a component in a popover, and a
 * grid cell's component opening a popover about its row. Once per browser and language.
 */
async function angularTips(name, lang) {
  const tag = `${name} angular ${lang}`;
  const b = await browser(name);
  try {
    const page = await b.newPage();
    await page.setViewportSize({ width: 900, height: 700 });
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(site.root(`packages/angular/browser/build/index.html?page=tips${lang === 'ar' ? '&lang=ar' : ''}`));
    await page.waitForFunction(() => window.fxReady === true || window.fxError, null, { timeout: 30000 });
    check(`${tag}: the fixture runs`, !(await page.evaluate(() => window.fxError)), await page.evaluate(() => window.fxError));
    const B = '.dzt-tooltip.dzt-float';
    // Away first (a tooltip the pointer rests on stays: it may cover the next button), past the grace and the fade.
    const hover = async (sel) => { await page.mouse.move(890, 690); await page.waitForTimeout(400); await page.hover(sel); await page.waitForFunction((B) => { const t = document.querySelector(B); return t && !t.hidden; }, B, { timeout: 3000 }).catch(() => {}); await page.waitForTimeout(350); };
    await hover('.fx-t1');
    const t1 = await page.evaluate((B) => { const t = document.querySelector(B); return { text: t.querySelector('.fx-in')?.textContent, tone: t.dataset.tone, anim: t.dataset.animation, op: getComputedStyle(t).opacity }; }, B);
    check(`${tag}: a template in a tooltip, its context drawn, toned, popped in`, t1.text === 'Ann' && t1.tone === 'success' && t1.anim === 'pop' && t1.op === '1', t1);
    await hover('.fx-t2');
    const t2 = await page.evaluate((B) => { const t = document.querySelector(B); const a = document.querySelector('.fx-t2').getBoundingClientRect(); const r = t.getBoundingClientRect(); return { text: t.querySelector('.fx-card')?.textContent, side: t.dataset.side, right: r.left >= a.right, made: window.fx.tipStats.made }; }, B);
    check(`${tag}: a component in a tooltip with its inputs, on the right`, t2.text === 'Ann · 3' && t2.right, t2);
    await hover('.fx-t3');
    await page.waitForTimeout(400);
    const t3 = await page.evaluate((B) => ({ html: document.querySelector(B).innerHTML, gone: window.fx.tipStats.gone, hit: window.__hit }), B);
    check(`${tag}: HTML through Angular's sanitizer and DzGrid's: the bold only, nothing ran; the component destroyed`, t3.html === '<b>Bold</b>' && t3.hit === undefined && t3.gone >= 1, t3);
    await page.mouse.move(890, 690);
    await page.click('.fx-p1');
    const p1 = await page.evaluate(() => ({ dlg: document.querySelector('.dzt-popover')?.getAttribute('aria-label'), focus: document.activeElement?.className }));
    check(`${tag}: a popover holding a template, named, the focus in its field`, p1.dlg === 'Note' && p1.focus === 'fx-note', p1);
    await page.click('.dzt-popover .fx-done');
    const p2 = await page.evaluate(() => ({ open: !!document.querySelector('.dzt-popover:not([data-closing])'), focus: document.activeElement?.className, closed: window.fx.tipStats.closed }));
    check(`${tag}: its template's close() closes it, the focus back on the trigger`, !p2.open && p2.focus === 'fx-p1' && p2.closed.at(-1) === 'code', p2);
    await page.waitForTimeout(300);
    await page.click('.fx-p2');
    check(`${tag}: a component in a popover`, (await page.evaluate(() => document.querySelector('.dzt-popover .fx-card')?.textContent)) === 'Bob · 7');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
    await page.click('.dzg-layer .dzg-row[aria-rowindex="4"] .fx-act');
    check(`${tag}: a grid cell's component opens a popover about its row`, (await page.evaluate(() => document.querySelector('.dzt-popover .fx-about')?.textContent)) === 'Seed 2');
    await page.evaluate(() => { const v = document.querySelector('.dzg-viewport'); v.scrollTop = 3000; });
    await page.waitForTimeout(300);
    check(`${tag}: scrolled until its row is recycled, that popover closes`, !(await page.evaluate(() => document.querySelector('.dzt-popover:not([data-closing])'))));
    check(`${tag}: no page error`, errors.length === 0, errors);
  } finally {
    await b.close().catch(() => {});
  }
}

async function run(name, cfg) {
  const { css, dark, lang, preflight } = cfg;
  const tag = `${name} ${css}${dark ? ' dark' : ''} ${lang}${preflight ? ' preflight' : ''}`;
  const b = await browser(name);
  try {
    const page = await b.newPage();
    await page.setViewportSize({ width: 900, height: 700 });
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await tipsChecks(page, tag, cfg, name);
    check(`${tag}: no page error`, errors.length === 0, errors);
    await page.close();
  } finally {
    await b.close().catch(() => {});
  }
  console.log(`done ${tag}: ${results.filter(Boolean).length} / ${results.length} so far`);
}

const only = process.argv.find((a) => a.startsWith('--only='))?.slice(7);
try {
  for (const name of ['chrome', 'firefox', 'webkit']) {
    if (only && only !== name) continue;
    for (const css of ['layered', 'unlayered']) for (const dark of [false, true]) for (const lang of ['fr', 'ar']) for (const preflight of [false, true]) {
      if (process.argv.includes('--first') && (css !== 'layered' || dark || lang !== 'fr' || preflight)) continue;
      await run(name, { css, dark, lang, preflight });
    }
  }
} finally {
  await site.close();
}
const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed} / ${results.length}`);
process.exit(failed ? 1 : 0);
