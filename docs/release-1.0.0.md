# Publier DzTooltip 1.0.0 — la liste du propriétaire

Préparé le 2026-11-16. **Rien n'est publié, aucune étiquette n'est poussée** : c'est toi qui publies. Quatre paquets en
**1.0.0**, sous l'organisation npm `dztooltip` : `@dztooltip/core` (aucune dépendance), `@dztooltip/theme`,
`@dztooltip/angular` (pairs Angular `^19 || ^20 || ^21 || ^22`), `@dztooltip/dzgrid` (pair `@dzgrid/dom` `^1.13.0`,
déjà sur npm). Ce que c'est : les infobulles et popovers de DzGrid 1.12, sortis dans leurs propres paquets, pour
n'importe quelle page, Angular, et les cellules d'une DzGrid (`CHANGELOG.md`).

## Avant

```sh
cd /Users/nadou/Dev/dztooltip
git pull                  # main, le commit de la 1.0.0
npm ci
npm run release:check     # « Release check: the 4 packages at 1.0.0 … » puis « ok Angular 19… », « ok Angular 22… »
npm whoami                # ton compte, membre de l'organisation dztooltip
```

## Publier

```sh
npm run publish:latest -- --otp=CODE
```

Construit, puis publie dans l'ordre core → theme → angular → dzgrid avec le même code ; une version déjà sur npm est
sautée (relancer la même commande après un échec) ; puis demande au registre si les quatre sont arrivés (il attend).
Un code expiré en route : relancer avec un nouveau code.

## Après

- `npm run publish:verify` — « All 4 are on npm. »
- La page npm de chaque paquet montre son LISEZMOI, la licence MIT et le dépôt.
- Ton appli (`dz-grid-migration`) : remplacer les paquets locaux par `@dztooltip/core`, `theme`, `angular`, `dzgrid`
  `^1.0.0` dans `package.json`, puis `npm install` et `npm run check`.
- Si tu veux l'étiquette : `git tag v1.0.0 && git push origin v1.0.0` (rien ne publie sur une étiquette ici).

## Vérifié (2026-11-16)

Revue indépendante de `packages/` (défauts corrigés, chacun par un test rouge d'abord : `CHANGELOG.md`) ; `build`,
tests unitaires, matrice navigateurs (Chrome, Firefox, WebKit), `release:check`, ton appli (`npm run check`).
