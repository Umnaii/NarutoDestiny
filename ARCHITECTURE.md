# ARCHITECTURE.md — Naruto Destiny Wheel

> Dernière mise à jour : 2026-07-06
> Version architecture : 3.1 (post sauvegarde/reprise, historique instantané, équilibrage butin)

---

## 1. Vue d'ensemble

Naruto Destiny Wheel est un mini-jeu solo dans l'univers Naruto : le joueur choisit un
village d'origine, puis enchaîne des rounds où des roues de type "loterie" tirent
successivement son personnage, un antagoniste, l'issue du combat et un butin, jusqu'à
pouvoir tenter un examen de passage de rang (Genin → Chûnin → Jônin → Kage). Les
antagonistes rencontrés dépendent du rang du joueur et, pour Genin/Chûnin, de rivalités
de village cohérentes avec le lore ; il n'y a plus de tirage aléatoire d'"époque" caché.
La difficulté de l'examen de rang augmente avec les échecs successifs et grimpe jusqu'à
100% de réussite garantie après 5 victoires en combat sans avoir décroché l'examen. Un
match nul est un statu quo pur : il ne fait progresser ni les victoires (G.wins), ni le
score de vagues repoussées en défense de Kage — seule une victoire nette compte. Le
butin d'un round est garanti sur victoire nette, mais réduit à 40% de chances sur match
nul ou défaite survécue (même règle en mode normal et en défense de Kage). Une fois le
rang Kage atteint, la partie ne s'arrête pas : elle bascule dans un mode défense sans fin
(vagues d'ennemis) jusqu'au game over, et chaque partie terminée (victoire ou défaite)
est ajoutée à un classement consultable à tout moment. La partie se termine par un game
over (0 vie), qu'il survienne en cours de progression normale ou en mode défense de Kage.
Toute la partie se joue en une page, sans rechargement. L'état de la partie en cours et
le classement de session sont automatiquement sauvegardés dans localStorage (voir
section 3 et 4) : fermer l'onglet ou recharger la page ne fait pas perdre la
progression — un bouton "Reprendre la partie en cours" réapparaît sur l'écran de village
tant qu'une sauvegarde existe. Aucune autre donnée n'est envoyée où que ce soit ; il n'y
a ni compte, ni serveur, ni base de données.

**Stack :** HTML5 · CSS3 · Vanilla JavaScript (ES6, modules via `<script>` classiques)
**Pas de bundler, pas de framework, pas de dépendances npm.**
Les sons sont synthétisés en direct via l'API Web Audio (aucun fichier audio, respect de
la CSP qui n'autorise aucune ressource réseau externe).

L'architecture est issue d'un refactoring (Phase 1) qui a découpé 4 fichiers
monolithiques (`data.js`, `engine.js`, `wheel.js`, `ui.js`) en modules par
responsabilité, sans changer une seule ligne de logique de jeu. Ce document a ensuite
été maintenu à jour (Phase 2 : documentation JSDoc exhaustive ; Phase 3 : refonte du
système de rivalités/portraits/objets/progression/mode Kage/son décrite ici) au fil des
évolutions du jeu, en conservant la même structure modulaire.

---

## 2. Arborescence du Projet

```
index.html               → Page unique : 2 écrans (village, jeu) + overlays + balises <script>
BUGS.md                  → Bugs connus, découverts pendant le refactoring (voir section 7)
ARCHITECTURE.md          → Ce fichier

images/                  → Portraits des personnages jouables et antagonistes (voir
                             data.js → CHARACTER_PORTRAITS) ; uniquement les personnages
                             pour lesquels une image existe apparaissent dans STARTERS/
                             ANTAGONISTS (voir section 6)

css/
├── base.css              → Variables CSS, reset, structure commune à toute la page
└── components/           → Un fichier par zone visuelle de l'écran de jeu
    ├── village.css         → Écran de sélection du village (cartes, bouton confirmer)
    ├── layout.css          → Grille 3 colonnes de l'écran de jeu (sidebar/arène/sidebar)
    ├── hud.css             → HUD vies + rang + portrait joueur (sidebar gauche, haut),
    │                          compteur de vagues en mode défense de Kage
    ├── inventory.css       → Barre d'inventaire compacte (icône+nom+×N), popup
    │                          d'utilisation d'objet, badge d'activation manuelle
    ├── arena.css           → Zone centrale : roues empilées, bouton "Tourner", bouton "Fuir"
    ├── recap.css           → Sidebar droite (portrait adversaire + historique compact des
    │                          combats) + styles compacts du récapitulatif de round (popup)
    ├── overlays.css        → Overlays plein écran (promotion, victoire, game over,
    │                          récapitulatif de round, popup objet, historique par
    │                          antagoniste, tutoriel objet manuel, classement)
    └── illustrations.css   → Classes décoratives (badges, rangs, raretés) — partiellement mortes (BUGS.md #7)

js/
├── data.js               → Données statiques : rangs, villages, styles, personnages
│                            jouables (par village), antagonistes (par rang, et par
│                            village pour Genin/Chûnin), portraits, objets de loot,
│                            palettes de couleurs
├── engine.js              → Moteur de jeu (IIFE `Engine`) : état global, portraits,
│                            inventaire/butin (empilement des consommables), courbe de
│                            difficulté d'examen, mode défense de Kage, classement de
│                            session. Aucune manipulation du DOM.
├── wheel.js               → Moteur de dessin Canvas (IIFE `WheelEngine`) : dessin et
│                            animation des roues, détection du segment sous le pointeur
│                            (pour synchroniser le son de tic). Ne connaît rien de
│                            l'état du jeu.
└── ui/
    ├── ui-core.js          → Utilitaires DOM de base ($ , showScreen), anti-clickjacking, hashStr
    ├── ui-audio.js         → Effets sonores synthétisés (tic de roue, résultat, butin,
    │                          promotion, game over) + bouton couper le son
    ├── ui-svg.js            → Génération procédurale de SVG (badges d'ennemis, emblèmes de rang)
    ├── ui-hud.js            → HUD vies + rang + portrait du joueur (sidebar gauche, haut)
    ├── ui-village.js        → Écran de sélection du village, démarrage/reset de partie
    ├── ui-inventory.js      → Barre d'inventaire, popup d'utilisation d'objet, tutoriel
    │                          objets à activation manuelle
    ├── ui-round.js          → Construction et pilotage du round : empilement des roues,
    │                          spin séquentiel, fuite de combat, vagues du mode défense de Kage
    ├── ui-recap.js          → Récapitulatif de round, analyses combat/examen, historique
    │                          des combats (par antagoniste et liste compacte globale),
    │                          portrait de l'adversaire du round en cours
    └── ui-overlays.js       → Overlays plein écran (promotion, victoire → mode défense de
                               Kage, game over normal/défense, classement)
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
       → l'antagoniste tiré dépend du rang courant (et du village, pour Genin/Chûnin —
         rivalités lore-cohérentes, voir data.js → ANTAGONISTS et section 6)

3. Joueur clique "⚡ Tourner" pour chaque roue du round (ou "Fuir" si un objet
   "Bombe Fumigène" est armé, voir ci-dessous)
   → ui-round.js → spinCurrent()
     → selon l'étape courante : WheelEngine.spinGeneric() (perso/antag),
       WheelEngine.spinIssue() (combat, avec Engine.computeIssueWeights()),
       WheelEngine.spinLoot() (butin — voir Engine.buildLootPool(size, guaranteed) :
       butin garanti sur victoire nette, 40% de chances seulement sur match nul ou
       défaite survécue, en mode normal comme en défense de Kage), ou
       WheelEngine.spinIssue() de nouveau (examen, avec Engine.computeExamenWeights() —
       la difficulté baisse à chaque victoire en combat et atteint 100% de réussite au
       bout de 5 victoires sans avoir réussi l'examen)
     → chaque roue joue un tic sonore synchronisé sur les changements de segment sous le
       pointeur pendant l'animation (voir wheel.js → onTick / ui-audio.js → playTickSound())
     → au résultat : Engine.setResult(), puis selon l'étape :
         - "issue"  → applyIssue() → Engine.applyOutcome() (vies, historique par
                       antagoniste figé/portrait figé, phase="loot", historique des
                       combats mis à jour instantanément — voir updateCollection()) ;
                       seule une victoire nette fait progresser G.wins et, en mode
                       défense de Kage, le compteur de vagues repoussées
                       (Engine.recordKageWave()) — un match nul est un statu quo pur
         - "loot"   → Engine.addLoot() (empile les objets consommables déjà possédés au
                       lieu de les dupliquer) ; si !G.examReady → showRoundSummary() (ou
                       enchaîne directement sur la vague suivante en mode défense de Kage)
         - "examen" → Engine.applyExamen() (rang, victoire) → showVictory() / showPromotion() / showExamFailure()
     → un son de résultat (victoire/nul/défaite), de butin ou de promotion est joué à
       chaque étape pertinente (voir ui-audio.js)
     → sinon, passe à la roue suivante via transitionToNext()

4. L'UI se met à jour après chaque étape
   → ui-hud.js       → updateHUD() (vies, rang, portrait du joueur — évolue avec le rang)
   → ui-inventory.js → updateInventoryBar() (objets à activation manuelle mis en avant ;
                        un tutoriel s'affiche la première fois qu'on en obtient un)
   → ui-recap.js     → showCombatAnalysis() / showExamenAnalysis() avant chaque spin
                        pertinent, showRoundSummary() / showExamFailure() en fin de round,
                        portrait live de l'adversaire pendant le combat

5. Fin de round / de partie
   → Round terminé sans promotion → bouton "⚡ Round suivant" (popup) → ui-round.js →
     nextRound() → reconstruit un nouveau round (retour à l'étape 3) → sauvegarde la
     partie (Engine.saveGame(), voir point 7 ci-dessous)
   → Promotion de rang → ui-overlays.js → showPromotion() → closePromo() → showRoundSummary()
   → Rang Kage atteint → ui-overlays.js → showVictory() → closeKage() →
     Engine.enterKageDefense() → le jeu enchaîne directement sur la 1ère vague du mode
     défense (pas de retour à l'écran village ici) → Engine.saveGame()
   → Mode défense de Kage → chaque vague gagnée nettement incrémente le score de la
     partie (G.kageDefenseKills — un match nul ne compte pas) ; continue indéfiniment
     jusqu'au game over ; chaque nouvelle vague resauvegarde la partie
   → Game over (0 vie, en progression normale ou en défense de Kage) → spinCurrent()
     détecte combatResult.gameOver → ui-overlays.js → showGameOver() (texte différent
     selon le mode ; après un délai de 900ms, le temps du flash de défaite) →
     closeGameOver() → Engine.recordRun() (ajoute la partie au classement de session,
     voir section 4) → Engine.deleteSaveGame() (plus rien à reprendre) →
     Engine.fullReset() → retour à l'écran de sélection de village

6. Consultation du classement (à tout moment, écran village ou sidebar en jeu)
   → bouton "Classement" → ui-overlays.js → openScoreboard() → Engine.getScoreboard()
     (trié par vagues de défense de Kage repoussées, puis rang, puis badges) → closeScoreboard()

7. Sauvegarde et reprise de partie (voir aussi section 4 — persistance)
   → À chaque limite "propre" de round (nextRound(), continueKageDefense(), closeKage(),
     démarrage de partie via startGame()) → Engine.saveGame() → écrit tout `G` dans
     localStorage. Jamais appelée en cours de spin — impossible de reprendre une partie
     au milieu d'un tirage en suspens.
   → Au chargement de la page (ou après un game over/redémarrage manuel) →
     ui-village.js → updateResumeButton() → affiche ou masque le bouton "Reprendre la
     partie en cours" selon Engine.hasSaveGame()
   → Clic sur "Reprendre" → ui-village.js → resumeSavedGame() → Engine.loadGame()
     (restaure `G`) → buildRound() reconstruit le round courant depuis les champs
     persistants restaurés (village, perso, inventaire, rang, historique…) exactement
     comme un round fraîchement commencé
```

---

## 4. Carte des Dépendances

```
data.js        ← aucune dépendance (source)
engine.js      ← data.js
wheel.js       ← data.js
ui-core.js     ← aucune dépendance
ui-audio.js    ← aucune dépendance
ui-svg.js      ← data.js, ui-core.js
ui-hud.js      ← data.js, engine.js, ui-core.js, ui-svg.js
ui-village.js  ← data.js, engine.js, ui-core.js, ui-round.js (buildRound(), _stepIdx/_stepRots),
                 ui-hud.js, ui-inventory.js, ui-recap.js (updateCollection(), pour resumeSavedGame())
ui-inventory.js← data.js, engine.js, ui-core.js, ui-hud.js, ui-round.js (updateFleeButtonVisibility)
ui-round.js    ← data.js, engine.js, wheel.js, ui-core.js, ui-audio.js, ui-hud.js,
                 ui-inventory.js, ui-recap.js (…, updateCollection()),
                 ui-overlays.js (showVictory/showPromotion/showExamFailure)
ui-recap.js    ← data.js, engine.js, ui-core.js, ui-svg.js
ui-overlays.js ← engine.js, ui-core.js, ui-audio.js, ui-svg.js, ui-hud.js, ui-recap.js,
                 ui-village.js (…, updateResumeButton()),
                 ui-round.js (_stepIdx, _stepRots — variables partagées, pas des exports)
index.html     ← tous les fichiers ci-dessus (confirmRestart() inline appelle Engine
                 et plusieurs fonctions ui/*.js globales)
```

**Règle :** `engine.js` et `wheel.js` ne manipulent jamais le DOM directement — seuls les
fichiers `ui/*.js` le font. `engine.js` ne dépend jamais d'un fichier `ui/*.js` (le sens
de dépendance est toujours UI → Engine, jamais l'inverse). `wheel.js` ne connaît rien de
`Engine` ni de l'état du jeu : sa détection de segment sous le pointeur (`onTick`) reçoit
uniquement des poids et un callback générique, appelé par `ui-round.js` qui, lui, sait
que ce callback doit jouer un son (`ui-audio.js`).

**Point d'attention :** `ui-overlays.js` et `ui-round.js` partagent directement les
variables `_stepIdx` et `_stepRots` (définies dans ui-round.js, réassignées dans
ui-overlays.js lors d'un reset ou de l'entrée en mode défense de Kage). Ce couplage
fonctionne uniquement parce que tous les fichiers `ui/*.js` s'exécutent dans le même
scope global (pas de modules ES réels, juste des balises `<script>` classiques) — voir
section 5.

**Classement de session :** `SCOREBOARD` (dans `engine.js`) est une constante de module
déclarée **en dehors** de l'objet d'état `G`, volontairement : `Engine.fullReset()` (fin
de partie → retour à l'écran village) réinitialise `G` mais ne doit **pas** effacer les
parties précédentes du classement. Chargé une fois depuis localStorage au démarrage du
module (`_loadScoreboard()`) et réécrit en entier à chaque partie terminée
(`recordRun()` → `_persistScoreboard()`) : il survit donc aussi bien à `fullReset()`
qu'à un rechargement de page.

**Sauvegarde/reprise :** seul mécanisme de persistance de ce jeu, entièrement local —
`Engine.saveGame()`/`loadGame()`/`hasSaveGame()`/`deleteSaveGame()` lisent et écrivent la
clé localStorage `"ndw_save_v1"` (le classement utilise une clé séparée,
`"ndw_scoreboard_v1"`). Aucune base de données, aucun compte, aucune requête réseau —
tout reste sur la machine du joueur. `saveGame()` n'est appelée qu'à une limite "propre"
de round (jamais en cours de spin), pour ne jamais reprendre une partie au milieu d'un
tirage en suspens (voir section 3, point 7).

---

## 5. Conventions du Projet

### Nommage
- **Fichiers :** kebab-case pour les fichiers `ui/` (`ui-hud.js`, `ui-round.js`) ;
  nom simple pour les modules racine (`data.js`, `engine.js`, `wheel.js`)
- **Fonctions publiques :** camelCase (`applyOutcome`, `buildRound`, `updateHUD`)
- **Fonctions/variables internes à un module :** préfixe `_` (`_stepIdx`, `_itemBonusText`, `_segmentAtPointer`)
- **Constantes de données :** SCREAMING_SNAKE_CASE (`RANKS`, `ANTAGONISTS`, `LOOT_POOL`, `CHARACTER_PORTRAITS`)
- **État global :** objet unique `G` encapsulé dans l'IIFE `Engine`, exposé en lecture
  via `Engine.getState()` — jamais de variable d'état globale en dehors de `engine.js`
  (à la seule exception documentée de `SCOREBOARD`, voir section 4)

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
- Toute donnée statique (rangs, personnages, ennemis, portraits, objets, couleurs) va
  dans `data.js`. Un personnage ou un antagoniste sans portrait dans
  `CHARACTER_PORTRAITS` ne doit pas exister dans `STARTERS`/`ANTAGONISTS` (voir section 6).
- Les objets de loot **consommables** (`heal`, `chance`, `boost_issue`, `boost_examen`,
  `skip_fight`) s'empilent dans l'inventaire via un champ `count` (voir
  `Engine.addLoot()`/`_consumeOne()`) plutôt que d'être dupliqués ; les objets permanents
  (`bonus_xp_N`) restent uniques et sont exclus du pool de butin futur une fois possédés
  (voir `buildLootPool()`).
- Les objets à **activation manuelle** (`boost_issue`, `boost_examen`, `skip_fight`) ne
  produisent aucun effet tant que le joueur ne les arme pas explicitement depuis
  l'inventaire (voir `Engine.isManualUseItem()`, `ui-inventory.js` → `openItemUsePopup()`).
- Le son est toujours synthétisé (Web Audio API), jamais chargé depuis un fichier —
  contrainte de la CSP (`img-src 'self' data:`, aucune ressource réseau externe
  autorisée). Voir `ui-audio.js`.
- Un match nul est un statu quo pur : aucune fonction ne doit le traiter comme une
  victoire (progression de rang, butin garanti, vague de défense de Kage comptée) ni
  comme une défaite (perte de vie). Seul `outcomeIdx === 0` (Victoire nette) déclenche un
  effet positif — voir `Engine.applyOutcome()`.
- `Engine.saveGame()` n'est appelée qu'à une limite "propre" de round (juste après que
  les roues d'un nouveau round/d'une nouvelle vague ont été (re)dessinées), jamais en
  cours de spin — une reprise de partie ne doit jamais tomber au milieu d'un tirage en
  suspens. Voir section 4 pour le détail du mécanisme de sauvegarde.

### Ordre de chargement des `<script>`
L'ordre dans `index.html` est contraint par les dépendances :
```
data.js → engine.js → wheel.js
  → ui-core.js → ui-audio.js → ui-svg.js → ui-hud.js → ui-village.js
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
   (rivalité de village lore-cohérente — un genin de Suna affronte typiquement un genin
   de Konoha, etc. ; l'objectif est un "au mieux", pas une exactitude canon parfaite) ou
   dans `ANTAGONISTS["Jônin"|"Kage"]` (liste unique, partagée par tous les villages —
   menaces globales type Akatsuki), en respectant le typedef `AntagonistData` (name,
   weakness, resistance)
2. Ajouter son portrait dans `CHARACTER_PORTRAITS` (chemin unique, ou `{young, adult}`
   si son apparence change entre Part I/II) — **ne pas ajouter d'antagoniste sans
   portrait disponible**, voir section 5
3. Aucun autre fichier à modifier — `engine.js` lit `ANTAGONISTS` dynamiquement via
   `getAntags()`/`getAntagData()`, et résout le portrait via `getPortrait()`

### Ajouter un nouveau personnage jouable
1. Ouvrir `js/data.js` → ajouter une entrée dans `STARTERS["<Village>"]`,
   en respectant le typedef `StarterData` (name, style, canBeGenin)
2. Ajouter son portrait dans `CHARACTER_PORTRAITS` (voir ci-dessus — même règle : pas de
   personnage sans portrait)
3. Aucun autre fichier à modifier

### Ajouter un nouvel objet de loot
1. Ouvrir `js/data.js` → ajouter dans `LOOT_POOL`, en respectant le typedef `LootItemData`
   (penser à `effect` si l'objet doit avoir un comportement particulier : `heal`,
   `chance`, `boost_issue`, `boost_examen`, `skip_fight`, ou une nouvelle valeur)
2. Si le type est nouveau (ni weapon/ninjutsu/taijutsu/genjutsu/heal/chance/boost/skip) :
   - Ajouter une entrée dans `TYPE_CSS` (couleur inventaire) et `LOOT_WHEEL_COLORS`
     (couleur roue butin)
   - Créer la classe CSS correspondante dans `css/components/inventory.css`
   - Adapter `js/engine.js` → `computeIssueWeights()`/`computeExamenWeights()` si le
     nouveau type doit apporter un bonus de poids
   - Adapter `js/ui/ui-inventory.js` → `_itemBonusText()` pour décrire son effet
3. Si l'objet ne doit produire son effet **que sur activation manuelle du joueur**
   (comme `boost_issue`/`boost_examen`/`skip_fight`), l'ajouter à la liste vérifiée par
   `Engine.isManualUseItem()` — il sera alors mis en avant dans la barre d'inventaire
   (badge 🥷) et déclenchera le tutoriel la première fois qu'il est obtenu
4. Si l'objet est **consommable** (peut être ramassé plusieurs fois, s'empile via
   `count`), l'ajouter à la logique de `_isConsumableItem()` dans `engine.js` — sinon il
   sera traité comme un objet permanent unique (dupliqué, jamais ré-obtenu ensuite)

### Modifier la logique de progression de rang ou la difficulté de l'examen
1. Ouvrir `js/data.js` → ajuster `RANKS` (ordre, couleurs, titres) ou `WINS_PER_RANK`
   (nombre de victoires en combat nécessaires pour atteindre 100% de réussite garantie
   à l'examen si celui-ci n'a toujours pas été réussi)
2. Ouvrir `js/engine.js` → `computeExamenWeights()` calcule la difficulté à partir de
   `G.wins` (progression linéaire vers 100% de réussite) puis ajoute les bonus
   d'inventaire par-dessus — ajuster cette fonction pour changer la courbe de base

### Ajouter/ajuster le mode défense de Kage
1. Ouvrir `js/engine.js` → `enterKageDefense()` (entrée dans le mode), `recordKageWave()`
   (comptage des vagues repoussées — uniquement sur victoire nette), `buildLootPool()`
   (butin garanti sur victoire, 40% de chances sinon, via le champ `forcedWeight` d'un
   item "Rien cette fois" — voir le typedef `LootItemData` ; même règle en mode normal)
2. Ouvrir `js/ui/ui-round.js` → `buildSteps()` (n'inclut plus l'étape "examen" tant que
   `G.kageDefense` est vrai) et `continueKageDefense()` (enchaînement des vagues)
3. Ouvrir `js/ui/ui-overlays.js` → `closeKage()` (bascule dans le mode au lieu d'un reset
   complet) et `showGameOver()` (texte spécifique au mode défense)

### Ajouter un effet visuel sur une roue
1. Ouvrir `js/wheel.js` → modifier `draw()` (rendu bas niveau, partagé par toutes les roues)
   ou une des fonctions spécialisées (`drawLoot`, `drawGeneric`)
2. Ne pas toucher aux autres fichiers — `wheel.js` ne dépend que de `data.js`

### Ajouter/ajuster un effet sonore
1. Ouvrir `js/ui/ui-audio.js` → ajouter une fonction `play<Nom>Sound()` construite sur
   `_playTone(freq, duration, type, peakGain, delay)` (une ou plusieurs notes courtes ;
   respecter le volume bas déjà en place pour rester discret)
2. L'appeler depuis le fichier `ui/*.js` responsable de l'événement concerné (ne jamais
   appeler `ui-audio.js` depuis `engine.js`/`wheel.js`, qui ne touchent pas au DOM/aux
   effets de présentation)
3. Le tic de roue est un cas particulier : il est piloté par `wheel.js` lui-même via le
   paramètre `onTick` de `spin()`/`spinIssue()`/`spinLoot()`/`spinGeneric()`, appelé
   uniquement quand le segment sous le pointeur change réellement pendant l'animation
   (voir `_segmentAtPointer()`) — pas de minuteur indépendant à gérer

### Ajouter un nouvel écran ou overlay
1. Ajouter le markup dans `index.html` (suivre le pattern `.screen` ou `.overlay` existant)
2. Créer un fichier `css/components/<nom>.css` dédié et le linker dans `<head>`, ou
   étendre `overlays.css` si c'est un simple overlay plein écran de plus
3. Créer un fichier `js/ui/ui-<nom>.js` avec le module header standard (voir section 5),
   et l'ajouter à `index.html` **après** `ui-core.js` (et après tout fichier dont il dépend)

### Ajouter un nouveau point de sauvegarde (limite de round)
1. Repérer l'endroit dans `js/ui/*.js` où un nouveau round (ou une nouvelle vague de
   défense de Kage) vient d'être construit — juste après un appel à `buildRound()`
2. Ajouter `Engine.saveGame();` juste après (voir `nextRound()`, `continueKageDefense()`,
   `closeKage()` dans `ui-round.js`/`ui-overlays.js` pour des exemples) — ne jamais
   l'appeler pendant qu'une roue tourne (`G.round.spinning === true`)
3. Si un nouvel état de partie doit être effacé en fin de partie (comme
   `Engine.deleteSaveGame()` l'est dans `closeGameOver()`), l'ajouter au même endroit

---

## 7. Bugs Connus

Voir [`BUGS.md`](./BUGS.md) à la racine du projet — 9 bugs recensés à ce jour, tous
corrigés (le seul de gravité élevée, BUGS.md #1 `showGameOver()` jamais invoquée, comme
les 8 autres qui étaient du code ou du CSS mort sans impact fonctionnel visible).

---

## 8. Historique des Versions d'Architecture

| Version | Date | Description |
|---------|------|-------------|
| 1.0 | (historique, avant refactoring) | Architecture monolithique : `data.js`, `engine.js`, `wheel.js`, `ui.js` (un seul fichier UI) et 2 CSS (`style.css`, `illustrations.css`) |
| 2.0 | 2026-07-03 | Refactoring modulaire Phase 1 — découpage de `ui.js` en 8 fichiers `js/ui/*.js` par zone d'écran, et des 2 CSS en `css/base.css` + 8 `css/components/*.css`. Phase 2 : documentation JSDoc exhaustive de tous les fichiers `.js` et rédaction de ce fichier. |
| 3.0 | 2026-07-06 | Suppression du système d'"époque" aléatoire caché : `STARTERS` reclassé par village uniquement, `ANTAGONISTS` reclassé par rang (et par village pour Genin/Chûnin — rivalités lore-cohérentes), rangs Jônin/Kage partagés (menaces globales). Ajout des portraits (`CHARACTER_PORTRAITS`, `Engine.getPortrait()`) pour joueur et antagonistes, évoluant avec le rang et figés dans l'historique une fois un combat résolu ; suppression des personnages/antagonistes sans image disponible. Refonte du butin : empilement des consommables (`count`), objets soin/fuite de combat, objets à activation manuelle (`isManualUseItem()` + tutoriel). Refonte de la difficulté d'examen : ramp progressive basée sur les victoires en combat, 100% garanti après `WINS_PER_RANK` victoires sans réussite. Ajout du mode défense sans fin après le rang Kage (`G.kageDefense`, vagues, butin à 25% via roue dédiée) et d'un classement de session (`SCOREBOARD`, `Engine.recordRun()`/`getScoreboard()`, overlay dédié). Ajout de `ui-audio.js` : effets sonores synthétisés (Web Audio API, pas de fichier — contrainte CSP) pour le tic de roue (synchronisé sur les changements de segment sous le pointeur via `wheel.js` → `onTick`/`_segmentAtPointer()`, s'arrête naturellement avec l'animation), les résultats, le butin, les promotions et le game over, avec bouton pour couper le son. Compaction du récapitulatif de round et de l'historique des combats (listes en une ligne, portraits réduits) pour réduire le scroll. |
| 3.1 | 2026-07-06 | Ajout d'un système de sauvegarde/reprise 100% local (`localStorage`, aucune base de données) : `Engine.saveGame()`/`loadGame()`/`hasSaveGame()`/`deleteSaveGame()`, sauvegarde automatique à chaque limite propre de round (jamais en cours de spin), bouton "Reprendre la partie en cours" sur l'écran de village (`ui-village.js` → `updateResumeButton()`/`resumeSavedGame()`). `SCOREBOARD` persiste désormais lui aussi dans localStorage (`_loadScoreboard()`/`_persistScoreboard()`), et survit donc à un rechargement de page (plus seulement à `fullReset()`). Correction : l'historique des combats (`updateCollection()`) se rafraîchissait uniquement en fin de round via `showRoundSummary()` — jamais en mode défense de Kage, qui ne passe pas par cet écran — il est maintenant mis à jour instantanément dans `ui-round.js` → `applyIssue()`, dès la résolution de chaque combat. Correction d'un bug où un "match nul" était compté comme une victoire (incrémentait `G.wins` et le score de vagues en défense de Kage, à cause d'un champ `xp` mal exploité) : un match nul est désormais un statu quo pur (`outcomeIdx === 0` uniquement). Refonte du butin : fusion de `buildLootPool()`/`buildKageLootPool()` en une seule fonction paramétrée — butin garanti sur victoire nette, 40% de chances seulement sur match nul/défaite survécue, même règle en mode normal et en défense de Kage (remplace l'ancien taux fixe de 25% spécifique à la défense de Kage). |
