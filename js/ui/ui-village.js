/**
 * @file ui-village.js
 * @module ui/village
 * @description Écran de sélection du village, démarrage de partie, initialisation au chargement.
 *              Extrait de ui.js lors du refactoring Phase 1.
 *
 * @dependencies
 *   - ../data.js   → VILLAGES
 *   - ../engine.js → Engine.setVillage(), Engine.newRound()
 *   - ui-core.js   → $(), showScreen()
 *   - ui-round.js  → buildRound()
 *   - ui-hud.js    → updateHUD()
 *   - ui-inventory.js → updateInventoryBar()
 *
 * @exports (fonctions globales)
 *   - buildVillageScreen()
 *   - resetVillageSelection()
 *   - selectVillage(id, cardEl)
 *   - confirmVillage()
 *   - startGame()
 *   - resetRecapPanel()
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
 *   updateHUD(), updateInventoryBar(), masque #collSection, appelle resetRecapPanel()
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
  showScreen("screenVillage");
});
