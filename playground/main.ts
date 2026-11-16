// The test page (owner 2026-11-16): one section per capability, its code shown. Made-up content only.
import { tooltip, popover, safeHtml, type PopoverHandle, type TooltipHandle, type TooltipPlacement } from '@dztooltip/core';
import { createGrid } from '@dzgrid/dom';
import { FR } from '@dzgrid/dom/locales/fr';
import { dzTooltips } from '@dztooltip/dzgrid';

const $ = <T extends HTMLElement = HTMLElement>(id: string): T => document.getElementById(id) as T;
const make = <K extends keyof HTMLElementTagNameMap>(tag: K, props: Partial<HTMLElementTagNameMap[K]> = {}, ...kids: (Node | string)[]): HTMLElementTagNameMap[K] => {
  const el = Object.assign(document.createElement(tag), props);
  el.append(...kids);
  return el;
};
const button = (text: string, props: Partial<HTMLButtonElement> = {}) => make('button', { type: 'button', textContent: text, ...props });
/** The code shown under a section. */
const code = (name: string, text: string): void => {
  const el = document.querySelector(`[data-code="${name}"]`);
  if (el) el.textContent = text.trim();
};

// ---- The page: its table of contents, light / dark, left to right / right to left.
for (const s of document.querySelectorAll('main > section')) {
  const h = s.querySelector('h2')!;
  $('toc').append(make('li', {}, make('a', { href: `#${s.id}`, textContent: h.textContent ?? '' })));
}
const frameDoc = (): Document | null => $<HTMLIFrameElement>('frame').contentDocument;
const setTheme = (dark: boolean): void => {
  for (const d of [document, frameDoc()]) d?.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
  $('theme').setAttribute('aria-pressed', String(dark));
};
let rtl = false;
const setDir = (on: boolean): void => {
  rtl = on;
  for (const d of [document, frameDoc()]) d?.documentElement.setAttribute('dir', on ? 'rtl' : 'ltr');
  $('dir').setAttribute('aria-pressed', String(on));
  makeGrid();
};
$('theme').addEventListener('click', () => setTheme($('theme').getAttribute('aria-pressed') !== 'true'));
$('dir').addEventListener('click', () => setDir(!rtl));

// ---- Tones.
for (const tone of ['info', 'danger', 'success', 'warning', 'neutral'] as const) {
  const b = button(tone);
  $('tones').append(b);
  tooltip(b, { content: `Le ton « ${tone} » : un message de démonstration.`, tone });
}
code('tones', `
import { tooltip } from '@dztooltip/core';
tooltip(button, { content: 'Le ton « danger »…', tone: 'danger' }); // info, danger, success, warning, neutral
`);

// ---- The 12 placements and auto; a draggable anchor near the edges.
const PLACES: TooltipPlacement[] = ['top-start', 'top', 'top-end', 'left-start', 'auto', 'right-start', 'left', 'start', 'right', 'left-end', 'end', 'right-end', 'bottom-start', 'bottom', 'bottom-end'];
for (const p of PLACES) {
  const b = button(p);
  $('places').append(b);
  tooltip(b, { content: `placement: '${p}'`, placement: p, delayMs: 150 });
}
for (const p of ['auto', 'top', 'top-start', 'top-end', 'bottom', 'bottom-start', 'bottom-end', 'start', 'start-start', 'start-end', 'end', 'end-start', 'end-end'] as TooltipPlacement[]) {
  $('drag-place').append(make('option', { value: p, textContent: p }));
}
$<HTMLSelectElement>('drag-place').value = 'top';
const dragged = $('drag');
const dragLook = () => ({
  placement: $<HTMLSelectElement>('drag-place').value as TooltipPlacement,
  flip: $<HTMLInputElement>('drag-flip').checked,
  shift: (({ true: true, false: false, attached: 'attached' }) as const)[$<HTMLSelectElement>('drag-shift').value as 'true' | 'false' | 'attached'],
});
const dragPop = popover(dragged, {
  content: () => make('div', {}, make('strong', { textContent: 'Je suis l’ancre.' }), make('br'), 'Glissez-moi vers un bord.'),
  openOn: 'manual',
  ...dragLook(),
  onOpen: () => void ($('drag-log').textContent = 'Bulle ouverte'),
  onClose: (r) => void ($('drag-log').textContent = `Bulle fermée (${r})`),
});
$('drag-open').addEventListener('click', () => dragPop.open());
for (const id of ['drag-place', 'drag-flip', 'drag-shift']) $(id).addEventListener('change', () => (dragPop.update(dragLook()), dragPop.open()));
// Dragged by the pointer: moved by `translate` (no side named), the popover follows.
let grab: { x: number; y: number; tx: number; ty: number } | null = null;
let at = { x: 0, y: 0 };
dragged.addEventListener('pointerdown', (e) => {
  grab = { x: e.clientX, y: e.clientY, tx: at.x, ty: at.y };
  dragged.setPointerCapture(e.pointerId);
  dragPop.open();
});
dragged.addEventListener('pointermove', (e) => {
  if (!grab || !(e.buttons & 1)) return;
  at = { x: grab.tx + e.clientX - grab.x, y: grab.ty + e.clientY - grab.y };
  dragged.style.translate = `${at.x}px ${at.y}px`;
});
for (const t of ['pointerup', 'pointercancel', 'lostpointercapture']) dragged.addEventListener(t, () => (grab = null));
// The keyboard too: the arrows move it by 20 px.
dragged.addEventListener('keydown', (e) => {
  const step: Record<string, [number, number]> = { ArrowLeft: [-20, 0], ArrowRight: [20, 0], ArrowUp: [0, -20], ArrowDown: [0, 20] };
  const s = step[e.key];
  if (!s) return;
  e.preventDefault();
  at = { x: at.x + s[0], y: at.y + s[1] };
  dragged.style.translate = `${at.x}px ${at.y}px`;
  dragPop.open();
});
code('placements', `
tooltip(button, { content: 'Aide', placement: 'top-start' });   // 12 placements, ou 'auto'
const p = popover(anchor, { content, openOn: 'manual', placement: 'top', flip: true, shift: 'attached' });
p.open(); // suit l'ancre déplacée (translate), retourne et glisse près des bords
`);

// ---- Offset.
const offAnchor = $('off-anchor');
const offset = () => ({ mainAxis: Number($<HTMLInputElement>('off-main').value), crossAxis: Number($<HTMLInputElement>('off-cross').value) });
const offTip = tooltip(offAnchor, { content: 'Décalée', offset: offset(), delayMs: 0 });
const offShow = (): void => {
  const o = offset();
  $('off-out').textContent = `mainAxis ${o.mainAxis} px, crossAxis ${o.crossAxis} px`;
  offTip.update({ offset: o });
  offTip.show();
};
for (const id of ['off-main', 'off-cross']) $(id).addEventListener('input', offShow);
$('off-out').textContent = 'mainAxis 4 px, crossAxis 0 px';
code('offset', `
tooltip(button, { content: 'Décalée', offset: { mainAxis: 12, crossAxis: -30 } });
// ou un nombre (l'écart), ou une fonction ({ side, align, anchor, bubble }) => …
`);

// ---- Animations and reduced motion.
const animTips: TooltipHandle[] = [];
for (const animation of ['fade', 'scale', 'slide', 'pop', 'rise', 'morph', 'none'] as const) {
  const b = button(animation);
  $('anims').append(b);
  animTips.push(tooltip(b, { content: `animation: '${animation}'`, animation, tone: animation === 'morph' ? 'neutral' : 'info', shape: animation === 'morph' ? 'bubble' : undefined, delayMs: 200 }));
}
$('reduced').addEventListener('change', () => {
  for (const t of animTips) t.update({ reducedMotion: $<HTMLSelectElement>('reduced').value as 'none' | 'fade' });
});
const reducedQuery = matchMedia('(prefers-reduced-motion: reduce)');
const sayReduced = (): void => void ($('reduced-now').textContent = reducedQuery.matches ? 'Le système demande moins de mouvement.' : 'Le système ne demande pas moins de mouvement (réglage du système, ou l’émulation des outils du navigateur).');
reducedQuery.addEventListener('change', sayReduced);
sayReduced();
code('animations', `
tooltip(button, { content: 'Aide', animation: 'pop', reducedMotion: 'fade' });
// fade, scale, slide, pop, rise, morph, none — et animate: (el, phase, info) => … pour GSAP ou WAAPI
`);

// ---- Shapes.
const TAIL = 'M6 0 H94 Q100 0 100 6 V74 Q100 80 94 80 H62 L50 100 L38 80 H6 Q0 80 0 74 V6 Q0 0 6 0 Z';
for (const [label, shape] of [['bubble', 'bubble'], ['ticket', 'ticket'], ['pill', 'pill'], ['forme de l’appli', TAIL]] as const) {
  const b = button(label);
  $('shapes').append(b);
  tooltip(b, { content: `shape: ${shape.length > 12 ? 'un tracé SVG' : `'${shape}'`}`, shape, tone: 'neutral', placement: 'top', delayMs: 150 });
}
code('shapes', `
tooltip(button, { content: 'Billet', shape: 'ticket' });       // bubble, ticket, pill
tooltip(button, { content: 'À moi', shape: '${TAIL}' });
`);

// ---- Rich content, and a hostile string neutralised.
const HOSTILE = '<b>Gras</b> <img src="x" onerror="window.__pwned=1"><script>window.__pwned=1<\/script><a href="javascript:window.__pwned=1">lien</a> <i style="background:url(javascript:1)">italique</i>';
const rich: [string, Parameters<typeof tooltip>[1]['content']][] = [
  ['Texte', 'Du texte simple, rien d’autre.'],
  ['Nœuds', () => make('span', {}, make('strong', { textContent: 'Récolte : ' }), '12 kg de tomates', make('br'), make('small', { textContent: 'Parcelle B, rang 4' }))],
  ['HTML', { html: '<b>Gras</b>, <i>italique</i>, <code>code</code>' }],
  ['HTML hostile', { html: HOSTILE }],
];
for (const [label, content] of rich) {
  const b = button(label);
  $('rich').append(b);
  tooltip(b, { content, delayMs: 150 });
}
const cleaned = make('div');
cleaned.append(safeHtml(HOSTILE));
$('cleaned').textContent = cleaned.innerHTML;
const sayPwned = (): void => {
  const hit = (window as { __pwned?: unknown }).__pwned !== undefined;
  $('pwned').replaceChildren(make('span', { className: hit ? 'bad' : 'ok', textContent: hit ? 'Un script a tourné !' : 'Aucun script n’a tourné.' }));
};
sayPwned();
setInterval(sayPwned, 1000);
code('rich', `
tooltip(a, { content: 'Du texte' });
tooltip(b, { content: () => noeud });                          // des nœuds, à chaque ouverture
tooltip(c, { content: { html: '<b>Gras</b>' } });              // nettoyé par safeHtml
tooltip(d, { content: { html: ${JSON.stringify(HOSTILE)} } });
`);

// ---- Popovers: click, modal, hover card.
const log = (s: string): void => void ($('pop-log').textContent = s);
const filterForm = () => make('div', { className: 'form' },
  make('label', {}, 'Contient', make('input', { type: 'text', value: 'tomate' })),
  button('Appliquer'));
popover($('pop-click'), { content: filterForm, label: 'Filtrer', onOpen: () => log('Filtrer : ouvert'), onClose: (r) => log(`Filtrer : fermé (${r})`) });
let modal: PopoverHandle | null = null;
const contactForm = () => make('div', { className: 'form' },
  make('label', {}, 'Nom', make('input', { type: 'text', value: 'Ada Martin', className: 'first' })),
  make('label', {}, 'Courriel', make('input', { type: 'email', value: 'ada@exemple.test' })),
  make('div', { className: 'row' }, button('Annuler', { onclick: () => modal?.close() }), button('Enregistrer', { onclick: () => modal?.close() })));
modal = popover($('pop-modal'), {
  content: contactForm, modal: true, label: 'Modifier le contact', placement: 'bottom-start',
  onOpen: () => log('Contact : ouvert, le reste de la page est inerte'), onClose: (r) => log(`Contact : fermé (${r})`),
});
popover($('pop-card'), {
  openOn: 'hover', label: 'Ada Martin', placement: 'top-start',
  content: () => make('div', { className: 'card-person' }, make('strong', { textContent: 'Ada Martin' }), make('span', { textContent: 'Maraîchère, 14 parcelles' }), make('a', { href: '#carte', textContent: 'Voir son carnet' })),
  onClose: (r) => log(`Carte : fermée (${r})`),
});
code('popovers', `
popover(button, { content: () => formulaire, onClose: (reason) => … });       // clic, Échap, dehors
popover(button, { content, modal: true, initialFocus: (b) => b.querySelector('input') });
popover(lien, { content: () => carte, openOn: 'hover' });                       // une carte au survol
`);

// ---- Delay groups.
for (const [label, name] of [['G', 'Gras'], ['I', 'Italique'], ['S', 'Souligné'], ['Lien', 'Insérer un lien'], ['Img', 'Insérer une image']] as const) {
  const b = button(label);
  b.setAttribute('aria-label', name);
  $('toolbar').append(b);
  tooltip(b, { content: name, delayMs: 700 });
}
code('groups', `
for (const b of toolbar.children) tooltip(b, { content: b.ariaLabel, delayMs: 700 });
// group: par défaut le parent de l'ancre ; un nom pour grouper ailleurs ; false pour aucun
`);

// ---- A native <dialog>.
const dlg = $<HTMLDialogElement>('dlg');
$('dlg-open').addEventListener('click', () => dlg.showModal());
$('dlg-close').addEventListener('click', () => dlg.close());
tooltip($('dlg-tip'), { content: 'Une bulle dans le dialogue modal', delayMs: 150 });
popover($('dlg-pop'), { content: () => make('div', { className: 'form' }, make('label', {}, 'Quantité', make('input', { type: 'number', value: '3' })), button('Valider')) });
code('dialog', `
dialog.showModal();
tooltip(aide, { content: 'Une bulle dans le dialogue modal' });   // mise dans le dialogue ouvert
popover(options, { content });                                    // ses champs prennent le focus
`);

// ---- Size limited.
const VARIETIES = ['Cœur de bœuf', 'Noire de Crimée', 'Green Zebra', 'Rose de Berne', 'Ananas', 'Marmande', 'Saint-Pierre', 'Cornue des Andes', 'Joie de la table', 'Merveille des marchés'];
popover($('tall'), {
  label: 'Toutes les variétés',
  content: () => make('ol', { className: 'long-list' }, ...Array.from({ length: 60 }, (_, i) => make('li', { textContent: `${VARIETIES[i % VARIETIES.length]} — lot ${i + 1}` }))),
});
code('size', `
popover(button, { content: () => longueListe });   // limité à la place : son corps défile
// --dzt-available-block-size, --dzt-viewport-padding pour l'ajuster
`);

// ---- Following the anchor; every frame.
const grow = $('grow');
const growPop = popover(grow, { content: 'Je suis mon ancre.', openOn: 'manual', placement: 'top' });
$('grow-go').addEventListener('click', () => {
  grow.classList.toggle('big');
  growPop.open();
});
const runner = $('runner');
const every = popover(runner, { content: 'everyFrame : je suis', openOn: 'manual', everyFrame: true, tone: 'success', label: 'Avec everyFrame' });
const plain = popover(runner, { content: 'Sans : je reste derrière', openOn: 'manual', tone: 'warning', label: 'Sans everyFrame' });
$('run-every').addEventListener('click', () => (plain.close(), every.open()));
$('run-plain').addEventListener('click', () => (every.close(), plain.open()));
code('follow', `
popover(ancre, { content, openOn: 'manual' }).open();   // suit taille et place (observateurs, sans boucle)
popover(animee, { content, everyFrame: true });          // une transformation animée : lue à chaque image
`);

// ---- Virtual anchors: the cursor, a text selection.
tooltip($('cursor-both'), { content: 'Je suis le pointeur', followCursor: true, delayMs: 0, placement: 'top' });
tooltip($('cursor-inline'), { content: 'Le long de la ligne', followCursor: 'inline', delayMs: 0, placement: 'top' });
let selTip: TooltipHandle | null = null;
const onSelection = (): void => {
  selTip?.destroy();
  selTip = null;
  const sel = getSelection();
  if (!sel || sel.isCollapsed || !sel.rangeCount) return;
  const range = sel.getRangeAt(0).cloneRange();
  if (!$('selectable').contains(range.commonAncestorContainer)) return;
  const n = range.toString().trim().length;
  if (!n) return;
  selTip = tooltip(range, { content: `${n} caractère${n > 1 ? 's' : ''} sélectionné${n > 1 ? 's' : ''}`, tone: 'neutral', placement: 'top' });
  selTip.show();
};
document.addEventListener('pointerup', () => setTimeout(onSelection));
document.addEventListener('keyup', (e) => e.shiftKey && onSelection());
code('virtual', `
tooltip(zone, { content: 'Je suis le pointeur', followCursor: true });   // ou 'inline', 'block'
const range = getSelection().getRangeAt(0).cloneRange();
tooltip(range, { content: '12 caractères' }).show();                       // un Range tel quel
`);

// ---- A link broken over lines.
tooltip($('wrapped'), { content: 'Sur le morceau survolé', delayMs: 100, placement: 'top' });
code('inline', `
tooltip(lienSurDeuxLignes, { content: 'Sur le morceau survolé' });   // getClientRects(), une pièce par ligne
`);

// ---- An anchor inside a shadow root.
class DemoCard extends HTMLElement {
  constructor() {
    super();
    const root = this.attachShadow({ mode: 'open' });
    const style = make('style', { textContent: 'button{font:inherit;padding:.25rem .75rem;border:1px solid var(--tz-border);border-radius:.375rem;background:var(--tz-bg);color:var(--tz-fg)} div{display:flex;gap:.5rem}' });
    const tip = button('Info (shadow)');
    const pop = button('Menu (shadow)');
    root.append(style, make('div', {}, tip, pop));
    tooltip(tip, { content: 'Je décris un bouton dans un shadow root', delayMs: 150 });
    popover(pop, { content: () => make('div', { className: 'form' }, button('Renommer'), button('Dupliquer')) });
  }
}
customElements.define('dzt-demo-card', DemoCard);
code('shadow', `
const b = host.shadowRoot.querySelector('button');
tooltip(b, { content: 'Je décris un bouton dans un shadow root' });  // ariaDescribedByElements
popover(menu, { content });                                         // nommé par les mots du bouton
`);

// ---- An iframe of the same origin, with and without `root`.
const wireFrame = (): void => {
  const d = frameDoc();
  if (!d?.getElementById('with-root')) return;
  d.documentElement.setAttribute('dir', rtl ? 'rtl' : 'ltr');
  d.documentElement.setAttribute('data-theme', $('theme').getAttribute('aria-pressed') === 'true' ? 'dark' : 'light');
  tooltip(d.getElementById('with-root')!, { content: 'Faite dans la page au-dessus : jamais coupée par l’iframe', root: document.body, delayMs: 150, placement: 'bottom' });
  tooltip(d.getElementById('without-root')!, { content: 'Faite dans l’iframe : coupée par ses bords', delayMs: 150, placement: 'bottom' });
  popover(d.getElementById('frame-pop')!, { root: document.body, content: () => make('div', { className: 'form' }, make('label', {}, 'Note', make('input', { type: 'text' })), button('OK')) });
};
$<HTMLIFrameElement>('frame').addEventListener('load', wireFrame);
wireFrame();
code('iframe', `
const b = iframe.contentDocument.getElementById('with-root');
tooltip(b, { content: 'Au-dessus de l’iframe', root: document.body });
popover(c, { content, root: document.body });   // un clic dans l'une ou l'autre page le ferme
`);

// ---- The DzGrid bridge.
type Row = { id: string; crop: string; plot: string; kg: number; note: string };
const CROPS = ['Tomate', 'Courgette', 'Poireau', 'Carotte', 'Fève', 'Radis', 'Laitue', 'Potiron'];
const rows: Row[] = Array.from({ length: 24 }, (_, i) => ({
  id: `r${i}`, crop: CROPS[i % CROPS.length]!, plot: `Parcelle ${String.fromCharCode(65 + (i % 5))}`, kg: (i * 37) % 120,
  note: i % 2 ? `Arroser tôt le matin, pailler le rang ${i + 1} avant la chaleur` : 'RAS',
}));
let grid: { destroy(): void } | null = null;
function makeGrid(): void {
  grid?.destroy();
  $('grid-host').replaceChildren();
  grid = createGrid<Row>($('grid-host'), {
    rows, getRowId: (r) => r.id, messages: FR, locale: 'fr-FR', timeZone: 'UTC', direction: rtl ? 'rtl' : 'ltr', label: 'Récoltes',
    tooltips: { delayMs: 300 },
    columns: [
      { id: 'crop', header: 'Culture', width: 140, headerTooltip: 'Ce qui pousse', tooltip: (v) => ({ html: `<b>${String(v)}</b> <img src="x" onerror="window.__pwned=1">` }) },
      { id: 'plot', header: 'Parcelle', width: 120 },
      { id: 'kg', header: 'Récolte (kg)', type: 'number', width: 140, tooltip: (v: number | null) => ({ text: `${v} kg`, tone: (v ?? 0) > 80 ? 'success' : (v ?? 0) < 20 ? 'warning' : 'info' }) },
      { id: 'note', header: 'Note', width: 180, tooltip: { when: 'truncated', shape: 'bubble', animation: 'morph', tone: 'neutral' } },
    ],
    features: [dzTooltips({ header: true, html: true, placement: 'top' })],
  });
}
makeGrid();
code('grid', `
import { dzTooltips } from '@dztooltip/dzgrid';
createGrid(host, { rows, getRowId, columns: [
  { id: 'crop', headerTooltip: 'Ce qui pousse', tooltip: (v) => ({ html: \`<b>\${v}</b>\` }) },
  { id: 'kg', tooltip: (v) => ({ text: \`\${v} kg\`, tone: v > 80 ? 'success' : 'info' }) },
  { id: 'note', tooltip: { when: 'truncated', shape: 'bubble', animation: 'morph' } },
], features: [dzTooltips({ header: true, html: true, placement: 'top' })] });
`);

Object.assign(window, { ready: true });
