# Audit — DzTooltip face à Floating UI

2026-11-15 · question du propriétaire : « on est à combien pour avoir une tooltip digne de Floating UI ? »

**Mise à jour 2026-11-16, suite** (propriétaire : « je veux que tu finisses la lib bien comme il faut ») — les 6
partiels et les 4 absents restants sont comblés : lignes 3, 5, 10, 11, 17, 21, 22, 27, 28, 32 (feuille
`tooltips-popovers.md` 31–40), chacune avec sa vérification permanente (`scripts/browser.mjs`, section 13 « finished »,
Chrome, Firefox, WebKit, clair et sombre, français et arabe). **Score : 35 / 35.**

**Mise à jour 2026-11-16** (propriétaire : « ★ partout ») — les six manques du §2 sont comblés avant 1.0.0 : lignes 4,
7, 8, 9, 13, 15, 16, 24, 25, 33 passées au niveau (feuille `tooltips-popovers.md` 25–30). Chaque page de preuve est
devenue une vérification permanente (`scripts/browser.mjs`, section 12 « hard cases »), verte en Chrome, Firefox et
WebKit, clair et sombre, français et arabe. **Score : 25 / 35** (avant : 15). Le paquet `@dztooltip/gsap` est abandonné
(§4 et §5.5–6 gardés pour mémoire).

**Méthode.** Référence : la **documentation publique** de Floating UI uniquement (computePosition, middlewares, autoUpdate,
éléments virtuels, platform, interactions React) — aucune ligne de son code lue (CLEANROOM.md). DzTooltip : le code de
`packages/core/src/` (1.0.0 en préparation, `dist` à jour du 2026-11-15). Chaque ligne 🟡 / ❌ (et les ✅ douteux) a été
vérifiée dans un vrai navigateur : une page jetable chargeant le `dist` du cœur (assemblé avec esbuild, **aucune source
modifiée**) et la feuille `dztooltip.css`, pilotée par playwright-core, une fenêtre 1000 × 800, **Chrome** (`channel:
'chrome'`), puis **Firefox** et **WebKit** (un navigateur à la fois, fermé dans `finally`). Les trois moteurs donnent les
mêmes résultats à ±1 px ; les chiffres ci-dessous sont ceux de Chrome. Rien n'est commité.

Légende — verdict : ✅ au niveau · 🟡 partiel · ❌ absent. Effort : S (≤ ½ jour), M (1–3 jours), L (plus). Priorité pour
une appli comme celle du propriétaire (une grille de données, des boutons, des icônes, des cellules, des popovers) :
**haute**, **moyenne**, **basse**.

## Le tableau

### Positionnement

| # | Ce que c'est | Floating UI | DzTooltip aujourd'hui | Verdict | Preuve | Effort | Priorité |
|---|---|---|---|---|---|---|---|
| 1 | Où la bulle s'ouvre : 4 côtés × 3 alignements | `placement` (12) | `dir.ts:placementOf`, `bubble.ts:place` — 12 placements + `auto` | ✅ | suite existante (`float-place.test.ts`) ; toutes les mesures ci-dessous centrées à 0 px | — | — |
| 2 | Droite à gauche | côtés `left/right` + `rtl` dans la plateforme | `start`/`end` logiques, `left`/`right` de l'écran, flèche et glissement miroir (`dir.ts`) | ✅ (mieux) | suite existante (`browser.mjs` en arabe) | — | — |
| 3 | L'écart bulle–ancre | `offset` (axe principal, transversal, alignement ; fonction) | option `offset` : nombre (l'écart, 4 px par défaut), `{ mainAxis, crossAxis, alignmentAxis }` (logique : miroir en arabe), ou fonction du côté essayé et des tailles (feuille 31) | ✅ | 2026-11-16 : `offset: 12` → **8 px de plus** que le défaut ; `crossAxis: 20` → **+20 px** vers la fin de la ligne (−20 à l'écran en arabe), 3 moteurs | — | — |
| 4 | Changer de côté quand ça ne rentre pas | `flip` (fallbackPlacements, crossAxis, bestFit, padding, boundary) | côté demandé, puis l'opposé, puis les deux côtés en travers ; ne rentre nulle part : là où on en voit le plus (`place`, feuille 26) | ✅ | 2026-11-16 : popover de 524 px à mi-hauteur → **à droite, entier** (`data-side=inline-end`), 3 moteurs | — | — |
| 5 | Glisser pour rester dans l'écran | `shift` (padding, `limitShift`) | ✓ dans la fenêtre, à `--dzt-viewport-padding` des bords ; `shift: 'attached'` (comme `limitShift`) : glisse sans jamais quitter l'ancre ; `false` : jamais (feuille 32) | ✅ | 2026-11-16 : bouton à moitié hors de la fenêtre : par défaut bulle **dans la fenêtre** ; `'attached'` : **≥ 20 px** de bulle le long de l'ancre, la flèche dessus, 3 moteurs | — | — |
| 6 | La flèche qui vise l'ancre | `arrow` (élément, padding) | `--dzt-tip-at`, 12 px des coins, suit le flip, dessinée par le thème | ✅ | suite existante | — | — |
| 7 | Limiter la taille à la place disponible | `size` (`availableHeight/Width`, `apply`) | `--dzt-available-block-size` / `-inline-size` écrits à chaque placement ; le corps du popover défile, l'infobulle trop haute aussi (`data-overflow`) | ✅ | 2026-11-16 : popover de 1 500 px sous un bouton à y = 406 : **dans la fenêtre à 8 px des bords**, son dernier champ atteint en faisant défiler, 3 moteurs | — | — |
| 8 | Choisir seul le côté qui a le plus de place | `autoPlacement` | `placement: 'auto'` explicite : parmi les côtés où elle rentre, celui qui laisse le plus de place (sans placement : en dessous, comme avant) | ✅ | 2026-11-16 : bulle de 320 px près du bord de début à mi-hauteur → au bout de la ligne ; sans `auto` → en dessous, 3 moteurs | — | — |
| 9 | Cacher la bulle quand l'ancre est cachée / partie | `hide` (`referenceHidden`, `escaped`) | infobulle et popover : partis à la frame suivante quand l'ancre quitte la page ou n'est plus dessinée (`display: none`, `visibility: hidden`) ; popover : aussi hors d'une boîte qui défile | ✅ | 2026-11-16 : `a.remove()` puis parent en `display: none` pendant l'affichage → **bulle cachée**, 3 moteurs | — | — |
| 10 | Lien sur plusieurs lignes | `inline` (choisit le bon fragment) | le morceau de ligne survolé ou cliqué (le plus proche du pointeur), le premier au clavier ; morceaux d'une même ligne réunis ; automatique (feuille 37) | ✅ | 2026-11-16 : lien sur 2 lignes, pointeur sur la 2e : bulle **centrée sur ce morceau à ≤ 1,5 px** (avant : ≈ 110 px à côté), 3 moteurs | — | — |
| 11 | Ancre « virtuelle » : le curseur, une sélection de texte | virtual elements, `useClientPoint` | `tooltip()` / `popover()` prennent `{ getBoundingClientRect(), getClientRects?(), contextElement? }` (un `Range` tel quel) ; `followCursor` (`true`, `'inline'`, `'block'`) ; un rectangle illisible : signalé une fois, jamais d'exception (feuille 38) | ✅ | 2026-11-16 : un point → bulle **centrée à ≤ 1 px** ; une sélection de texte → popover **centré à ≤ 1,5 px**, nommé ; curseur suivi le long d'une zone **à ≤ 1,5 px**, 3 moteurs | — | — |

### Suivre l'ancre (autoUpdate)

| # | Ce que c'est | Floating UI | DzTooltip aujourd'hui | Verdict | Preuve | Effort | Priorité |
|---|---|---|---|---|---|---|---|
| 12 | Défilement des ancêtres | `autoUpdate` — ancestorScroll | popover : `scroll` capturé sur le document, replacé à la frame suivante ; infobulle : se cache (choix « dismissable ») | ✅ | boîtes défilantes imbriquées : écart 10 px gardé après +30 (intérieure) et +40 (extérieure) ; infobulle cachée après 5 px | — | — |
| 13 | Redimensionnement de la fenêtre | ancestorResize | popover et infobulle replacés à la frame suivante (`follow.ts:track`) | ✅ | 2026-11-16 : infobulle affichée, fenêtre 900 → 600 px : **centrée à ≤ 1,5 px**, 3 moteurs | — | — |
| 14 | La bulle change de taille | elementResize (flottant) | `ResizeObserver` sur le popover | ✅ | suite existante | — | — |
| 15 | L'ancre change de taille | elementResize (référence) | `ResizeObserver` sur l'ancre et la bulle pendant l'affichage | ✅ | 2026-11-16 : bouton grandi de 26 → 64 px : le popover **ne recouvre plus l'ancre**, 3 moteurs | — | — |
| 16 | L'ancre bouge sans défilement (mise en page) | layoutShift (IntersectionObserver) | un `IntersectionObserver` ajusté à la boîte de l'ancre, réajusté après chaque placement ; une frame au plus, rien quand c'est fermé | ✅ | 2026-11-16 : voisin élargi de 250 px, popover ouvert : **centré à ≤ 1,5 px**, 3 moteurs ; aucune mise en page en plus pendant l'ouverture `morph` (Chrome, compteur de layouts) | — | — |
| 17 | Suivre une ancre animée | `animationFrame: true` | `everyFrame: true` : la boîte de l'ancre lue à chaque frame pendant l'affichage, replacée seulement si elle a bougé, arrêté à la fermeture (feuille 39) | ✅ | 2026-11-16 : bouton déplacé par une animation `transform` de 300 × 80 px : **écart ≤ 1,5 px** sur ≥ 10 frames, 3 moteurs | — | — |

### Plateforme

| # | Ce que c'est | Floating UI | DzTooltip aujourd'hui | Verdict | Preuve | Effort | Priorité |
|---|---|---|---|---|---|---|---|
| 18 | Stratégie `fixed` / `absolute` | `strategy` | `fixed` + couche du dessus, sans choix (`FLOAT_CSS`, `reveal`) | ✅ | la couche du dessus rend `absolute` inutile ; replacée à la frame qui suit le défilement (ligne 12) — décalage d'une frame non mesuré | — | — |
| 19 | Parent `transform` / `filter` / `contain` / `will-change` | détection des blocs conteneurs | la bulle n'est jamais dans ce parent (fin de `body`, couche du dessus) | ✅ | ancre dans un parent avec les quatre : écart 10 px, centrage 0 px, `:popover-open` vrai (3 moteurs) | — | — |
| 20 | Ancêtre qui rogne (`overflow: hidden`) | `boundary` / clipping ancestors | couche du dessus : jamais rognée | ✅ | même parent (`overflow: hidden`, 60 px de haut) : bulle de 320 × 47 entièrement visible, au-dessus de tout | — | — |
| 21 | Ancre dans un shadow root | plateforme compatible shadow DOM | placement ✓ ; description par réflexion d'éléments ARIA (`ariaDescribedByElements`), sinon `aria-description` ; popover : `ariaControlsElements`, nommé par les mots du déclencheur, un clic dessus n'est plus « dehors » (feuille 33) | ✅ | 2026-11-16 : arbre d'accessibilité de Chrome : **description « Description dans l'ombre »** (avant : vide) ; Firefox, WebKit : réflexion ou `aria-description` ; popover ouvert et refermé par deux clics, 3 moteurs | — | — |
| 22 | Ancre dans une iframe | référence dans l'iframe, bulle dans la page parente | `root` peut être un élément de la page au-dessus (même origine) : la bulle y est créée, posée sur l'iframe (bordure et marge comptées), suivie au défilement des deux documents (feuille 34) | ✅ | 2026-11-16 : iframe de 300 × 150 : bulle de 380 px **dans la page, débordant de l'iframe, centrée à ≤ 1,5 px** ; popover suivi au défilement de l'iframe (**30 px**), 3 moteurs | — | — |
| 23 | Couche du dessus / Popover API | doc : `FloatingPortal`, top layer | `popover="manual"` + `showPopover()` (`bubble.ts:reveal`) | ✅ | `:popover-open` vrai partout | — | — |
| 24 | Bulle ouverte depuis un `<dialog>` modal | portail dans le dialogue (`FloatingPortal root`) | la bulle va dans le `dialog[open]` de son ancre (toujours dans la couche du dessus) | ✅ | 2026-11-16 : popover depuis un dialogue modal : **son champ prend le clic et la frappe** (`elementFromPoint` → le champ) ; infobulle : **reste avec le pointeur dessus**, 3 moteurs | — | — |
| 25 | Choisir où la bulle est insérée | `FloatingPortal root` | option `root` (`tooltip()`, `popover()`, `[dzTooltipRoot]`, `[dzPopoverRoot]`) | ✅ | `follow.test.ts`, test Angular | — | — |

### Interactions

| # | Ce que c'est | Floating UI | DzTooltip aujourd'hui | Verdict | Preuve | Effort | Priorité |
|---|---|---|---|---|---|---|---|
| 26 | Survol avec délai, délai de fermeture | `useHover` (`delay`, `restMs`) | `delayMs` 500, `hideDelayMs` 150, jamais au toucher seul (`tooltip.ts`) | ✅ | témoin : du bouton vers la bulle sans pause, la bulle reste | — | — |
| 27 | Triangle de sécurité vers une bulle interactive | `safePolygon` | la plus petite forme contenant le point de sortie et la bulle : la bulle reste tant que le pointeur y est (sortie de la forme, de la fenêtre, ou 400 ms immobile : sa grâce) ; infobulles et « hover cards » (feuille 35) | ✅ | 2026-11-16 : trajet en diagonale de ~400 ms vers le coin lointain, plus de la moitié hors du bouton et de la bulle : **bulle gardée** ; trajet à l'opposé : **fermée**, 3 moteurs | — | — |
| 28 | Popover ouvert au survol (« hover card ») | `useHover` + `safePolygon` sur un popover | `openOn: 'hover'` : survol (`delayMs` 500) ou focus clavier, aucun focus déplacé, Tab y entre, fermé quand le pointeur quitte les deux (`hideDelayMs` 150, triangle de sécurité), Échap, clic dehors (feuille 40) | ✅ | 2026-11-16 : ouvert par la souris (focus inchangé), gardé en y allant, fermé en s'éloignant ; au clavier : ouvert au focus, Tab dedans, Échap → focus sur le lien, 3 moteurs | — | — |
| 29 | Focus clavier ouvre, clic non | `useFocus` (`visibleOnly`) | `keyed()` : focus suivant une touche → tout de suite | ✅ | suite existante | — | — |
| 30 | Fermer : Échap, clic dehors, défilement, focus qui part | `useDismiss` | les quatre, popovers imbriqués compris | ✅ | suite existante ; ligne 12 | — | — |
| 31 | Rôles ARIA | `useRole` (tooltip, dialog, menu, listbox, select…) | `tooltip` + `aria-describedby`, `dialog` non modal + `aria-haspopup/expanded/controls` | ✅ | suite existante + axe (menus, listes : hors périmètre, voulu) | — | — |
| 32 | Gestion du focus | `FloatingFocusManager` (initialFocus, returnFocus, modal, guards) | `modal: true` : `aria-modal`, reste de la page `inert` (sinon `aria-hidden` + gardes de focus), Tab enfermé, Échap partout ; `initialFocus`, `returnFocus` ; deux modales : seule la plus récente garde le focus (feuille 36) | ✅ | 2026-11-16 : page `inert`, 6 Tab restent dedans, axe propre, Échap → page rendue puis focus sur le déclencheur, 3 moteurs | — | — |
| 33 | Groupe de délais (barre d'outils) | `FloatingDelayGroup` | automatique : même parent (ou `group: 'nom'`, `false` pour aucun) — la suivante tout de suite, à la place de la première, et 300 ms après la fermeture ; boutons d'en-tête d'une grille (pont) : un groupe ; cellules de la grille : le délai de DzGrid | ✅ | 2026-11-16 : 3 boutons collés, « Deux » affiché **< 250 ms** après le départ du pointeur (trajet compris), 3 moteurs | — | — |
| 34 | Animations d'entrée / sortie | `useTransitionStyles`, `useTransitionStatus` | presets CSS, `morph`, crochet `animate`, fermeture attendue | ✅ (mieux) | suite existante | — | — |
| 35 | Bulles imbriquées | `FloatingTree` | popover dans un popover garde son parent, Échap ferme le plus profond | ✅ | suite existante | — | — |

## 1. Score

**35 sur 35 au niveau** (2026-11-16, fin ; avant : 25, et 15 au départ). Ce qui reste, honnêtement — des limites de
principe, pas des lignes manquantes :

- **Iframe** (22) : même origine seulement (une autre origine ne se lit pas : le `root` est alors ignoré, la bulle reste
  dans l'iframe) ; les deux documents ne partagent pas d'id, l'ancre reçoit les mots en `aria-description` ; le
  déplacement de l'ancre sans défilement (ligne 16) n'est pas surveillé à travers le cadre (défilements, tailles et
  `everyFrame` le sont) ; non vérifié avec un document de droite à gauche *dans* l'iframe (barre de défilement à
  gauche).
- **Shadow DOM** (21) : là où le navigateur n'a pas la réflexion d'éléments ARIA, la description passe par
  `aria-description` (ARIA 1.3) et `aria-controls` n'est pas dit ; les feuilles du thème doivent atteindre la page (la
  bulle reste à la fin de la page, pas dans le shadow root).
- **Triangle de sécurité** (27) : pour les infobulles de la page et les « hover cards » ; les infobulles d'une grille
  (pont) gardent les règles de DzGrid. Traverser une autre ancre en chemin (une cellule) affiche son infobulle — une
  à la fois, comme voulu.
- **Hover card** (28) : un complément, jamais le seul accès à une information (toucher, lecteurs d'écran).
- **Poids** : le cœur passe de 7,77 à 11,86 kB (gzip, tout), `tooltip` seul de 6,32 à 9,00 kB, `popover` seul de 5,81 à
  9,95 kB.

Sur les 35 lignes, DzTooltip est **au niveau ou mieux**. (Avant le 2026-11-16 il était en retard sur les cas durs : la
taille disponible, le choix du côté, le suivi de l'ancre, les modales natives, les ancres virtuelles ; les §2 et §5
ci-dessous sont gardés pour mémoire.)

## 2. Les manques qui comptent, classés

1. **`size` (7)** — un popover haut (filtre, formulaire) près du bas de l'écran sort de 408 px et son bas devient
   inatteignable. Le plus visible pour un utilisateur.
2. **Suivre l'ancre qui bouge ou grandit (15, 16)** — popover de filtre ouvert pendant qu'on redimensionne une colonne ou
   qu'un panneau se replie : la bulle reste à 250 px. Un `ResizeObserver` sur l'ancre plus une vérification par frame
   (ou `IntersectionObserver`) pendant l'ouverture.
3. **Repli de `flip` + `autoPlacement` (4, 8)** — essayer les autres côtés (ou celui qui a le plus de place) quand ni le
   côté demandé ni l'opposé ne rentrent ; avec 1, ça règle les popovers dans les grilles.
4. **Groupe de délais (33)** — dans une barre d'icônes, passer d'une icône à l'autre doit être immédiat ; aujourd'hui
   533 ms d'attente avec la bulle sur la mauvaise icône. Petit travail, gros gain ressenti.
5. **`<dialog>` modal (24, 25)** — popover inutilisable, infobulle non survolable. Insérer la bulle dans le
   `dialog[open]` le plus proche de l'ancre (ou une option `root`). Critique pour qui utilise `<dialog>` ; le CDK
   d'Angular Material n'est pas touché.
6. **Ancre retirée / fenêtre redimensionnée (9, 13)** — l'infobulle reste flottante ; facile.
7. **Ancre virtuelle (11)** — infobulle qui suit le curseur sur une cellule ou un graphique ; et aujourd'hui un objet
   non-élément **lève** une exception, à corriger quoi qu'on décide.
8. Ensuite, plus bas : `offset` réglable (3), padding de `shift` (5), `inline` (10), hover card + triangle de sécurité
   (27, 28), description dans un shadow root (21), mode modal (32), iframe (22).

Les 6 premiers tiennent en ~S+M+M+S+S+S, soit environ une semaine.

## 3. Ce que DzTooltip fait de plus que Floating UI (honnêtement)

Floating UI est un **moteur de position et d'interactions** : il ne dessine rien. DzTooltip livre la bulle entière :

- **La bulle elle-même** : cinq tons (`info`, `neutral`, `success`, `warning`, `danger`) avec contraste 4,5:1 vérifié et
  couleurs système en contraste forcé ; tout en variables CSS (`--tz-*`, `--dzt-*`), suit le schéma clair/sombre de
  l'ancre.
- **Formes** : `bubble` (queue courbe sans couture), `ticket`, `pill`, ou un chemin SVG de l'appli.
- **Animations** : `fade`, `scale`, `slide`, `pop`, `rise`, `morph` en CSS pur (opacity/transform/clip-path, rien de mesuré
  par frame), ou l'animation de l'appli (`animate`, une timeline GSAP acceptée telle quelle, fermeture attendue) ;
  mouvement réduit respecté.
- **Popover prêt** : dialogue non modal complet (ARIA, focus, Tab, groupes, imbrication, suivi, recyclage des lignes de
  grille).
- **HTML nettoyé** (`safeHtml`, document inerte, liste fixe) et contenus Angular (template, composant).
- **Accessibilité WCAG 1.4.13** (survolable, persistante, fermable), pas sur toucher seul, une seule infobulle à la fois.
- **Droite à gauche** pensé dès le départ ; **pont DzGrid**.

À l'inverse, Floating UI couvre des usages hors périmètre ici (menus, listes, select, typeahead, navigation par flèches),
et son moteur est plus général (boundary au choix, middlewares composables, plateforme remplaçable).

## 4. Ce que `@dztooltip/gsap` demande au cœur (bulles « type texto »)

Vérifié dans Chrome avec une bulle-message (rectangle arrondi r = 10 + une queue, dans la boîte 100 × 100) :

**Ce qui marche déjà**

- `animate(el, 'open' | 'close', info)` est appelé **après** placement et **avant** la première image (même tâche) : un
  `gsap.from()` part bien de son état initial.
- La fermeture attend un `then` (tween ou timeline GSAP) ; rouverte pendant la fermeture → `open` à nouveau.
- `info.shape` donne le `<path>` : MorphSVG peut le morpher. `info.reduced`, `info.dir`, `info.side`, `info.tone` sont là ;
  jamais appelé sous `[data-motion=off]`.
- Popover et infobulle passent par le même `dress` / `play`.

**Ce qui manque**

1. **Une forme en pixels, pas étirée.** Le chemin est étiré (`preserveAspectRatio="none"`) sur la bulle : sur 320 × 47 px,
   un coin r = 10 devient **32 × 4,7 px** (ovale écrasé) et la queue **42 px de large × 4,7 px de haut**. Une bulle de
   message exige des coins ronds et une queue fixe. → `shape` doit accepter une **fonction**
   `({ width, height, side, at, dir }) => d` (en px, `viewBox` = taille de la bulle), rappelée à chaque placement.
2. **La queue au bon endroit.** Le chemin est le même pour tous les côtés : bulle posée **en dessous**, la queue dessinée
   en bas pointe à l'opposé de l'ancre ; après un flip (ancre en bas d'écran, `data-side=block-start`) rien ne change. La
   fonction du point 1 reçoit `side` et `at` (la position de la flèche, `--dzt-tip-at`, aujourd'hui absente d'`info`).
3. **Un appel quand la bulle bouge.** Passer d'une ancre à l'autre (A → B → C, dont un flip) ne rappelle **jamais**
   `animate` (une seule entrée `open` dans le journal) : impossible de faire glisser / re-morpher la bulle. → une phase
   `'move'` (ou `'update'`) avec l'ancien et le nouveau rectangle, et le nouveau `side`.
4. **Un changement de taille animable.** « … » (en train d'écrire) puis le message : il faut remplacer le contenu et
   animer de l'ancienne taille à la nouvelle (FLIP). → une méthode `update(content)` qui appelle `animate(el, 'resize', {
   from, to })` avant de replacer.
5. **Un conteneur de contenu.** Un texte simple est un nœud texte nu à côté du `<svg>` : GSAP ne peut pas l'animer à part
   de la forme (fondu du texte après la forme, mots qui apparaissent). → toujours un `<span class="dzt-tip-body">`.
6. **Plus de données dans `info`** : l'ancre (élément ou rectangle), la taille de la bulle, `at`, le placement demandé
   contre celui obtenu, `kind: 'tooltip' | 'popover'`. Aujourd'hui : `side, tone, dir, reduced, shape` seulement.
7. **Mouvement réduit** : `reduced` suffit ; prévoir dans le paquet une version fondu seul par défaut.
8. **Le paquet lui-même** : `gsap` en dépendance pair (MorphSVG est gratuit depuis GSAP 3.13), des recettes
   `messageBubble({ tail: 'start' | 'end', typing: true })` qui rendent `{ shape, animate }` à passer à `tooltip()` /
   `popover()` / `dzTooltips()` ; aucune modification du cœur au-delà des points 1–6.

Les points 1, 2, 5 et 6 changent le **contrat public** (`shape`, `TipAnimateInfo`, le DOM de la bulle) : mieux vaut les
faire **avant** 1.0.0 (après, ce serait un ajout compatible pour 1 et 6, mais 5 change le DOM que les applis stylent).

## 5. Questions pour le propriétaire

1. **Avant 1.0.0, on comble quels manques ?**
   A ★ les 6 premiers du §2 (taille, suivi de l'ancre, repli de flip/auto, groupe de délais, `<dialog>`, ancre retirée),
   environ une semaine · B seulement `size` et le suivi de l'ancre, le reste en 1.1.
2. **Bulle ouverte depuis un `<dialog>` modal :**
   A ★ insérée automatiquement dans le `dialog[open]` le plus proche de l'ancre, plus une option `root` · B seulement une
   option `root` (l'appli choisit).
3. **Groupe de délais (barre d'icônes) :**
   A ★ automatique : une infobulle déjà affichée → la suivante tout de suite, pendant ~300 ms après la fermeture · B en
   option (`group: 'toolbar'`), sinon comme aujourd'hui.
4. **Ancre virtuelle (curseur, sélection de texte) :**
   A accepter un objet `{ getBoundingClientRect }` dès 1.0.0 · B ★ plus tard ; en 1.0.0 seulement ne plus lever (un
   `reportError`).
5. **Le contrat des formes pour le futur paquet GSAP (§4, points 1, 2, 5, 6) :**
   A ★ fixé avant 1.0.0 (forme en fonction, `at`/ancre/taille dans `info`, conteneur de contenu, phase `move`) · B 1.0.0
   tel quel, ajouts en 1.1.
6. **`@dztooltip/gsap` :**
   A construit maintenant, publié avec 1.0.0 · B ★ après 1.0.0, une fois le contrat du point 5 en place.
