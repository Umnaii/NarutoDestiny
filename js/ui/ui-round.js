/**
 * @file ui-round.js
 * @module ui/round
 * @description Construction et pilotage du round : empilement des roues, spin séquentiel,
 *              application des résultats de combat/examen.
 *              Extrait de ui.js lors du refactoring Phase 1.
 *
 * @dependencies
 *   - ../data.js   → OUTCOMES, EXAMEN_OUTCOMES
 *   - ../engine.js → Engine.getState(), Engine.newRound(), Engine.computeIssueWeights(),
 *                    Engine.computeExamenWeights(), Engine.buildLootPool(), Engine.getStarters(),
 *                    Engine.getAntags(), Engine.setResult(), Engine.getPersoStyle(), Engine.setPerso(),
 *                    Engine.applyOutcome(), Engine.applyExamen(), Engine.isManualUseItem()
 *   - ../wheel.js  → WheelEngine.SZ, WheelEngine.draw(), WheelEngine.drawLoot(),
 *                    WheelEngine.spinIssue(), WheelEngine.spinLoot(), WheelEngine.spinGeneric()
 *   - ui-core.js   → $()
 *   - ui-hud.js    → updateHUD(), updatePersoPortrait()
 *   - ui-inventory.js → updateInventoryBar(), showManualUseTutorial()
 *   - ui-recap.js  → showCombatAnalysis(), showExamenAnalysis(), showRoundSummary(),
 *                    updateAntagPortrait()
 *   - ui-overlays.js → showVictory(), showPromotion(), showExamFailure() [showExamFailure vit dans ui-recap.js]
 *
 * @exports (fonctions globales)
 *   - buildSteps(), buildRound(), spinCurrent(), applyIssue(outcomeIdx),
 *     showStepResult(label, value, cls), nextRound()
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
 *              toujours présentes ; la roue "Examen" est toujours ajoutée en dernier et
 *              sera sautée à l'exécution si G.examReady est resté false après le loot
 *              (voir spinCurrent()).
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
  // La roue examen est toujours ajoutée — elle sera sautée si !examReady après loot
  steps.push({ id:"examen", label:"Examen",      canvasId:"cvExamen",pal:-3 });

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
}

/**
 * @description Dessine l'état initial (rotation 0) de la roue à l'étape donnée, avec
 *              la logique adaptée à son type : poids de combat calculés pour "Combat",
 *              tirage d'un nouveau pool pour "Butin", poids d'examen calculés pour
 *              "Examen", ou candidats à parts égales pour les roues génériques
 *              (personnage/antagoniste).
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
    _lootPool = Engine.buildLootPool(8);
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
    if (onReady) onReady();
  }, 320);
}

// ── SPIN ──────────────────────────────────────────────────────
let _stepIdx  = 0;
let _stepRots = [0, 0, 0, 0, 0];

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
    }).then(({ targetIndex, finalRotation }) => {
      _stepRots[_stepIdx] = finalRotation;
      const outcome = EXAMEN_OUTCOMES[targetIndex];
      Engine.setResult("examen", outcome.short);
      Engine.setResult("examenIdx", targetIndex);
      showStepResult(step.label, outcome.short, targetIndex === 1 ? "defeat" : "");
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
    }).then(({ targetIndex, finalRotation }) => {
      _stepRots[_stepIdx] = finalRotation;
      const outcome = OUTCOMES[targetIndex];
      Engine.setResult("outcome", outcome.short);
      Engine.setResult("outcomeIdx", targetIndex);
      showStepResult(step.label, outcome.short, outcome.life < 0 ? "defeat" : "");
    });

  } else if (step.pal === -2) {
    // ── Roue Loot ─────────────────────────────────────────────
    spinPromise = WheelEngine.spinLoot({
      canvasId: step.canvasId,
      pool: _lootPool,
      startRotation: _stepRots[_stepIdx],
      onFrame: r => { _stepRots[_stepIdx] = r; },
    }).then(({ targetIndex, finalRotation, lootItem }) => {
      _stepRots[_stepIdx] = finalRotation;
      Engine.setResult("loot", lootItem);
      Engine.addLoot(lootItem);
      updateInventoryBar(); // le butin apparaît dans l'inventaire dès qu'il est gagné
      showStepResult(step.label, lootItem.name, "loot");
      if (Engine.isManualUseItem(lootItem) && !Engine.getState().seenManualUseTutorial) {
        showManualUseTutorial(lootItem);
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
      _lootPool = Engine.buildLootPool(8);
    }

    // Après Loot : examen si ready, sinon résumé
    if (prevStep.id === "loot") {
      const G2 = Engine.getState();
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
 *              HUD et l'inventaire, et affiche les notices automatiques (talisman
 *              "chance" ou soin consommé) ou l'effet visuel de défaite le cas échéant.
 *
 * @param {number} outcomeIdx - Index dans OUTCOMES du résultat tiré
 *
 * @returns {Object} Le résultat de Engine.applyOutcome() (voir engine.js pour la forme
 *                   exacte : `{ usedChance, usedHeal, lifeChange, examReady, gameOver }`)
 *
 * @sideEffects
 *   Modifie l'état moteur (via Engine.applyOutcome()), rafraîchit le HUD et
 *   l'inventaire, ajoute/affiche une notice (showChanceNotice()/showHealNotice()) ou
 *   déclenche l'effet visuel `.defeat-flash` sur le body en cas de défaite non annulée
 */
function applyIssue(outcomeIdx) {
  const result = Engine.applyOutcome(outcomeIdx);
  updateHUD();
  updateInventoryBar();
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
 *   appelle buildRound(), updateHUD(), updateInventoryBar()
 */
function nextRound() {
  resetRecapPanel();
  _stepIdx  = 0;
  _stepRots = [0, 0, 0, 0, 0];
  buildRound();        // appelle Engine.newRound() en interne
  updateHUD();
  updateInventoryBar();
}
