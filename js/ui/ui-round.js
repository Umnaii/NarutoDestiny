/**
 * @file ui-round.js
 * @module ui/round
 * @description Construction et pilotage du round : empilement des roues, spin séquentiel,
 *              application des résultats de combat/examen, fuite de combat (objet
 *              "skip_fight") et vagues sans fin du mode défense de Kage.
 *              Extrait de ui.js lors du refactoring Phase 1.
 *
 * @dependencies
 *   - ../data.js   → OUTCOMES, EXAMEN_OUTCOMES
 *   - ../engine.js → Engine.getState(), Engine.newRound(), Engine.computeIssueWeights(),
 *                    Engine.computeExamenWeights(), Engine.buildLootPool(), Engine.getStarters(),
 *                    Engine.getAntags(), Engine.setResult(), Engine.getPersoStyle(), Engine.setPerso(),
 *                    Engine.applyOutcome(), Engine.applyExamen(), Engine.isManualUseItem(),
 *                    Engine.useSkipFight(), Engine.recordKageWave(), Engine.saveGame()
 *   - ../kage-loot.js → KageLoot.buildPool() — règles de butin DÉDIÉES au mode défense
 *                    de Kage (25%/15%/0%), séparées de Engine.buildLootPool() (butin normal)
 *   - ../wheel.js  → WheelEngine.SZ, WheelEngine.draw(), WheelEngine.drawLoot(),
 *                    WheelEngine.spinIssue(), WheelEngine.spinLoot(), WheelEngine.spinGeneric()
 *   - ui-core.js   → $()
 *   - ui-audio.js  → playTickSound(), playResultSound(kind), playLootSound()
 *   - ui-hud.js    → updateHUD(), updatePersoPortrait()
 *   - ui-inventory.js → updateInventoryBar(), showManualUseTutorial()
 *   - ui-recap.js  → showCombatAnalysis(), showExamenAnalysis(), showRoundSummary(),
 *                    updateAntagPortrait(), updateCollection(), showSaveNotice()
 *   - ui-overlays.js → showVictory(), showPromotion(), showExamFailure() [showExamFailure vit dans ui-recap.js]
 *
 * @exports (fonctions globales)
 *   - buildSteps(), buildRound(), spinCurrent(), applyIssue(outcomeIdx),
 *     showStepResult(label, value, cls), nextRound(), updateFleeButtonVisibility(),
 *     fleeCombat(), continueKageDefense(), manualSaveGame()
 */

// ── ROUND BUILDER ─────────────────────────────────────────────
// Les STEPS varient selon la phase du jeu :
//   - 1er round / après game over : perso + antag + issue + loot [+ examen si examReady]
//   - Rounds suivants (perso fixé) : antag + issue + loot [+ examen si examReady]
//   - Après échec examen : antag + issue + loot + examen (directement)

/**
 * @description Calcule la séquence des étapes (roues) du round courant. La roue
 *              "Personnage" n'est incluse que si aucun personnage n'est encore fixé
 *              (premier round de la partie) ; "Antagoniste", "Combat" et "Butin" sont
 *              toujours présentes — y compris en mode défense de Kage (G.kageDefense).
 *              La roue Butin dépend de l'issue du combat de ce round, avec deux règles
 *              bien distinctes : butin normal (voir Engine.buildLootPool()) — garanti
 *              sur victoire nette, 40% de chances sinon — hors mode défense de Kage ; une
 *              fois Kage (voir KageLoot.buildPool()), 25% de chances sur victoire, 15%
 *              sur défaite survécue, 0% sur match nul. En mode défense de Kage, le round
 *              s'arrête là (pas d'Examen, rang déjà
 *              maximal) ; sinon, "Examen" est ajoutée en dernier — elle sera sautée à
 *              l'exécution si G.examReady est resté false après le loot (voir
 *              spinCurrent()).
 *
 * @returns {Object[]} Liste ordonnée d'étapes `{ id, label, canvasId, pal }` où `pal`
 *                     encode le type de roue : index de palette (>=0, roues génériques
 *                     perso/antag), -1 (combat), -2 (butin), -3 (examen)
 */
function buildSteps() {
  const G = Engine.getState();
  const hasPerso = !!G.perso;
  const steps = [];

  if (!hasPerso) {
    steps.push({ id:"perso",  label:"Personnage",  canvasId:"cvPerso", pal:0 });
  }
  steps.push({ id:"antag",  label:"Antagoniste", canvasId:"cvAntag", pal:1 });
  steps.push({ id:"issue",  label:"Combat",      canvasId:"cvIssue", pal:-1 });
  steps.push({ id:"loot",   label:"Butin",       canvasId:"cvLoot",  pal:-2 });

  if (!G.kageDefense) {
    // La roue examen est toujours ajoutée — elle sera sautée si !examReady après loot
    steps.push({ id:"examen", label:"Examen",      canvasId:"cvExamen",pal:-3 });
  }

  return steps;
}

let _STEPS    = [];
const _layerEls = [];
let   _lootPool = [];

/**
 * @description Construit l'arène de roues empilées pour un nouveau round : recrée les
 *              canvases de chaque étape (calculées par buildSteps()), dimensionne
 *              chacun à la résolution physique de l'écran (devicePixelRatio) pour un
 *              rendu net, dessine la première roue, révèle sa couche, réinitialise le
 *              bouton de spin et le libellé d'étape, puis démarre un nouveau round côté
 *              moteur (Engine.newRound()).
 *
 * @sideEffects
 *   Vide et reconstruit #stackWrap (retire les anciennes couches, ajoute les nouvelles),
 *   modifie _STEPS/_layerEls/_lootPool, modifie #stepRes/#srLbl/#srVal/#arenaStepLabel/
 *   #spinBtn, appelle Engine.newRound(), masque le portrait de l'adversaire du round
 *   précédent (updateAntagPortrait())
 */
function buildRound() {
  const wrap = $("stackWrap");
  _layerEls.forEach(l => l.remove());
  _layerEls.length = 0;

  _STEPS = buildSteps();

  _STEPS.forEach((step, i) => {
    const layer = document.createElement("div");
    layer.className = "wheel-layer";
    layer.id = "layer-" + i;

    const cv = document.createElement("canvas");
    cv.id = step.canvasId;
    // SÉCURITÉ/QUALITÉ : résolution physique = taille logique * devicePixelRatio
    // pour un rendu net (texte non flou) sur écrans Retina/HiDPI.
    const dpr = window.devicePixelRatio || 1;
    cv.width  = WheelEngine.SZ * dpr;
    cv.height = WheelEngine.SZ * dpr;
    cv.style.cssText = "width:100%;height:100%;border-radius:50%;display:block;";

    const dot = document.createElement("div"); dot.className = "wheel-dot";
    layer.appendChild(cv); layer.appendChild(dot);
    wrap.appendChild(layer);
    _layerEls.push(layer);
  });

  _initWheelDraw(0);
  revealLayer(0);

  $("stepRes").classList.remove("show");
  $("srLbl").textContent = "";
  $("srVal").textContent = "Lance la roue !";
  $("srVal").className   = "sr-val";
  $("arenaStepLabel").textContent = _STEPS[0].label;

  const btn = $("spinBtn");
  btn.disabled = false; btn.classList.remove("going");
  btn.textContent = "⚡ Tourner";

  Engine.newRound();
  updateAntagPortrait(); // masqué : le round qui commence n'a pas encore d'adversaire tiré
  updateFleeButtonVisibility();
}

/**
 * @description Dessine l'état initial (rotation 0) de la roue à l'étape donnée, avec
 *              la logique adaptée à son type : poids de combat calculés pour "Combat",
 *              tirage d'un nouveau pool pour "Butin" — deux systèmes bien distincts,
 *              volontairement séparés pour ne jamais les confondre : butin normal (voir
 *              Engine.buildLootPool()), garanti sur victoire nette et 40% de chances
 *              sinon ; ou, une fois Kage, butin dédié au mode défense (voir
 *              KageLoot.buildPool()), 25% de chances sur victoire, 15% sur défaite
 *              survécue, 0% sur match nul — poids d'examen calculés pour "Examen", ou
 *              candidats à parts égales pour les roues génériques (personnage/antagoniste).
 *
 * @param {number} stepIdx - Index de l'étape dans _STEPS à dessiner
 *
 * @sideEffects
 *   Redessine le canvas de l'étape ; modifie _lootPool si l'étape est "Butin"
 */
function _initWheelDraw(stepIdx) {
  const step = _STEPS[stepIdx];
  if (!step) return;
  if (step.pal === -1) {
    // Roue combat — dessinée d'emblée avec les poids calculés (parts proportionnelles)
    const weights = Engine.computeIssueWeights();
    const items   = weights.map(w => w.short);
    const colors  = weights.map(w => w.wheelColor);
    const w       = weights.map(w => w.weight);
    WheelEngine.draw(step.canvasId, items, colors, 0, w);
  } else if (step.pal === -2) {
    const G2 = Engine.getState();
    const outcomeIdx = G2.round.results.outcomeIdx;
    _lootPool = G2.kageDefense
      ? KageLoot.buildPool(4, outcomeIdx)               // règles dédiées : 25%/15%/0%
      : Engine.buildLootPool(8, outcomeIdx === 0);      // butin normal : garanti/40%
    WheelEngine.drawLoot(step.canvasId, _lootPool, 0);
  } else if (step.pal === -3) {
    // Roue examen — dessinée avec les poids calculés, parts proportionnelles
    const weights = Engine.computeExamenWeights();
    _drawExamen(step.canvasId, weights, 0);
  } else {
    const items = _getItems(stepIdx);
    WheelEngine.drawGeneric(step.canvasId, items, step.pal, 0);
  }
}

/**
 * @description Dessine la roue d'examen (2 segments : Réussite/Échec) avec des parts
 *              proportionnelles aux chances réelles calculées par
 *              Engine.computeExamenWeights().
 *
 * @param {string}   canvasId - id du canvas cible
 * @param {Object[]} weights  - Poids d'examen (voir Engine.computeExamenWeights())
 * @param {number}   rotation - Angle de rotation à dessiner, en radians
 *
 * @sideEffects
 *   Redessine le canvas #`canvasId`
 */
function _drawExamen(canvasId, weights, rotation) {
  const items  = weights.map(w => w.short);
  const colors = weights.map(w => w.wheelColor);
  const w      = weights.map(w => w.weight);
  WheelEngine.draw(canvasId, items, colors, rotation, w);
}

/**
 * @description Résout la liste de candidats à afficher pour une roue générique donnée
 *              (personnage ou antagoniste). Retourne un tableau vide pour les autres
 *              types d'étape (combat/butin/examen, gérés séparément).
 *
 * @param {number} stepIdx - Index de l'étape dans _STEPS
 *
 * @returns {string[]} Noms des candidats tirables pour cette étape
 */
function _getItems(stepIdx) {
  const step = _STEPS[stepIdx];
  if (!step) return [];
  switch (step.id) {
    case "perso":  return Engine.getStarters();
    case "antag":  return Engine.getAntags().map(a => a.name);
    default:       return [];
  }
}

/**
 * @description Rend visible la couche de roue à l'index donné (transition CSS d'entrée).
 * @param {number} i - Index de la couche dans _layerEls
 * @sideEffects
 *   Ajoute la classe `.vis` à la couche #`layer-${i}`, si elle existe
 */
function revealLayer(i) {
  if (_layerEls[i]) _layerEls[i].classList.add("vis");
}

/**
 * @description Anime la transition visuelle entre deux roues empilées : marque la
 *              couche courante comme terminée (elle recule visuellement), prédessine
 *              la roue suivante à rotation 0, puis (après 320ms, le temps de la
 *              transition CSS) révèle la couche suivante et met à jour le libellé
 *              d'étape.
 *
 * @param {number}   fromIdx - Index de la couche qui vient de terminer son spin
 * @param {number}   toIdx   - Index de la couche à révéler ensuite
 * @param {function} [onReady] - Callback appelé une fois la transition terminée
 *                              (immédiatement si l'une des couches est introuvable)
 *
 * @sideEffects
 *   Modifie les classes CSS des couches `fromIdx`/`toIdx`, redessine la roue `toIdx`,
 *   modifie #arenaStepLabel après le délai
 */
function transitionToNext(fromIdx, toIdx, onReady) {
  const from = _layerEls[fromIdx];
  const to   = _layerEls[toIdx];
  if (!from || !to) { if (onReady) onReady(); return; }

  from.classList.add("done");
  from.classList.remove("vis");
  _initWheelDraw(toIdx);

  setTimeout(() => {
    to.classList.add("vis");
    $("arenaStepLabel").textContent = _STEPS[toIdx].label;
    updateFleeButtonVisibility();
    if (onReady) onReady();
  }, 320);
}

// ── SPIN ──────────────────────────────────────────────────────
let _stepIdx  = 0;
let _stepRots = [0, 0, 0, 0, 0];

/**
 * @description Affiche ou masque le bouton "Fuir" à côté du bouton de spin : visible
 *              uniquement quand l'étape courante est "Combat" et que le joueur possède
 *              un objet "skip_fight" activé (voir Engine.isManualUseItem()). Appelée
 *              après chaque transition d'étape et après tout changement d'état "armé"
 *              d'un objet fuite (voir ui-inventory.js).
 *
 * @sideEffects
 *   Modifie l'affichage de #fleeBtn
 */
function updateFleeButtonVisibility() {
  const btn = $("fleeBtn");
  if (!btn) return;
  const step = _STEPS[_stepIdx];
  const G = Engine.getState();
  const canFlee = !!step && step.id === "issue" && !G.round.spinning &&
    G.inventory.some(it => it.effect === "skip_fight" && it.armed === true);
  btn.style.display = canFlee ? "inline-flex" : "none";
}

/**
 * @description Consomme un objet "skip_fight" activé pour éviter entièrement le combat
 *              en cours : ni victoire ni défaite, aucun badge, aucune entrée dans
 *              G.antagHistory, et pas de butin pour ce round (il n'y a pas eu de combat).
 *              Enchaîne ensuite exactement comme si le combat avait été résolu et le
 *              butin déjà passé : examen si prêt, sinon récapitulatif de round — ou
 *              vague suivante en mode défense de Kage (voir continueKageDefense()).
 *
 * @sideEffects
 *   Modifie l'état moteur (Engine.useSkipFight()), l'inventaire affiché, #fleeBtn,
 *   #spinBtn, et enchaîne sur transitionToNext(), showRoundSummary() ou
 *   continueKageDefense()
 */
function fleeCombat() {
  const G = Engine.getState();
  if (G.round.spinning) return;
  const step = _STEPS[_stepIdx];
  if (!step || step.id !== "issue") return;

  const res = Engine.useSkipFight();
  if (!res.ok) return;

  updateInventoryBar();
  showStepResult("Combat", "🏃 Combat évité — aucun butin cette fois", "loot");
  $("fleeBtn").style.display = "none";

  const btn = $("spinBtn");
  btn.disabled = true; btn.classList.remove("going");

  if (G.kageDefense) {
    Engine.recordKageWave(); // fuir compte aussi comme une vague passée
    setTimeout(continueKageDefense, 500);
    return;
  }

  const prevIdx = _stepIdx;
  if (!G.examReady) {
    _stepIdx = _STEPS.length; // termine le round : pas d'examen ce tour-ci
    btn.textContent = "✓ Round terminé !";
    setTimeout(showRoundSummary, 600);
    return;
  }
  const examenIdx = _STEPS.findIndex(s => s.id === "examen");
  _stepIdx = examenIdx !== -1 ? examenIdx : _STEPS.length;
  if (_stepIdx < _STEPS.length) {
    transitionToNext(prevIdx, _stepIdx, () => {
      btn.disabled = false; btn.textContent = "⚡ Tourner";
    });
  } else {
    btn.textContent = "✓ Round terminé !";
    setTimeout(showRoundSummary, 600);
  }
}

// ── DÉFENSE DE KAGE (mode sans fin) ───────────────────────────
/**
 * @description Enchaîne sur la vague suivante en mode défense de Kage, une fois la vague
 *              courante comptée si elle a été gagnée nettement (Engine.recordKageWave(),
 *              voir spinCurrent() après Combat, et fleeCombat()) et son butin éventuel
 *              résolu (roue Butin — règles dédiées au mode défense de Kage, voir
 *              KageLoot.buildPool() : 25% de chances sur victoire, 15% sur défaite
 *              survécue, 0% sur match nul) ou évité (fuite). Reconstruit immédiatement
 *              l'arène pour la prochaine paire antagoniste/combat/butin (buildSteps()
 *              n'inclut jamais l'Examen tant que G.kageDefense est vrai).
 *
 * @sideEffects
 *   Réinitialise _stepIdx/_stepRots, appelle buildRound(), updateHUD(),
 *   updateInventoryBar(), sauvegarde la partie (Engine.saveGame())
 */
function continueKageDefense() {
  _stepIdx  = 0;
  _stepRots = [0, 0, 0, 0, 0];
  buildRound(); // reconstruit antag+issue+butin (buildSteps() omet l'examen en mode défense)
  updateHUD();
  updateInventoryBar();
  Engine.saveGame();
}

/**
 * @description Pilote le spin de la roue de l'étape courante (_stepIdx) : choisit la
 *              logique de spin adaptée au type d'étape (examen, combat, butin, ou roue
 *              générique), déclenche l'animation, applique le résultat correspondant
 *              côté moteur (Engine), puis enchaîne sur l'étape suivante ou sur la
 *              conclusion du round (victoire, promotion, échec d'examen, ou
 *              récapitulatif) une fois l'animation terminée. Ne fait rien si une roue
 *              est déjà en train de tourner.
 *
 * @sideEffects
 *   Modifie G.round.spinning, #spinBtn, redessine/anime la roue courante, modifie
 *   G.round.results (via Engine.setResult()), modifie l'état du moteur (via
 *   applyIssue()/Engine.applyExamen()), enchaîne selon le cas sur transitionToNext(),
 *   showRoundSummary(), showVictory(), showPromotion(), showGameOver() ou
 *   showExamFailure()
 */
function spinCurrent() {
  const G = Engine.getState();
  if (G.round.spinning) return;
  G.round.spinning = true;
  updateFleeButtonVisibility(); // masqué pendant que la roue tourne

  const step = _STEPS[_stepIdx];
  const btn  = $("spinBtn");
  btn.disabled = true; btn.classList.add("going"); btn.textContent = "En rotation...";

  let spinPromise;

  if (step.pal === -3) {
    // ── Roue Examen ───────────────────────────────────────────
    const weights = Engine.computeExamenWeights();
    showExamenAnalysis(weights);
    spinPromise = WheelEngine.spinIssue({
      canvasId: step.canvasId,
      startRotation: _stepRots[_stepIdx],
      weights,
      onFrame: r => { _stepRots[_stepIdx] = r; },
      onTick: playTickSound,
    }).then(({ targetIndex, finalRotation }) => {
      _stepRots[_stepIdx] = finalRotation;
      const outcome = EXAMEN_OUTCOMES[targetIndex];
      Engine.setResult("examen", outcome.short);
      Engine.setResult("examenIdx", targetIndex);
      showStepResult(step.label, outcome.short, targetIndex === 1 ? "defeat" : "");
      playResultSound(targetIndex === 0 ? "win" : "loss");
    });

  } else if (step.pal === -1) {
    // ── Roue Issue (combat) ───────────────────────────────────
    const weights = Engine.computeIssueWeights();
    showCombatAnalysis(weights);
    spinPromise = WheelEngine.spinIssue({
      canvasId: step.canvasId,
      startRotation: _stepRots[_stepIdx],
      weights,
      onFrame: r => { _stepRots[_stepIdx] = r; },
      onTick: playTickSound,
    }).then(({ targetIndex, finalRotation }) => {
      _stepRots[_stepIdx] = finalRotation;
      const outcome = OUTCOMES[targetIndex];
      Engine.setResult("outcome", outcome.short);
      Engine.setResult("outcomeIdx", targetIndex);
      showStepResult(step.label, outcome.short, outcome.life < 0 ? "defeat" : "");
      playResultSound(targetIndex === 0 ? "win" : targetIndex === 1 ? "draw" : "loss");
    });

  } else if (step.pal === -2) {
    // ── Roue Loot (pool déjà tiré selon la règle applicable dans _initWheelDraw() :
    //    butin normal — Engine.buildLootPool() — ou, une fois Kage, règles dédiées au
    //    mode défense — KageLoot.buildPool()) ────────────────────
    spinPromise = WheelEngine.spinLoot({
      canvasId: step.canvasId,
      pool: _lootPool,
      startRotation: _stepRots[_stepIdx],
      onFrame: r => { _stepRots[_stepIdx] = r; },
      onTick: playTickSound,
    }).then(({ targetIndex, finalRotation, lootItem }) => {
      _stepRots[_stepIdx] = finalRotation;
      Engine.setResult("loot", lootItem);
      if (lootItem.effect === "none") {
        showStepResult(step.label, lootItem.emoji + " " + lootItem.name, "");
      } else {
        Engine.addLoot(lootItem);
        updateInventoryBar(); // le butin apparaît dans l'inventaire dès qu'il est gagné
        showStepResult(step.label, lootItem.name, "loot");
        playLootSound();
        if (Engine.isManualUseItem(lootItem) && !Engine.getState().seenManualUseTutorial) {
          showManualUseTutorial(lootItem);
        }
      }
    });

  } else {
    // ── Roues génériques (perso, antag) ───────────────────────
    const items = _getItems(_stepIdx);
    spinPromise = WheelEngine.spinGeneric({
      canvasId: step.canvasId,
      items,
      paletteIdx: step.pal,
      startRotation: _stepRots[_stepIdx],
      onFrame: r => { _stepRots[_stepIdx] = r; },
      onTick: playTickSound,
    }).then(({ targetIndex, finalRotation }) => {
      _stepRots[_stepIdx] = finalRotation;
      const result = items[targetIndex];
      Engine.setResult(step.id, result);
      if (step.id === "perso") {
        const style = Engine.getPersoStyle(result);
        Engine.setPerso(result, style);
        updatePersoPortrait();
      } else if (step.id === "antag") {
        updateAntagPortrait();
      }
      showStepResult(step.label, result, "");
    });
  }

  spinPromise.then(() => {
    G.round.spinning = false;
    btn.classList.remove("going");

    const prevStep = _STEPS[_stepIdx];

    // Après Issue : appliquer combat
    if (prevStep.id === "issue") {
      const combatResult = applyIssue(G.round.results.outcomeIdx);
      if (combatResult.gameOver) { setTimeout(showGameOver, 900); return; }
      // Vague comptée uniquement sur une victoire nette — un match nul est un statu quo,
      // il ne fait pas progresser le score de vagues repoussées (voir aussi G.wins dans
      // Engine.applyOutcome()). Compté avant même de savoir si la roue Butin (100% de
      // chances sur victoire, 40% sinon — voir Engine.buildLootPool()) donnera quelque chose.
      if (G.kageDefense && G.round.results.outcomeIdx === 0) Engine.recordKageWave();
    }

    // Après Loot : vague suivante en mode défense de Kage, sinon examen si prêt, sinon résumé
    if (prevStep.id === "loot") {
      const G2 = Engine.getState();
      if (G2.kageDefense) { setTimeout(continueKageDefense, 500); return; }
      if (!G2.examReady) {
        btn.textContent = "✓ Round terminé !"; btn.disabled = true;
        setTimeout(showRoundSummary, 600);
        return;
      }
    }

    // Après Examen : appliquer résultat
    if (prevStep.id === "examen") {
      const examResult = Engine.applyExamen(G.round.results.examenIdx);
      updateHUD();
      if (examResult.victory) { setTimeout(showVictory, 800); return; }
      if (examResult.passed)  { setTimeout(showPromotion, 600); return; }
      btn.textContent = "✓ Résultat"; btn.disabled = true;
      setTimeout(showExamFailure, 600);
      return;
    }

    // Passer à la roue suivante
    const prevIdx = _stepIdx;
    _stepIdx++;
    if (_stepIdx < _STEPS.length) {
      transitionToNext(prevIdx, _stepIdx, () => {
        btn.disabled = false;
        btn.textContent = "⚡ Tourner";
      });
    } else {
      btn.textContent = "✓ Round terminé !"; btn.disabled = true;
      setTimeout(showRoundSummary, 600);
    }
  });
}

/**
 * @description Applique le résultat de la roue de combat côté moteur, rafraîchit le
 *              HUD, l'inventaire et l'historique des combats (voir updateCollection()) —
 *              ce dernier reflète donc CE combat dès l'instant où il se termine, sans
 *              attendre le récapitulatif de fin de round (indispensable en mode défense
 *              de Kage, qui ne passe jamais par ce récapitulatif) —, et affiche les
 *              notices automatiques (talisman "chance" ou soin consommé) ou l'effet
 *              visuel de défaite le cas échéant.
 *
 * @param {number} outcomeIdx - Index dans OUTCOMES du résultat tiré
 *
 * @returns {Object} Le résultat de Engine.applyOutcome() (voir engine.js pour la forme
 *                   exacte : `{ usedChance, usedHeal, lifeChange, examReady, gameOver }`)
 *
 * @sideEffects
 *   Modifie l'état moteur (via Engine.applyOutcome()), rafraîchit le HUD, l'inventaire
 *   et l'historique des combats (updateCollection()), ajoute/affiche une notice
 *   (showChanceNotice()/showHealNotice()) ou déclenche l'effet visuel `.defeat-flash`
 *   sur le body en cas de défaite non annulée
 */
function applyIssue(outcomeIdx) {
  const result = Engine.applyOutcome(outcomeIdx);
  updateHUD();
  updateInventoryBar();
  updateCollection();
  const outcome = OUTCOMES[outcomeIdx];
  if (result.usedChance) showChanceNotice();
  if (result.usedHeal)   showHealNotice();
  if (outcome.life < 0 && !result.usedChance) {
    document.body.classList.add("defeat-flash");
    setTimeout(() => document.body.classList.remove("defeat-flash"), 900);
  }
  return result;
}

/**
 * @description Affiche le résultat de l'étape qui vient de se terminer sous la roue.
 *
 * @param {string} label - Libellé de l'étape (ex: "Combat", "Butin")
 * @param {string} value - Valeur du résultat tiré, affichée à l'utilisateur
 * @param {string} cls   - Classe CSS optionnelle appliquée au résultat (ex: "defeat", "loot")
 *
 * @sideEffects
 *   Modifie #srLbl/#srVal, ajoute la classe `.show` à #stepRes
 */
function showStepResult(label, value, cls) {
  $("srLbl").textContent = label;
  $("srVal").textContent = value;
  $("srVal").className   = "sr-val" + (cls ? " " + cls : "");
  $("stepRes").classList.add("show");
}

// ── ROUND SUIVANT ─────────────────────────────────────────────
/**
 * @description Enchaîne sur un nouveau round après l'affichage du récapitulatif : ferme
 *              la popup de récapitulatif, réinitialise le pilotage des roues, reconstruit
 *              l'arène (ce qui démarre un nouveau round côté moteur via
 *              Engine.newRound(), appelé en interne par buildRound()), puis rafraîchit
 *              le HUD et l'inventaire. Appelée par le bouton "⚡ Round suivant" de la
 *              popup #recapOv (voir index.html).
 *
 * @sideEffects
 *   Appelle resetRecapPanel() (ferme #recapOv), réinitialise _stepIdx/_stepRots,
 *   appelle buildRound(), updateHUD(), updateInventoryBar(), sauvegarde la partie
 *   (Engine.saveGame())
 */
function nextRound() {
  resetRecapPanel();
  _stepIdx  = 0;
  _stepRots = [0, 0, 0, 0, 0];
  buildRound();        // appelle Engine.newRound() en interne
  updateHUD();
  updateInventoryBar();
  Engine.saveGame();
}

// ── SAUVEGARDE MANUELLE ───────────────────────────────────────
/**
 * @description Sauvegarde immédiatement la partie en cours, à la demande du joueur (voir
 *              index.html → bouton "💾 Sauvegarder" de la sidebar gauche en jeu), sans
 *              attendre la prochaine limite propre de round. Sans danger même en cours
 *              de spin : reprendre une partie (voir ui-village.js → resumeSavedGame())
 *              reconstruit toujours le round en cours depuis zéro via buildRound() →
 *              Engine.newRound(), qui ne préserve que les champs persistants (village,
 *              personnage, inventaire, vies, rang, historique…) déjà à jour en temps
 *              réel dans `G` à ce moment précis — jamais l'état précis d'un tirage en
 *              suspens, qui n'est de toute façon pas sauvegardé.
 *
 * @sideEffects
 *   Appelle Engine.saveGame(), affiche une notice de confirmation (showSaveNotice())
 */
function manualSaveGame() {
  Engine.saveGame();
  showSaveNotice();
}
