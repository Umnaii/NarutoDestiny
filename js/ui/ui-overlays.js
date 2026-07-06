/**
 * @file ui-overlays.js
 * @module ui/overlays
 * @description Overlays plein écran : promotion de rang, victoire (Kage) — qui bascule
 *              ensuite en mode défense sans fin —, game over (normal ou défense de Kage).
 *              Extrait de ui.js lors du refactoring Phase 1.
 *
 * @dependencies
 *   - ../engine.js → Engine.currentRank(), Engine.getState(), Engine.fullReset(),
 *                    Engine.enterKageDefense(), Engine.recordRun(), Engine.getScoreboard(),
 *                    Engine.saveGame(), Engine.deleteSaveGame()
 *   - ui-core.js   → $(), showScreen()
 *   - ui-audio.js  → playPromotionSound(), playGameOverSound()
 *   - ui-svg.js    → makeRankEmblem()
 *   - ui-hud.js    → updateRankHUD(), updateHUD(), animFill()
 *   - ui-recap.js  → showRoundSummary()
 *   - ui-inventory.js → updateInventoryBar()
 *   - ui-village.js → buildVillageScreen(), resetVillageSelection(), updateResumeButton()
 *   - ui-round.js  → _stepIdx, _stepRots (réinitialisés directement), buildRound()
 *
 * @exports (fonctions globales)
 *   - showPromotion(), closePromo(), showVictory(), closeKage(),
 *     showGameOver(), closeGameOver(), openScoreboard(), closeScoreboard()
 */

// ── OVERLAYS ──────────────────────────────────────────────────
/**
 * @description Affiche l'overlay de promotion de rang, sauf si le nouveau rang est
 *              Kage — dans ce cas délègue à showVictory() (le rang le plus élevé
 *              n'a pas d'overlay de "promotion" dédié, seulement l'écran de victoire).
 *
 * @sideEffects
 *   Remplit #promoTitle/#promoSub/#promoEmb, affiche l'overlay #promoOv, et remet la
 *   barre de progression du rang à 0 (animation vers le nouveau rang)
 */
function showPromotion() {
  const rank = Engine.currentRank();
  const isKage = rank.name === "Kage";
  if (isKage) { showVictory(); return; }

  $("promoTitle").textContent = rank.name;
  $("promoSub").textContent   = rank.title + " !";
  // SÉCURITÉ : makeRankEmblem — constantes uniquement
  $("promoEmb").innerHTML     = makeRankEmblem(rank, 88);
  $("promoOv").classList.add("show");
  animFill("rankFillHUD", 0);
  playPromotionSound();
}

/**
 * @description Ferme l'overlay de promotion et enchaîne sur le rafraîchissement du
 *              HUD (nouveau rang) puis l'affichage du récapitulatif du round.
 *
 * @sideEffects
 *   Retire la classe `.show` de #promoOv, appelle updateRankHUD() et showRoundSummary()
 */
function closePromo() {
  $("promoOv").classList.remove("show");
  updateRankHUD();
  showRoundSummary();
}

/**
 * @description Affiche l'overlay de victoire finale (rang Kage atteint) — annonce aussi
 *              que la partie continue ensuite en mode défense du village (voir
 *              closeKage() → Engine.enterKageDefense()).
 * @sideEffects
 *   Remplit #kageTtl/#kageSub/#kageEmb et affiche l'overlay #kageOv
 */
function showVictory() {
  const G    = Engine.getState();
  const rank = Engine.currentRank();
  const v    = G.round.results.village || "ton village";
  $("kageTtl").textContent = "Tu es Kage !";
  $("kageSub").textContent = "Kage de " + v + " — mais la légende ne s'arrête pas là : défends le village, vague après vague, aussi longtemps que possible.";
  // SÉCURITÉ : makeRankEmblem — constantes uniquement
  $("kageEmb").innerHTML   = makeRankEmblem(rank, 108);
  $("kageOv").classList.add("show");
  playPromotionSound();
}

/**
 * @description Ferme l'écran de victoire et fait entrer le joueur en mode défense de
 *              Kage (voir Engine.enterKageDefense()) : la partie ne se termine plus ici,
 *              elle continue indéfiniment (vagues d'ennemis, butin garanti sur victoire
 *              nette, 40% de chances sinon — voir Engine.buildLootPool()) jusqu'au game
 *              over. Reconstruit immédiatement l'arène pour la première vague.
 *
 * @sideEffects
 *   Retire la classe `.show` de #kageOv, appelle Engine.enterKageDefense(), réinitialise
 *   _stepIdx/_stepRots (définis dans ui-round.js), appelle buildRound(), updateHUD(),
 *   updateInventoryBar(), sauvegarde la partie (Engine.saveGame())
 */
function closeKage() {
  $("kageOv").classList.remove("show");
  Engine.enterKageDefense();
  _stepIdx  = 0;
  _stepRots = [0, 0, 0, 0, 0];
  buildRound(); // buildSteps() n'inclut plus que antag+issue tant que G.kageDefense est vrai
  updateHUD();
  updateInventoryBar();
  Engine.saveGame();
}

/**
 * @description Affiche l'overlay de game over. En mode défense de Kage (G.kageDefense),
 *              met en avant le nombre de vagues repoussées (le score de ce run) plutôt
 *              que l'antagoniste/village habituels. Appelée par ui-round.js →
 *              spinCurrent() (avec un délai de 900ms, le temps que le flash de défaite
 *              `.defeat-flash` se termine) quand `combatResult.gameOver` est vrai.
 *
 * @sideEffects
 *   Remplit #goVillage/#goAntag/#goBadges (ou #goKageWaves en mode défense), bascule
 *   l'affichage entre les deux variantes de texte, et affiche l'overlay #goOv
 */
function showGameOver() {
  const G = Engine.getState();
  $("goBadges").textContent  = G.badges.length;

  if (G.kageDefense) {
    $("goTitle").textContent = "Le village est tombé";
    $("goNormalText").style.display = "none";
    $("goKageText").style.display   = "block";
    $("goKageWaves").textContent    = G.kageDefenseKills;
  } else {
    $("goTitle").textContent = "Ton chemin de ninja s'arrête ici";
    $("goNormalText").style.display = "block";
    $("goKageText").style.display   = "none";
    $("goVillage").textContent = G.round.results.village || "...";
    $("goAntag").textContent   = G.round.results.antag   || "...";
  }

  $("goOv").classList.add("show");
  playGameOverSound();
}

/**
 * @description Ferme l'écran de game over et ramène le joueur à l'écran de sélection
 *              de village pour une nouvelle partie. Enregistre d'abord la partie dans le
 *              classement (voir Engine.recordRun(), getScoreboard()), puis efface sa
 *              sauvegarde (Engine.deleteSaveGame() — une partie terminée n'a plus rien à
 *              reprendre) avant que Engine.fullReset() ne remette l'état à zéro.
 *
 * @sideEffects
 *   Retire la classe `.show` de #goOv, retire `.in-game` du body, appelle
 *   Engine.recordRun(), Engine.deleteSaveGame(), Engine.fullReset() et
 *   resetVillageSelection(), réinitialise _stepIdx/_stepRots, reconstruit l'écran
 *   village (et le bouton "Reprendre" — désormais masqué) et l'affiche
 */
function closeGameOver() {
  $("goOv").classList.remove("show");
  document.body.classList.remove('in-game');
  Engine.recordRun();
  Engine.deleteSaveGame();
  Engine.fullReset();
  resetVillageSelection();
  _stepIdx  = 0;
  _stepRots = [0, 0, 0, 0, 0];
  buildVillageScreen();
  updateResumeButton();
  showScreen("screenVillage");
}

// ── CLASSEMENT ────────────────────────────────────────────────
/**
 * @description Affiche la popup de classement (voir Engine.getScoreboard()) : une ligne
 *              par partie terminée dans cette session, triée des runs les plus longues
 *              (le plus de vagues repoussées en mode défense de Kage) aux plus courtes.
 *              Accessible depuis l'écran de sélection de village et depuis la sidebar en
 *              jeu — n'efface rien, peut être ouverte à tout moment.
 *
 * @sideEffects
 *   Reconstruit #sbList, affiche l'overlay #scoreboardOv
 */
function openScoreboard() {
  const list = $("sbList");
  list.textContent = "";
  const runs = Engine.getScoreboard();

  if (!runs.length) {
    const empty = document.createElement("div");
    empty.className = "sb-empty";
    empty.textContent = "Aucune partie terminée pour l'instant — la première tentative écrira ta première ligne !";
    list.appendChild(empty);
  } else {
    runs.forEach((run, i) => {
      const row = document.createElement("div");
      row.className = "sb-row";

      const rank = document.createElement("div"); rank.className = "sb-rank"; rank.textContent = "#" + (i + 1);
      const info = document.createElement("div"); info.className = "sb-info";
      const line1 = document.createElement("div"); line1.className = "sb-village";
      line1.textContent = run.village + " · " + run.rank;
      const line2 = document.createElement("div"); line2.className = "sb-sub";
      line2.textContent = run.reachedKageDefense
        ? run.kageDefenseKills + " vague(s) repoussée(s) en défense de Kage · " + run.badges + " badges"
        : run.badges + " badges collectés";
      info.appendChild(line1); info.appendChild(line2);

      row.appendChild(rank); row.appendChild(info);
      list.appendChild(row);
    });
  }

  $("scoreboardOv").classList.add("show");
}

/**
 * @description Ferme la popup de classement.
 * @sideEffects
 *   Retire la classe `.show` de #scoreboardOv
 */
function closeScoreboard() {
  $("scoreboardOv").classList.remove("show");
}
