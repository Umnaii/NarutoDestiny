/**
 * @file ui-overlays.js
 * @module ui/overlays
 * @description Overlays plein écran : promotion de rang, victoire (Kage), game over.
 *              Extrait de ui.js lors du refactoring Phase 1.
 *
 * @dependencies
 *   - ../engine.js → Engine.currentRank(), Engine.getState(), Engine.fullReset()
 *   - ui-core.js   → $(), showScreen()
 *   - ui-svg.js    → makeRankEmblem()
 *   - ui-hud.js    → updateRankHUD(), animFill()
 *   - ui-recap.js  → showRoundSummary()
 *   - ui-village.js → buildVillageScreen(), resetVillageSelection()
 *   - ui-round.js  → _stepIdx, _stepRots (réinitialisés directement)
 *
 * @exports (fonctions globales)
 *   - showPromotion(), closePromo(), showVictory(), closeKage(),
 *     showGameOver(), closeGameOver()
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
 * @description Affiche l'overlay de victoire finale (rang Kage atteint).
 * @sideEffects
 *   Remplit #kageTtl/#kageSub/#kageEmb et affiche l'overlay #kageOv
 */
function showVictory() {
  const G    = Engine.getState();
  const rank = Engine.currentRank();
  const v    = G.round.results.village || "ton village";
  $("kageTtl").textContent = "Tu es Kage !";
  $("kageSub").textContent = "Kage de " + v + " — La légende est accomplie.";
  // SÉCURITÉ : makeRankEmblem — constantes uniquement
  $("kageEmb").innerHTML   = makeRankEmblem(rank, 108);
  $("kageOv").classList.add("show");
}

/**
 * @description Ferme l'écran de victoire et ramène le joueur à l'écran de sélection de
 *              village pour une nouvelle partie : réinitialise entièrement l'état de
 *              jeu et de sélection de village, remet à zéro le pilotage des roues.
 *
 * @sideEffects
 *   Retire la classe `.show` de #kageOv, retire `.in-game` du body, appelle
 *   Engine.fullReset() et resetVillageSelection(), réinitialise _stepIdx/_stepRots
 *   (définis dans ui-round.js), reconstruit l'écran village et l'affiche
 */
function closeKage() {
  $("kageOv").classList.remove("show");
  document.body.classList.remove('in-game');
  Engine.fullReset();
  resetVillageSelection();
  _stepIdx  = 0;
  _stepRots = [0, 0, 0, 0, 0];
  buildVillageScreen();
  showScreen("screenVillage");
}

/**
 * @description Affiche l'overlay de game over avec le village, l'antagoniste affronté
 *              et le nombre de badges collectés durant la partie. Appelée par
 *              ui-round.js → spinCurrent() (avec un délai de 900ms, le temps que le
 *              flash de défaite `.defeat-flash` se termine) quand
 *              `combatResult.gameOver` est vrai.
 *
 * @sideEffects
 *   Remplit #goVillage/#goAntag/#goBadges et affiche l'overlay #goOv
 */
function showGameOver() {
  const G = Engine.getState();
  $("goVillage").textContent = G.round.results.village || "...";
  $("goAntag").textContent   = G.round.results.antag   || "...";
  $("goBadges").textContent  = G.badges.length;
  $("goOv").classList.add("show");
}

/**
 * @description Ferme l'écran de game over et ramène le joueur à l'écran de sélection
 *              de village pour une nouvelle partie (même logique que closeKage()).
 *
 * @sideEffects
 *   Retire la classe `.show` de #goOv, retire `.in-game` du body, appelle
 *   Engine.fullReset() et resetVillageSelection(), réinitialise _stepIdx/_stepRots,
 *   reconstruit l'écran village et l'affiche
 */
function closeGameOver() {
  $("goOv").classList.remove("show");
  document.body.classList.remove('in-game');
  Engine.fullReset();
  resetVillageSelection();
  _stepIdx  = 0;
  _stepRots = [0, 0, 0, 0, 0];
  buildVillageScreen();
  showScreen("screenVillage");
}
