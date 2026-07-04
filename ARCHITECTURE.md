# ARCHITECTURE.md — Naruto Destiny Wheel

> Dernière mise à jour : 2026-07-03
> Version architecture : 2.0 (post Phase 1 refactoring)

---

## 1. Vue d'ensemble

Naruto Destiny Wheel est un mini-jeu solo dans l'univers Naruto : le joueur choisit un
village d'origine, puis enchaîne des rounds où des roues de type "loterie" tirent
successivement son personnage, un antagoniste, l'issue du combat et un butin, jusqu'à
pouvoir tenter un examen de passage de rang (Genin → Chûnin → Jônin → Kage). La partie
se termine par une victoire (rang Kage atteint) ou par un game over (0 vie). Toute la
partie se joue en une page, sans rechargement, avec un état 100% en mémoire (RAM) —
rien n'est persisté entre deux visites.

**Stack :** HTML5 · CSS3 · Vanilla JavaScript (ES6, modules via `<script>` classiques)
**Pas de bundler, pas de framework, pas de dépendances npm.**

L'architecture est issue d'un refactoring (Phase 1) qui a découpé 4 fichiers
monolithiques (`data.js`, `engine.js`, `wheel.js`, `ui.js`) en modules par
responsabilité, sans changer une seule ligne de logique de jeu. Ce document (Phase 2)
documente cette architecture stabilisée.

---

## 2. Arborescence du Projet

```
index.html               → Page unique : 2 écrans (village, jeu) + 4 overlays + balises <script>
BUGS.md                  → Bugs connus, découverts pendant le refactoring (voir section 7)
ARCHITECTURE.md          → Ce fichier

css/
├── base.css              → Variables CSS, reset, structure commune à toute la page
└── components/           → Un fichier par zone visuelle de l'écran de jeu
    ├── village.css         → Écran de sélection du village (cartes, bouton confirmer)
    ├── layout.css          → Grille 3 colonnes de l'écran de jeu (sidebar/arène/sidebar)
    ├── hud.css             → HUD vies + rang (sidebar gauche, haut)
    ├── inventory.css       → Barre d'inventaire + popup d'utilisation d'objet
    ├── arena.css           → Zone centrale : roues empilées, bouton "Tourner"
    ├── recap.css           → Sidebar droite (collection de badges) + styles du contenu
    │                          du récapitulatif de round, affiché dans une popup (overlays.css)
    ├── overlays.css        → Overlays plein écran (promotion, victoire, game over,
    │                          récapitulatif de round, popup objet)
    └── illustrations.css   → Classes décoratives (badges, rangs, raretés) — partiellement mortes (BUGS.md #7)

js/
├── data.js               → Données statiques : rangs, périodes, villages, styles, personnages,
│                            antagonistes, objets de loot, palettes de couleurs
├── engine.js              → Moteur de jeu (IIFE `Engine`) : état global, règles de calcul des
│                            probabilités, transitions de phase. Aucune manipulation du DOM.
├── wheel.js               → Moteur de dessin Canvas (IIFE `WheelEngine`) : dessin et animation
│                            des roues. Ne connaît rien de l'état du jeu.
└── ui/
    ├── ui-core.js          → Utilitaires DOM de base ($ , showScreen), anti-clickjacking, hashStr
    ├── ui-svg.js            → Génération procédurale de SVG (badges d'ennemis, emblèmes de rang)
    ├── ui-hud.js            → HUD vies + rang (sidebar gauche, haut)
    ├── ui-village.js        → Écran de sélection du village, démarrage/reset de partie
    ├── ui-inventory.js      → Barre d'inventaire + popup d'utilisation d'objet avant combat
    ├── ui-round.js          → Construction et pilotage du round : empilement des roues, spin séquentiel
    ├── ui-recap.js          → Récapitulatif de round, analyses combat/examen, collection de badges
    └── ui-overlays.js       → Overlays plein écran (promotion, victoire, game over)
```

---

## 3. Flux de Données (Comment une partie se déroule)

```
1. Chargement de la page
   → ui-village.js → window.addEventListener("DOMContentLoaded", …)
     → buildVillageScreen() (construit les cartes) → showScreen("screenVillage")

2. Joueur choisit un village et clique "Commencer l'aventure"
   → index.html (onclick) → ui-village.js → selectVillage() puis confirmVillage()
     → Engine.setVillage() (fixe G.village, G.status="playing")
     → startGame() → Engine.newRound() + ui-round.js → buildRound()
       → construit les canvases des étapes du round (buildSteps()) et dessine la 1ère roue

3. Joueur clique "⚡ Tourner" pour chaque roue du round
   → ui-round.js → spinCurrent()
     → selon l'étape courante : WheelEngine.spinGeneric() (perso/antag),
       WheelEngine.spinIssue() (combat, avec Engine.computeIssueWeights()),
       WheelEngine.spinLoot() (butin), ou WheelEngine.spinIssue() de nouveau (examen,
       avec Engine.computeExamenWeights())
     → au résultat : Engine.setResult(), puis selon l'étape :
         - "issue"  → applyIssue() → Engine.applyOutcome() (vies, badges, phase="loot")
         - "loot"   → Engine.addLoot() (inventaire) ; si !G.examReady → showRoundSummary()
         - "examen" → Engine.applyExamen() (rang, victoire) → showVictory() / showPromotion() / showExamFailure()
     → sinon, passe à la roue suivante via transitionToNext()

4. L'UI se met à jour après chaque étape
   → ui-hud.js       → updateHUD() (vies, rang)
   → ui-inventory.js → updateInventoryBar()
   → ui-recap.js     → showCombatAnalysis() / showExamenAnalysis() avant chaque spin
                        pertinent, showRoundSummary() / showExamFailure() en fin de round

5. Fin de round / de partie
   → Round terminé sans promotion → bouton "⚡ Round suivant" → ui-round.js → nextRound()
     → reconstruit un nouveau round (retour à l'étape 3)
   → Promotion de rang → ui-overlays.js → showPromotion() → closePromo() → showRoundSummary()
   → Rang Kage atteint → ui-overlays.js → showVictory() → closeKage() → Engine.fullReset()
     → retour à l'écran de sélection de village (étape 1)
   → Game over (0 vie) → spinCurrent() détecte combatResult.gameOver → ui-overlays.js →
     showGameOver() (après un délai de 900ms, le temps du flash de défaite) → closeGameOver()
     → Engine.fullReset() → retour à l'écran de sélection de village (étape 1)
```

---

## 4. Carte des Dépendances

```
data.js        ← aucune dépendance (source)
engine.js      ← data.js
wheel.js       ← data.js
ui-core.js     ← aucune dépendance
ui-svg.js      ← data.js, ui-core.js
ui-hud.js      ← data.js, engine.js, ui-core.js, ui-svg.js
ui-village.js  ← data.js, engine.js, ui-core.js, ui-round.js, ui-hud.js, ui-inventory.js
ui-inventory.js← data.js, engine.js, ui-core.js, ui-hud.js
ui-round.js    ← data.js, engine.js, wheel.js, ui-core.js, ui-hud.js, ui-inventory.js,
                 ui-recap.js, ui-overlays.js (showVictory/showPromotion/showExamFailure)
ui-recap.js    ← data.js, engine.js, ui-core.js, ui-svg.js
ui-overlays.js ← engine.js, ui-core.js, ui-svg.js, ui-hud.js, ui-recap.js, ui-village.js,
                 ui-round.js (_stepIdx, _stepRots — variables partagées, pas des exports)
index.html     ← tous les fichiers ci-dessus (confirmRestart() inline appelle Engine
                 et plusieurs fonctions ui/*.js globales)
```

**Règle :** `engine.js` et `wheel.js` ne manipulent jamais le DOM directement — seuls les
fichiers `ui/*.js` le font. `engine.js` ne dépend jamais d'un fichier `ui/*.js` (le sens
de dépendance est toujours UI → Engine, jamais l'inverse).

**Point d'attention :** `ui-overlays.js` et `ui-round.js` partagent directement les
variables `_stepIdx` et `_stepRots` (définies dans ui-round.js, réassignées dans
ui-overlays.js lors d'un reset). Ce couplage fonctionne uniquement parce que tous les
fichiers `ui/*.js` s'exécutent dans le même scope global (pas de modules ES réels, juste
des balises `<script>` classiques) — voir section 5.

---

## 5. Conventions du Projet

### Nommage
- **Fichiers :** kebab-case pour les fichiers `ui/` (`ui-hud.js`, `ui-round.js`) ;
  nom simple pour les modules racine (`data.js`, `engine.js`, `wheel.js`)
- **Fonctions publiques :** camelCase (`resolveRound`-like : `applyOutcome`, `buildRound`, `updateHUD`)
- **Fonctions/variables internes à un module :** préfixe `_` (`_stepIdx`, `_itemBonusText`)
- **Constantes de données :** SCREAMING_SNAKE_CASE (`RANKS`, `ANTAGONISTS`, `LOOT_POOL`)
- **État global :** objet unique `G` encapsulé dans l'IIFE `Engine`, exposé en lecture
  via `Engine.getState()` — jamais de variable d'état globale en dehors de `engine.js`

### Règles Architecturales
- Un fichier = une responsabilité. `engine.js` = règles de jeu, `wheel.js` = dessin
  Canvas, chaque `ui-*.js` = une zone d'écran ou un type d'interaction.
- **Aucune manipulation du DOM dans `engine.js` ou `wheel.js`.** Ces deux fichiers
  reçoivent ou retournent des données pures ; seuls les fichiers `ui/*.js` touchent au DOM.
- Les fichiers `ui/*.js` lisent `Engine.getState()` mais ne modifient **jamais**
  directement l'objet retourné (à l'exception de `G.round.spinning`, muté directement
  par `ui-round.js` — c'est un flag de pilotage UI, pas une donnée de règles de jeu).
  Toute mutation de règle de jeu passe par une fonction `Engine.*`.
- Pas de modules ES (`import`/`export`) : tous les fichiers sont chargés via des balises
  `<script>` classiques et partagent le même scope global. Les IIFE (`Engine`,
  `WheelEngine`) simulent un espace de noms pour éviter de polluer le global avec leurs
  fonctions internes ; les fichiers `ui/*.js`, eux, déclarent directement des fonctions
  globales (pas d'IIFE), car ils s'appellent mutuellement dans les deux sens.
- Toute donnée statique (rangs, personnages, ennemis, objets, couleurs) va dans `data.js`.

### Ordre de chargement des `<script>`
L'ordre dans `index.html` est contraint par les dépendances :
```
data.js → engine.js → wheel.js
  → ui-core.js → ui-svg.js → ui-hud.js → ui-village.js
  → ui-inventory.js → ui-round.js → ui-recap.js → ui-overlays.js
```
Ne jamais inverser cet ordre : `ui-village.js` par exemple appelle `buildRound()`
(défini dans `ui-round.js`) mais aussi l'inverse (`ui-overlays.js` appelle
`buildVillageScreen()`, défini dans `ui-village.js`) — le couplage circulaire entre
fichiers `ui/*.js` n'est possible que parce qu'ils partagent tous le même scope global
au moment de l'exécution (pas de vérification à l'import comme avec de vrais modules ES).

---

## 6. Comment Ajouter une Feature

### Ajouter un nouvel antagoniste
1. Ouvrir `js/data.js` → ajouter une entrée dans `ANTAGONISTS["Genin"|"Chûnin"][village]`
   (rivalité de village) ou dans `ANTAGONISTS["Jônin"|"Kage"]` (liste unique, partagée
   par tous les villages), en respectant le typedef `AntagonistData` (name, weakness,
   resistance)
2. Aucun autre fichier à modifier — `engine.js` lit `ANTAGONISTS` dynamiquement via
   `getAntags()`/`getAntagData()`

### Ajouter un nouveau personnage jouable
1. Ouvrir `js/data.js` → ajouter une entrée dans `STARTERS["<Village>"]`,
   en respectant le typedef `StarterData` (name, style, canBeGenin)
2. Aucun autre fichier à modifier

### Ajouter un nouvel objet de loot
1. Ouvrir `js/data.js` → ajouter dans `LOOT_POOL`, en respectant le typedef `LootItemData`
2. Si le type est nouveau (ni weapon/ninjutsu/taijutsu/genjutsu/heal/chance) :
   - Ajouter une entrée dans `TYPE_CSS` (couleur inventaire) et `LOOT_WHEEL_COLORS`
     (couleur roue butin)
   - Créer la classe CSS correspondante dans `css/components/inventory.css`
   - Adapter `js/engine.js` → `computeIssueWeights()`/`computeExamenWeights()` si le
     nouveau type doit apporter un bonus de poids
   - Adapter `js/ui/ui-inventory.js` → `_itemBonusText()` pour décrire son effet

### Modifier la logique de progression de rang
1. Ouvrir `js/data.js` → ajuster `RANKS` (ordre, couleurs, titres) ou `WINS_PER_RANK`
2. Ouvrir `js/engine.js` → si les seuils de difficulté de l'examen changent, ajuster
   `computeExamenWeights()` (tableau `basePoids`)

### Ajouter un effet visuel sur une roue
1. Ouvrir `js/wheel.js` → modifier `draw()` (rendu bas niveau, partagé par toutes les roues)
   ou une des fonctions spécialisées (`drawLoot`, `drawGeneric`)
2. Ne pas toucher aux autres fichiers — `wheel.js` ne dépend que de `data.js`

### Ajouter un nouvel écran ou overlay
1. Ajouter le markup dans `index.html` (suivre le pattern `.screen` ou `.overlay` existant)
2. Créer un fichier `css/components/<nom>.css` dédié et le linker dans `<head>`
3. Créer un fichier `js/ui/ui-<nom>.js` avec le module header standard (voir section 5),
   et l'ajouter à `index.html` **après** `ui-core.js` (et après tout fichier dont il dépend)

---

## 7. Bugs Connus

Voir [`BUGS.md`](./BUGS.md) à la racine du projet — 9 bugs recensés à ce jour. Le seul de
gravité élevée (BUGS.md #1, `showGameOver()` jamais invoquée) a été corrigé. Les autres
sont du code ou du CSS mort sans impact fonctionnel visible.

---

## 8. Historique des Versions d'Architecture

| Version | Date | Description |
|---------|------|-------------|
| 1.0 | (historique, avant refactoring) | Architecture monolithique : `data.js`, `engine.js`, `wheel.js`, `ui.js` (un seul fichier UI) et 2 CSS (`style.css`, `illustrations.css`) |
| 2.0 | 2026-07-03 | Refactoring modulaire Phase 1 — découpage de `ui.js` en 8 fichiers `js/ui/*.js` par zone d'écran, et des 2 CSS en `css/base.css` + 8 `css/components/*.css`. Phase 2 (ce document) : documentation JSDoc exhaustive de tous les fichiers `.js` et rédaction de ce fichier. |
