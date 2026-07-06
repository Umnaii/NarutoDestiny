/**
 * @file ui-village.js
 * @module ui/village
 * @description Écran de sélection du village, démarrage de partie, initialisation au chargement.
 *              Extrait de ui.js lors du refactoring Phase 1.
 *
 * @dependencies
 *   - ../data.js   → VILLAGES
 *   - ../engine.js → Engine.setVillage(), Engine.newRound(), Engine.saveGame(),
 *                    Engine.hasSaveGame(), Engine.loadGame()
 *   - ui-core.js   → $(), showScreen()
 *   - ui-round.js  → buildRound(), _stepIdx/_stepRots (variables partagées)
 *   - ui-hud.js    → updateHUD()
 *   - ui-inventory.js → updateInventoryBar()
 *   - ui-recap.js  → updateCollection()
 *
 * @exports (fonctions globales)
 *   - buildVillageScreen()
 *   - resetVillageSelection()
 *   - selectVillage(id, cardEl)
 *   - confirmVillage()
 *   - startGame()
 *   - resetRecapPanel()
 *   - updateResumeButton()
 *   - resumeSavedGame()
 */

// ── VILLAGE SELECT ───────────────────────────────────────────
/**
 * @description Reconstruit les cartes de sélection de village depuis VILLAGES (une
 *              carte cliquable par village). Appelée au chargement initial et à chaque
 *              retour à l'écran de sélection après une partie.
 *
 * @sideEffects
 *   Remplace le contenu de #villageCards, attache un listener click sur chaque carte
 *   (appelle selectVillage())
 */
function buildVillageScreen() {
  const container = $("villageCards");
  container.textContent = "";

  VILLAGES.forEach(v => {
    const card = document.createElement("div");
    card.className = "period-card";
    card.dataset.id = v.short;

    const em = document.createElement("span"); em.className = "pc-emoji";   em.textContent = v.emoji;
    const nm = document.createElement("div");  nm.className = "pc-name";    nm.textContent = v.short;
    const dc = document.createElement("div");  dc.className = "pc-desc";    dc.textContent = "Village du " + v.symbol;

    card.appendChild(em); card.appendChild(nm); card.appendChild(dc);
    card.addEventListener("click", () => selectVillage(v.short, card));
    container.appendChild(card);
  });
}

let _selectedVillageId = null;

/**
 * @description Réinitialise complètement l'état de sélection du village (variable +
 *              classe visuelle du bouton de confirmation, qui restait "ready" sinon
 *              après une première partie).
 *
 * @sideEffects
 *   Modifie _selectedVillageId, retire la classe `.ready` de #villageConfirm
 */
function resetVillageSelection() {
  _selectedVillageId = null;
  $("villageConfirm").classList.remove("ready");
}

/**
 * @description Sélectionne visuellement une carte de village et mémorise son id comme
 *              choix courant (pas encore confirmé — voir confirmVillage()).
 *
 * @param {string}      id     - Nom court du village choisi (VILLAGES[i].short)
 * @param {HTMLElement} cardEl - Élément DOM de la carte cliquée
 *
 * @sideEffects
 *   Modifie les classes CSS des cartes (`.selected`), modifie _selectedVillageId,
 *   ajoute la classe `.ready` à #villageConfirm
 */
function selectVillage(id, cardEl) {
  document.querySelectorAll("#villageCards .period-card").forEach(c => c.classList.remove("selected"));
  cardEl.classList.add("selected");
  _selectedVillageId = id;
  $("villageConfirm").classList.add("ready");
}

/**
 * @description Confirme le village sélectionné et démarre la partie. Ne fait rien si
 *              aucun village n'est sélectionné ou si Engine.setVillage() échoue.
 *
 * @sideEffects
 *   Appelle Engine.setVillage() puis startGame()
 */
function confirmVillage() {
  if (!_selectedVillageId) return;
  if (!Engine.setVillage(_selectedVillageId)) return;
  startGame();
}

// ── GAME SCREEN ───────────────────────────────────────────────
/**
 * @description Démarre une nouvelle partie : affiche l'écran de jeu, initialise le
 *              premier round côté moteur et côté UI, rafraîchit le HUD et
 *              l'inventaire, et remet la collection et le panneau de récapitulatif
 *              dans leur état initial.
 *
 * @sideEffects
 *   Ajoute `.in-game` au body, appelle showScreen(), Engine.newRound(), buildRound(),
 *   updateHUD(), updateInventoryBar(), masque #collSection, appelle resetRecapPanel(),
 *   sauvegarde la partie (Engine.saveGame())
 */
function startGame() {
  document.body.classList.add('in-game');
  showScreen("screenGame");
  Engine.newRound();
  buildRound();
  updateHUD();
  updateInventoryBar();
  $("collSection").classList.remove("show");
  resetRecapPanel();
  Engine.saveGame();
}

/**
 * @description Affiche ou masque le bouton "Reprendre la partie en cours" de l'écran de
 *              village, selon qu'une sauvegarde valide existe (voir Engine.hasSaveGame()).
 *              Appelée au chargement de la page et à chaque retour à l'écran de village
 *              en fin de partie (voir ui-overlays.js → closeGameOver(), index.html →
 *              confirmRestart()).
 *
 * @sideEffects
 *   Modifie l'affichage de #resumeBtn
 */
function updateResumeButton() {
  const btn = $("resumeBtn");
  if (!btn) return;
  btn.style.display = Engine.hasSaveGame() ? "block" : "none";
}

/**
 * @description Reprend la partie précédemment sauvegardée : recharge l'état global
 *              (voir Engine.loadGame()) puis affiche l'écran de jeu exactement comme un
 *              round fraîchement commencé — buildRound() régénère les roues du round en
 *              cours à partir du village/personnage/inventaire/rang restaurés (il
 *              rappelle Engine.newRound() en interne, sans effet destructeur puisque ce
 *              dernier ne fait que réinitialiser G.round à partir des champs persistants
 *              déjà restaurés). Ne fait rien si aucune sauvegarde valide n'est trouvée —
 *              le bouton ne devrait alors de toute façon plus être visible (voir
 *              updateResumeButton()).
 *
 * @sideEffects
 *   Appelle Engine.loadGame() ; si la sauvegarde est valide, ajoute `.in-game` au body,
 *   affiche l'écran de jeu, réinitialise _stepIdx/_stepRots, appelle buildRound(),
 *   updateHUD(), updateInventoryBar(), updateCollection(), resetRecapPanel()
 */
function resumeSavedGame() {
  if (!Engine.loadGame()) return;
  document.body.classList.add('in-game');
  showScreen("screenGame");
  _stepIdx  = 0;
  _stepRots = [0, 0, 0, 0, 0];
  buildRound(); // reconstruit le round courant depuis l'état restauré
  updateHUD();
  updateInventoryBar();
  updateCollection();
  resetRecapPanel();
}

/**
 * @description Referme la popup de récapitulatif de round, si elle est affichée.
 *
 * @sideEffects
 *   Retire la classe `.show` de #recapOv
 */
function resetRecapPanel() {
  $("recapOv").classList.remove("show");
}

// ── INIT ──────────────────────────────────────────────────────
window.addEventListener("DOMContentLoaded", () => {
  buildVillageScreen();
  updateResumeButton();
  showScreen("screenVillage");
});
