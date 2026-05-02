/* ============================================================
   NARUTO DESTINY WHEEL — ui.js
   Manipulation du DOM, écrans, overlays, génération SVG.
   SÉCURITÉ :
     - RÈGLE 1 : jamais de innerHTML avec variable utilisateur.
     - Les SVG sont générés depuis DATA (constantes + hash) uniquement.
     - Toute chaîne externe passe par sanitize().
   ============================================================ */

// ── UTILS ────────────────────────────────────────────────────
function sanitize(str) {
  const el = document.createElement("div");
  el.textContent = String(str);
  return el.innerHTML;
}

// Anti-clickjacking
if (window.self !== window.top) {
  document.documentElement.style.display = "none";
  window.top.location = window.self.location;
}

function hashStr(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

function $(id) { return document.getElementById(id); }

// ── SCREENS ──────────────────────────────────────────────────
function showScreen(id) {
  document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
  const el = $(id);
  if (el) el.classList.add("active");
}

// ── VILLAGE SELECT ───────────────────────────────────────────
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

function selectVillage(id, cardEl) {
  document.querySelectorAll("#villageCards .period-card").forEach(c => c.classList.remove("selected"));
  cardEl.classList.add("selected");
  _selectedVillageId = id;
  $("villageConfirm").classList.add("ready");
}

function confirmVillage() {
  if (!_selectedVillageId) return;
  if (!Engine.setVillage(_selectedVillageId)) return;
  startGame();
}

// ── GAME SCREEN ───────────────────────────────────────────────
function startGame() {
  showScreen("screenGame");
  Engine.newRound();
  buildRound();
  updateHUD();
  updateInventoryBar();
  $("collSection").classList.remove("show");
  $("destinyPanel").classList.remove("vis");
  $("destinyPanel").style.display = "none";
}

// ── HUD ───────────────────────────────────────────────────────
function updateHUD() {
  const G = Engine.getState();
  updateHearts(G.lives, G.livesMax);
  updateRankHUD();
}

function updateHearts(lives, livesMax) {
  const container = $("livesHearts");
  container.textContent = "";
  for (let i = 0; i < livesMax; i++) {
    const wrap = document.createElement("span");
    wrap.className = "heart" + (i >= lives ? " lost" : "");
    // SÉCURITÉ : SVG statique entièrement contrôlé
    wrap.innerHTML = i < lives ? HEART_SVG_FULL : HEART_SVG_EMPTY;
    container.appendChild(wrap);
  }
}

// SVG cœur plein — HTML statique, pas de variable utilisateur
const HEART_SVG_FULL  = `<svg viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M14 24s-10-6.5-10-13a6 6 0 0 1 10-4.47A6 6 0 0 1 24 11c0 6.5-10 13-10 13z" class="heart-full"/></svg>`;
const HEART_SVG_EMPTY = `<svg viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M14 24s-10-6.5-10-13a6 6 0 0 1 10-4.47A6 6 0 0 1 24 11c0 6.5-10 13-10 13z" class="heart-empty"/></svg>`;

function updateRankHUD() {
  const rank = Engine.currentRank();
  const next = Engine.nextRank();
  const G    = Engine.getState();

  $("rankNameHUD").textContent  = rank.name;
  $("rankNameHUD").style.color  = rank.color;
  $("rankFillHUD").style.background = `linear-gradient(90deg,${rank.color}88,${rank.color})`;

  // SÉCURITÉ : makeRankEmblem produit du SVG depuis constantes uniquement
  $("rankEmblemHUD").innerHTML = makeRankEmblem(rank, 52);

  $("rankWinsC").textContent = G.wins;
  $("rankWinsM").textContent = WINS_PER_RANK;
  $("rankNextN").textContent = next ? next.name : "—";

  animFill("rankFillHUD", Engine.rankPct());
}

function animFill(id, target) {
  const el = $(id); if (!el) return;
  const from = parseFloat(el.style.width) || 0;
  const dur  = 800, t0 = performance.now();
  function go(now) {
    const t = Math.min((now - t0) / dur, 1);
    el.style.width = (from + (target - from) * (1 - Math.pow(1 - t, 3))) + "%";
    if (t < 1) requestAnimationFrame(go);
  }
  requestAnimationFrame(go);
}

// ── INVENTORY BAR ─────────────────────────────────────────────
function updateInventoryBar() {
  const G   = Engine.getState();
  const bar = $("invItems");
  bar.textContent = "";

  if (!G.inventory.length) {
    const em = document.createElement("span");
    em.className = "inv-empty";
    em.textContent = "Inventaire vide — gagne des combats pour looter !";
    bar.appendChild(em);
    return;
  }

  G.inventory.forEach((item, i) => {
    const el = document.createElement("span");
    el.className = "inv-item " + (TYPE_CSS[item.type] || "");
    el.title = item.desc;

    const ico  = document.createElement("span"); ico.className = "loot-icon"; ico.textContent = item.emoji;
    const name = document.createElement("span"); name.textContent = item.name;

    el.appendChild(ico); el.appendChild(name);
    bar.appendChild(el);
  });
}

// ── ROUND BUILDER ─────────────────────────────────────────────
// Les STEPS varient selon la phase du jeu :
//   - 1er round / après game over : perso + antag + issue + loot [+ examen si examReady]
//   - Rounds suivants (perso fixé) : antag + issue + loot [+ examen si examReady]
//   - Après échec examen : antag + issue + loot + examen (directement)

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
    cv.width = WheelEngine.SZ; cv.height = WheelEngine.SZ;
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
}

function _initWheelDraw(stepIdx) {
  const step = _STEPS[stepIdx];
  if (!step) return;
  if (step.pal === -1) {
    WheelEngine.drawIssue(step.canvasId, 0);
  } else if (step.pal === -2) {
    _lootPool = Engine.buildLootPool(8);
    WheelEngine.drawLoot(step.canvasId, _lootPool, 0);
  } else if (step.pal === -3) {
    // Roue examen — dessinée avec les poids calculés
    const weights = Engine.computeExamenWeights();
    WheelEngine.drawIssue(step.canvasId, 0); // même moteur que Issue (2 couleurs)
    _drawExamen(step.canvasId, weights, 0);
  } else {
    const items = _getItems(stepIdx);
    WheelEngine.drawGeneric(step.canvasId, items, step.pal, 0);
  }
}

// Dessin roue examen (2 segments)
function _drawExamen(canvasId, weights, rotation) {
  const items  = weights.map(w => w.short);
  const colors = weights.map(w => w.wheelColor);
  WheelEngine.draw(canvasId, items, colors, rotation);
}

function _getItems(stepIdx) {
  const step = _STEPS[stepIdx];
  if (!step) return [];
  switch (step.id) {
    case "perso":  return Engine.getStarters();
    case "antag":  return Engine.getAntags().map(a => a.name);
    default:       return [];
  }
}

function revealLayer(i) {
  if (_layerEls[i]) _layerEls[i].classList.add("vis");
}

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
      showStepResult(step.label, lootItem.name, "loot");
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
      if (combatResult.gameOver) return;
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
  const btn  = $("spinBtn");
  btn.disabled = true; btn.classList.add("going"); btn.textContent = "En rotation...";

  let spinPromise;

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

function showStepResult(label, value, cls) {
  $("srLbl").textContent = label;
  $("srVal").textContent = value;
  $("srVal").className   = "sr-val" + (cls ? " " + cls : "");
  $("stepRes").classList.add("show");
}

// ── SPIN ALL ──────────────────────────────────────────────────
function spinAll() {
  const G = Engine.getState();
  if (G.round.spinning || G.status !== "playing") return;
  $("allBtn").disabled = true;
  buildRound();
  _stepIdx = 0;
  _stepRots = [0,0,0,0,0];

  function doNext() {
    if (_stepIdx >= STEPS.length) return;
    spinCurrent();
    const chk = setInterval(() => {
      if (!Engine.getState().round.spinning) {
        clearInterval(chk);
        if (_stepIdx < STEPS.length) setTimeout(doNext, 320);
      }
    }, 80);
  }
  doNext();
}

// ── RÉSUMÉ DE ROUND ───────────────────────────────────────────
// Affiché après loot quand l'examen n'est pas encore dispo
function showRoundSummary() {
  const G = Engine.getState();
  const { perso, antag, outcome, loot, outcomeIdx, persoStyle } = G.round.results;
  const od = OUTCOMES[outcomeIdx] || OUTCOMES[0];
  const lootItem = loot;
  const antagData = Engine.getAntagData(antag);
  const STYLE_EMOJI = { ninjutsu:"🔥", taijutsu:"💪", genjutsu:"😵" };
  const STYLE_NOM   = { ninjutsu:"Ninjutsu", taijutsu:"Taijutsu", genjutsu:"Genjutsu" };

  const panel = $("destinyPanel");
  panel.style.display = "block";

  const grid = $("dGrid");
  grid.textContent = "";
  [
    { label:"Personnage",  emoji: STYLE_EMOJI[persoStyle]||"⚡",    value: perso,   sub: "Style : "+(STYLE_NOM[persoStyle]||"?") },
    { label:"Antagoniste", emoji: "☠️",                             value: antag,   sub: antagData ? "Faiblesse : "+STYLE_NOM[antagData.weakness] : "" },
    { label:"Combat",      emoji: od.emoji,                         value: outcome, sub: Engine.currentRank().name },
    { label:"Butin",       emoji: lootItem ? lootItem.emoji : "📦", value: lootItem ? lootItem.name : "Rien", sub: lootItem ? _typeLabel(lootItem.type) : "" },
  ].forEach(it => {
    const d = document.createElement("div"); d.className = "d-item";
    const l = document.createElement("div"); l.className = "d-lbl"; l.textContent = it.label;
    const v = document.createElement("div"); v.className = "d-val" + (od.life < 0 ? " defeat" : ""); v.textContent = it.emoji+" "+it.value;
    const s = document.createElement("div"); s.className = "d-sub"; s.textContent = it.sub;
    d.appendChild(l); d.appendChild(v); d.appendChild(s); grid.appendChild(d);
  });

  // Story safe DOM
  function B(t) { const s = document.createElement("strong"); s.textContent = t; return s; }
  const story = $("dStory");
  story.textContent = "";
  const f = document.createDocumentFragment();
  f.append(B(perso)); f.append(" affronte "); f.append(B(antag)); f.append(" — "); f.append(B(outcome));
  f.append(". Butin récupéré : "); f.append(B(lootItem ? lootItem.name : "rien")); f.append(".");
  story.appendChild(f);

  // Loot panel
  const lootPanel = $("lootPanel");
  if (lootItem) {
    lootPanel.style.display = "block";
    $("lootItemIcon").textContent = lootItem.emoji;
    $("lootItemName").textContent = lootItem.name;
    $("lootItemType").textContent = _typeLabel(lootItem.type)+" · "+_rarityLabel(lootItem.rarity);
    $("lootItemDesc").textContent = lootItem.desc;
  } else { lootPanel.style.display = "none"; }

  // Badge
  const badgeSection = $("badgeSection");
  if (od.life >= 0) {
    badgeSection.style.display = "block";
    $("badgeSvgWrap").innerHTML = makeBadgeSvg(antag, 110);
    $("badgeNm").textContent    = antag;
    $("badgeSb").textContent    = od.emoji+" "+outcome;
  } else { badgeSection.style.display = "none"; }

  panel.classList.add("vis");
  setTimeout(() => panel.scrollIntoView({ behavior:"smooth", block:"start" }), 100);
  updateCollection();
}

// ── ANALYSE EXAMEN ────────────────────────────────────────────
function showExamenAnalysis(weights) {
  const total    = weights.reduce((s, w) => s + w.weight, 0);
  const pctPass  = Math.round(weights[0].weight / total * 100);
  const lbl      = $("arenaStepLabel");
  const rank     = Engine.currentRank();
  const nextRnk  = Engine.nextRank();

  lbl.textContent = "";
  const l1 = document.createElement("div"); l1.style.cssText = "font-size:14px;margin-bottom:4px;font-weight:700;color:var(--gold)";
  l1.textContent = "📋 Examen de passage " + rank.name + " → " + (nextRnk ? nextRnk.name : "Kage");
  const l2 = document.createElement("div"); l2.style.cssText = "font-size:12px;color:var(--text-muted);margin-bottom:2px;";
  l2.textContent = "Tes items améliorent tes chances.";
  const l3 = document.createElement("div"); l3.style.cssText = "font-size:12px;color:var(--text-muted);";
  l3.textContent = "Chance de réussite estimée : " + pctPass + "%";
  lbl.appendChild(l1); lbl.appendChild(l2); lbl.appendChild(l3);
}

// ── ÉCHEC EXAMEN ──────────────────────────────────────────────
function showExamFailure() {
  const panel = $("destinyPanel");
  panel.style.display = "block";

  const grid = $("dGrid");
  grid.textContent = "";
  const d = document.createElement("div"); d.className = "d-item";
  const l = document.createElement("div"); l.className = "d-lbl"; l.textContent = "Examen";
  const v = document.createElement("div"); v.className = "d-val defeat"; v.textContent = "❌ Échec";
  const s = document.createElement("div"); s.className = "d-sub"; s.textContent = "Pas de perte de vie — tu peux repasser !";
  d.appendChild(l); d.appendChild(v); d.appendChild(s); grid.appendChild(d);

  const story = $("dStory");
  story.textContent = "L'examen te glisse entre les doigts. Tu dois retourner te battre, améliorer ton équipement, et retenter ta chance.";

  $("lootPanel").style.display = "none";
  $("badgeSection").style.display = "none";

  panel.classList.add("vis");
  setTimeout(() => panel.scrollIntoView({ behavior:"smooth", block:"start" }), 100);
}
  const G = Engine.getState();
  const { village, perso, antag, outcome, loot, outcomeIdx, persoStyle } = G.round.results;
  const vd  = VILLAGES.find(v => v.short === village) || {};
  const od  = OUTCOMES[outcomeIdx] || OUTCOMES[0];
  const lootItem = loot;
  const antagData = Engine.getAntagData(antag);

  const STYLE_EMOJI = { ninjutsu:"🔥", taijutsu:"💪", genjutsu:"😵" };
  const STYLE_NOM   = { ninjutsu:"Ninjutsu", taijutsu:"Taijutsu", genjutsu:"Genjutsu" };

  const panel = $("destinyPanel");
  panel.style.display = "block";

  // Grid — safe DOM (Règle 1)
  const grid = $("dGrid");
  grid.textContent = "";
  [
    { label:"Village",     emoji: vd.emoji||"🏘️",                 value: village,  sub: "Village du "+(vd.symbol||"Destin") },
    { label:"Personnage",  emoji: STYLE_EMOJI[persoStyle]||"⚡",    value: perso,    sub: "Style : "+(STYLE_NOM[persoStyle]||"?") },
    { label:"Antagoniste", emoji: "☠️",                             value: antag,    sub: antagData ? "Faiblesse : "+STYLE_NOM[antagData.weakness]+" / Résistance : "+STYLE_NOM[antagData.resistance] : "Ennemi mystérieux" },
    { label:"Issue",       emoji: od.emoji,                         value: outcome,  sub: Engine.currentRank().name + " — " + (G.periode ? G.periode.short : "") },
  ].forEach(it => {
    const d = document.createElement("div"); d.className = "d-item";
    const l = document.createElement("div"); l.className = "d-lbl"; l.textContent = it.label;
    const v = document.createElement("div"); v.className = "d-val" + (od.life < 0 ? " defeat" : ""); v.textContent = it.emoji+" "+it.value;
    const s = document.createElement("div"); s.className = "d-sub"; s.textContent = it.sub;
    d.appendChild(l); d.appendChild(v); d.appendChild(s); grid.appendChild(d);
  });

  // Story — safe DOM (Règle 1)
  function B(t) { const s = document.createElement("strong"); s.textContent = t; return s; }
  const tpls = [
    (v,c,a,o) => { const f = document.createDocumentFragment(); f.append("Dans le village de "); f.append(B(v)); f.append(", "); f.append(B(c)); f.append(" croise le chemin de "); f.append(B(a)); f.append(". Issue : "); f.append(B(o)); f.append("."); return f; },
    (v,c,a,o) => { const f = document.createDocumentFragment(); f.append(B(c)); f.append(" de "); f.append(B(v)); f.append(" devait vaincre "); f.append(B(a)); f.append(" à tout prix. Le dénouement : "); f.append(B(o)); f.append("."); return f; },
    (v,c,a,o) => { const f = document.createDocumentFragment(); f.append(B(a)); f.append(" croyait la victoire assurée. Mais "); f.append(B(c)); f.append(" de "); f.append(B(v)); f.append(" en a décidé autrement — "); f.append(B(o)); f.append("."); return f; },
  ];
  const story = $("dStory");
  story.textContent = "";
  story.appendChild(tpls[Math.floor(Math.random() * tpls.length)](village, perso, antag, outcome));

  // Loot panel
  const lootPanel = $("lootPanel");
  if (lootItem) {
    lootPanel.style.display = "block";
    $("lootItemIcon").textContent = lootItem.emoji;
    $("lootItemName").textContent = lootItem.name;
    $("lootItemType").textContent = _typeLabel(lootItem.type) + " · " + _rarityLabel(lootItem.rarity);
    $("lootItemDesc").textContent = lootItem.desc;
  } else {
    lootPanel.style.display = "none";
  }

  // Badge
  const badgeSection = $("badgeSection");
  if (od.life >= 0) {
    badgeSection.style.display = "block";
    // SÉCURITÉ : makeBadgeSvg utilise hashStr(name) — constantes uniquement
    $("badgeSvgWrap").innerHTML = makeBadgeSvg(antag, 110);
    $("badgeNm").textContent    = antag;
    $("badgeSb").textContent    = od.emoji + " " + outcome;
  } else {
    badgeSection.style.display = "none";
  }

  panel.classList.add("vis");
  setTimeout(() => {
    panel.scrollIntoView({ behavior: "smooth", block: "start" });
  }, 100);

  // Collection
  updateCollection();
}

function _typeLabel(t) {
  const m = { weapon:"Arme", ninjutsu:"Ninjutsu", taijutsu:"Taijutsu", genjutsu:"Genjutsu", heal:"Soin", chance:"Chance" };
  return m[t] || t;
}
function _rarityLabel(r) {
  const m = { common:"Commun", uncommon:"Peu commun", rare:"Rare", epic:"Épique" };
  return m[r] || r;
}

// ── COLLECTION ────────────────────────────────────────────────
function updateCollection() {
  const G = Engine.getState();
  if (!G.badges.length) return;

  const sec = $("collSection");
  sec.classList.add("show");
  $("collSub").textContent = G.badges.length + " ennemi" + (G.badges.length > 1 ? "s" : "") + " vaincu" + (G.badges.length > 1 ? "s" : "");

  const grid = $("collGrid");
  grid.textContent = "";
  G.badges.forEach((b, i) => {
    const sl  = document.createElement("div"); sl.className = "bslot"; sl.style.animationDelay = (i * .05) + "s";
    const sw  = document.createElement("div");
    // SÉCURITÉ : SVG depuis makeBadgeSvg — constantes + hash uniquement
    sw.innerHTML = makeBadgeSvg(b.antag, 84);
    const nm  = document.createElement("div"); nm.className = "bslot-nm";  nm.textContent = b.antag;
    const out = document.createElement("div"); out.className = "bslot-out " + b.outcomeCls; out.textContent = b.emoji + " " + b.outcomeShort;
    sl.appendChild(sw); sl.appendChild(nm); sl.appendChild(out);
    grid.appendChild(sl);
  });
}

// ── ANALYSE COMBAT ────────────────────────────────────────────
// Affiche brièvement les infos style vs ennemi avant la roue Issue
function showCombatAnalysis(weights) {
  const G = Engine.getState();
  const persoName  = G.round.results.perso;
  const antagName  = G.round.results.antag;
  const playerStyle = G.round.results.persoStyle || "ninjutsu";
  const antagData  = Engine.getAntagData(antagName);

  const STYLE_LABELS = { ninjutsu:"Ninjutsu 🔥", taijutsu:"Taijutsu 💪", genjutsu:"Genjutsu 😵" };
  const STYLE_RESULT = {
    avantage:   "✅ Avantage — ta technique est la faiblesse ennemie !",
    desavantage:"❌ Désavantage — l'ennemi résiste à ton style.",
    neutre:     "⚖️ Neutre — aucun avantage particulier.",
  };

  let matchup = "neutre";
  if (antagData && playerStyle === antagData.weakness)    matchup = "avantage";
  if (antagData && playerStyle === antagData.resistance)  matchup = "desavantage";

  const totalW = weights.reduce((s, w) => s + w.weight, 0);
  const pctVictoire = Math.round(weights[0].weight / totalW * 100);

  // Injecter dans le label de l'arena (safe DOM — Règle 1)
  const lbl = $("arenaStepLabel");
  lbl.textContent = "";

  const line1 = document.createElement("div");
  line1.style.cssText = "font-size:13px;margin-bottom:4px;";
  line1.textContent = STYLE_LABELS[playerStyle] + " vs " + (antagData ? STYLE_LABELS[antagData.weakness] + " (faiblesse)" : "");

  const line2 = document.createElement("div");
  line2.style.cssText = "font-size:12px;color:var(--text-muted);margin-bottom:2px;";
  line2.textContent = STYLE_RESULT[matchup];

  const line3 = document.createElement("div");
  line3.style.cssText = "font-size:11px;color:var(--text-muted);";
  line3.textContent = "Chance de victoire estimée : " + pctVictoire + "%";

  lbl.appendChild(line1); lbl.appendChild(line2); lbl.appendChild(line3);
}

// ── CHANCE / HEAL NOTICES ─────────────────────────────────────
function showChanceNotice() {
  const el = document.createElement("div");
  el.className = "chance-used-notice";
  el.textContent = "🎴 Talisman utilisé automatiquement — défaite annulée !";
  $("destinyPanel").appendChild(el);
  setTimeout(() => el.remove(), 5000);
}

function showHealNotice() {
  const el = document.createElement("div");
  el.className = "heal-used-notice";
  el.textContent = "💊 Soin utilisé automatiquement — une vie récupérée !";
  $("destinyPanel").appendChild(el);
  setTimeout(() => el.remove(), 5000);
}

// ── NEXT ROUND ────────────────────────────────────────────────
// ── ROUND SUIVANT ─────────────────────────────────────────────
function nextRound() {
  $("destinyPanel").classList.remove("vis");
  $("destinyPanel").style.display = "none";
  _stepIdx  = 0;
  _stepRots = [0, 0, 0, 0, 0];
  buildRound();        // appelle Engine.newRound() en interne
  updateHUD();
  updateInventoryBar();
}

// ── OVERLAYS ──────────────────────────────────────────────────
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

function closePromo() {
  $("promoOv").classList.remove("show");
  updateRankHUD();
  showDestiny();
}

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

function closeKage() {
  $("kageOv").classList.remove("show");
  updateRankHUD();
}

function showGameOver() {
  const G = Engine.getState();
  $("goVillage").textContent = G.round.results.village || "...";
  $("goAntag").textContent   = G.round.results.antag   || "...";
  $("goBadges").textContent  = G.badges.length;
  $("goOv").classList.add("show");
}

function closeGameOver() {
  $("goOv").classList.remove("show");
  Engine.fullReset();
  _selectedVillageId = null;
  _stepIdx  = 0;
  _stepRots = [0, 0, 0, 0, 0];
  buildVillageScreen();
  showScreen("screenVillage");
}

// Promotion après un round réussi
function checkPromotion() {
  const result = Engine.getState();
  // Appelé depuis showDestiny si rankUp
  // La logique est dans applyIssue → result.rankUp
}

// ── SVG GENERATION ────────────────────────────────────────────
// SÉCURITÉ : makeBadgeSvg génère du SVG uniquement depuis hashStr(name)
// et des tableaux de constantes. Aucune entrée utilisateur interpolée.
function makeBadgeSvg(name, sz = 110) {
  const h  = hashStr(name);
  const [c1, c2, c3] = BADGE_PALETTES[h % BADGE_PALETTES.length];
  const cx = sz / 2, cy = sz / 2, r = sz / 2 - 4;
  const shp = h % 4, eye = (h >> 4) % 3, mrk = (h >> 8) % 4;
  let inn = "";

  // Forme de fond
  if (shp === 0) {
    const pts = R => Array.from({length:6}, (_, i) => {
      const a = Math.PI / 180 * (60 * i - 30);
      return `${(cx + R * Math.cos(a)).toFixed(1)},${(cy + R * Math.sin(a)).toFixed(1)}`;
    }).join(" ");
    inn += `<polygon points="${pts(r)}" fill="${c1}" stroke="${c3}" stroke-width="2"/>`;
    inn += `<polygon points="${pts(r-7)}" fill="none" stroke="${c2}" stroke-width="1" opacity=".4"/>`;
  } else if (shp === 1) {
    inn += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${c1}" stroke="${c3}" stroke-width="2"/>`;
    inn += `<circle cx="${cx}" cy="${cy}" r="${r-7}" fill="none" stroke="${c2}" stroke-width="1" opacity=".4"/>`;
  } else if (shp === 2) {
    inn += `<polygon points="${cx},4 ${sz-4},${cy} ${cx},${sz-4} 4,${cy}" fill="${c1}" stroke="${c3}" stroke-width="2"/>`;
  } else {
    const o = sz * .15;
    inn += `<polygon points="${o},4 ${sz-o},4 ${sz-4},${o} ${sz-4},${sz-o} ${sz-o},${sz-4} ${o},${sz-4} 4,${sz-o} 4,${o}" fill="${c1}" stroke="${c3}" stroke-width="2"/>`;
  }

  // Visage
  const fr = r * .42;
  inn += `<circle cx="${cx}" cy="${cy-3}" r="${fr}" fill="${c2}" opacity=".9"/>`;

  // Yeux
  const ey = cy - 3 - fr * .18, ex1 = cx - fr * .32, ex2 = cx + fr * .32, er = fr * .13;
  if (eye === 0) {
    inn += `<circle cx="${ex1}" cy="${ey}" r="${er}" fill="${c3}"/><circle cx="${ex2}" cy="${ey}" r="${er}" fill="${c3}"/>`;
    inn += `<circle cx="${ex1}" cy="${ey}" r="${er*.5}" fill="#fff"/><circle cx="${ex2}" cy="${ey}" r="${er*.5}" fill="#fff"/>`;
  } else if (eye === 1) {
    const ew = er * 1.4, eh = er * .5;
    inn += `<rect x="${ex1-ew}" y="${ey-eh}" width="${ew*2}" height="${eh*2}" rx="${eh*.4}" fill="${c1}" transform="rotate(-10,${ex1},${ey})"/>`;
    inn += `<rect x="${ex2-ew}" y="${ey-eh}" width="${ew*2}" height="${eh*2}" rx="${eh*.4}" fill="${c1}" transform="rotate(10,${ex2},${ey})"/>`;
  } else {
    inn += `<circle cx="${ex1}" cy="${ey}" r="${er}" fill="#9B59B6"/><circle cx="${ex2}" cy="${ey}" r="${er}" fill="#9B59B6"/>`;
    inn += `<circle cx="${ex1}" cy="${ey}" r="${er*.35}" fill="#fff"/><circle cx="${ex2}" cy="${ey}" r="${er*.35}" fill="#fff"/>`;
  }

  // Bouche
  const my = cy - 3 + fr * .3;
  inn += `<line x1="${cx-fr*.26}" y1="${my}" x2="${cx+fr*.26}" y2="${my}" stroke="${c1}" stroke-width="${fr*.09}" stroke-linecap="round"/>`;

  // Symbole
  const mc = cx, mcy2 = cy + fr * 1.08;
  if (mrk === 0) inn += `<polygon points="${mc},${mcy2-8} ${mc+7},${mcy2+4} ${mc-7},${mcy2+4}" fill="${c2}" opacity=".85"/>`;
  else if (mrk === 1) inn += `<text x="${mc}" y="${mcy2+6}" text-anchor="middle" font-size="14" fill="${c2}" opacity=".9" font-family="serif">☯</text>`;
  else if (mrk === 2) inn += `<text x="${mc}" y="${mcy2+6}" text-anchor="middle" font-size="14" fill="${c2}" opacity=".9">✦</text>`;
  else inn += `<line x1="${mc-7}" y1="${mcy2}" x2="${mc+7}" y2="${mcy2}" stroke="${c2}" stroke-width="2" opacity=".7"/><line x1="${mc}" y1="${mcy2-7}" x2="${mc}" y2="${mcy2+7}" stroke="${c2}" stroke-width="2" opacity=".7"/>`;

  return `<svg width="${sz}" height="${sz}" viewBox="0 0 ${sz} ${sz}" xmlns="http://www.w3.org/2000/svg">${inn}</svg>`;
}

// SÉCURITÉ : makeRankEmblem — SVG depuis constantes uniquement
function makeRankEmblem(rank, sz) {
  const cx = sz/2, cy = sz/2, r = sz/2-3, c = rank.color;
  const emblems = {
    "Genin":  `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${c}22" stroke="${c}" stroke-width="2"/><text x="${cx}" y="${cy+sz*.1}" text-anchor="middle" font-size="${sz*.32}" fill="${c}" font-family="serif">忍</text>`,
    "Chûnin": `<polygon points="${cx},3 ${sz-3},${cy+r*.5} ${cx+r*.8},${sz-3} ${cx-r*.8},${sz-3} 3,${cy+r*.5}" fill="${c}22" stroke="${c}" stroke-width="2"/><text x="${cx}" y="${cy+sz*.1}" text-anchor="middle" font-size="${sz*.3}" fill="${c}" font-family="serif">中</text>`,
    "Jônin":  `<polygon points="${cx},2 ${sz-2},${sz-2} 2,${sz-2}" fill="${c}22" stroke="${c}" stroke-width="2"/><text x="${cx}" y="${cy+sz*.14}" text-anchor="middle" font-size="${sz*.28}" fill="${c}" font-family="serif">上</text>`,
    "Kage":   `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${c}33" stroke="${c}" stroke-width="3"/><circle cx="${cx}" cy="${cy}" r="${r-5}" fill="none" stroke="${c}" stroke-width="1" opacity=".4"/><text x="${cx}" y="${cy+sz*.1}" text-anchor="middle" font-size="${sz*.3}" fill="${c}" font-family="serif">影</text>`,
  };
  return emblems[rank.name] || emblems["Genin"];
}

// ── INIT ──────────────────────────────────────────────────────
window.addEventListener("DOMContentLoaded", () => {
  buildVillageScreen();
  showScreen("screenVillage");
});
