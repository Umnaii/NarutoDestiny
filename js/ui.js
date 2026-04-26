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

// ── PERIOD SELECT ────────────────────────────────────────────
function buildPeriodScreen() {
  const container = $("periodCards");
  container.textContent = "";

  PERIODES.forEach(p => {
    const card = document.createElement("div");
    card.className = "period-card " + p.cssClass;
    card.dataset.id = p.id;

    const em  = document.createElement("span"); em.className = "pc-emoji";   em.textContent = p.emoji;
    const nm  = document.createElement("div");  nm.className = "pc-name";    nm.textContent = p.short;
    const dc  = document.createElement("div");  dc.className = "pc-desc";    dc.textContent = p.desc;

    card.appendChild(em); card.appendChild(nm); card.appendChild(dc);

    card.addEventListener("click", () => selectPeriod(p.id, card));
    container.appendChild(card);
  });
}

let _selectedPeriodId = null;

function selectPeriod(id, cardEl) {
  document.querySelectorAll(".period-card").forEach(c => c.classList.remove("selected"));
  cardEl.classList.add("selected");
  _selectedPeriodId = id;
  const btn = $("periodConfirm");
  btn.classList.add("ready");
}

function confirmPeriod() {
  if (!_selectedPeriodId) return;
  if (!Engine.setPeriode(_selectedPeriodId)) return;
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
const STEPS = [
  { id:"village",  label:"Village",     canvasId:"cvVillage",  pal:0 },
  { id:"perso",    label:"Personnage",  canvasId:"cvPerso",    pal:1 },
  { id:"antag",    label:"Antagoniste", canvasId:"cvAntag",    pal:2 },
  { id:"issue",    label:"Issue",       canvasId:"cvIssue",    pal:-1 }, // -1 = roue issue spéciale
  { id:"loot",     label:"Loot",        canvasId:"cvLoot",     pal:-2 }, // -2 = roue loot spéciale
];

const _layerEls = [];
let   _lootPool = [];

function buildRound() {
  const wrap = $("stackWrap");
  // Vider les anciennes couches
  _layerEls.forEach(l => l.remove());
  _layerEls.length = 0;

  STEPS.forEach((step, i) => {
    const layer = document.createElement("div");
    layer.className = "wheel-layer";
    layer.id = "layer-" + i;

    const lbl = document.createElement("div");
    lbl.className = "layer-lbl";
    lbl.textContent = step.label;

    const cv = document.createElement("canvas");
    cv.id = step.canvasId;
    cv.width = WheelEngine.SZ; cv.height = WheelEngine.SZ;
    cv.style.cssText = "width:100%;height:100%;border-radius:50%;display:block;";

    const dot = document.createElement("div"); dot.className = "wheel-dot";

    layer.appendChild(lbl); layer.appendChild(cv); layer.appendChild(dot);
    wrap.appendChild(layer);
    _layerEls.push(layer);
  });

  // Initialiser les roues visibles
  _initWheelDraw(0);

  // Révéler uniquement la première
  revealLayer(0);
  $("stackPtr").classList.remove("show");
  $("stepRes").classList.remove("show");
  $("srLbl").textContent = "";
  $("srVal").textContent = "Lance la roue !";
  $("srVal").className   = "sr-val";

  const btn = $("spinBtn");
  btn.disabled = false; btn.classList.remove("going");
  btn.textContent = "⚡ Tourner — Village";
  $("allBtn").style.display = "";
  $("allBtn").disabled = false;

  Engine.newRound();
}

function _initWheelDraw(stepIdx) {
  const step = STEPS[stepIdx];
  const G = Engine.getState();
  if (step.pal === -1) {
    WheelEngine.drawIssue(step.canvasId, 0);
  } else if (step.pal === -2) {
    _lootPool = Engine.buildLootPool(8);
    WheelEngine.drawLoot(step.canvasId, _lootPool, 0);
  } else {
    const items = _getItems(stepIdx);
    WheelEngine.drawGeneric(step.canvasId, items, step.pal, 0);
  }
}

function _getItems(stepIdx) {
  switch (stepIdx) {
    case 0: return VILLAGES.map(v => v.short);
    case 1: return Engine.getStarters(); // déjà filtrés canBeGenin, retourne noms
    case 2: return Engine.getAntags().map(a => a.name); // objets → noms pour la roue
    default: return [];
  }
}

function revealLayer(i) {
  if (_layerEls[i]) _layerEls[i].classList.add("vis");
}

// ── SPIN ──────────────────────────────────────────────────────
let _stepIdx = 0;
let _stepRots = [0, 0, 0, 0, 0];

function spinCurrent() {
  const G = Engine.getState();
  if (G.round.spinning) return;
  G.round.spinning = true;

  const step = STEPS[_stepIdx];
  revealLayer(_stepIdx);
  $("stackPtr").classList.add("show");

  const btn = $("spinBtn");
  btn.disabled = true; btn.classList.add("going"); btn.textContent = "En rotation...";

  let spinPromise;

  if (step.pal === -1) {
    // Roue Issue — poids calculés dynamiquement selon style joueur vs ennemi
    const weights = Engine.computeIssueWeights();
    // Afficher l'analyse de combat avant de tourner
    showCombatAnalysis(weights);
    spinPromise = WheelEngine.spinIssue({
      canvasId: step.canvasId,
      startRotation: _stepRots[_stepIdx],
      weights,
      onFrame: r => { _stepRots[_stepIdx] = r; },
    }).then(({ targetIndex, finalRotation }) => {
      _stepRots[_stepIdx] = finalRotation;
      _layerEls[_stepIdx].classList.add("done");
      const outcome = OUTCOMES[targetIndex];
      Engine.setResult("outcome", outcome.short);
      Engine.setResult("outcomeIdx", targetIndex);
      showStepResult(step.label, outcome.short, outcome.life < 0 ? "defeat" : "");
    });
  } else if (step.pal === -2) {
    // Roue Loot
    spinPromise = WheelEngine.spinLoot({
      canvasId: step.canvasId,
      pool: _lootPool,
      startRotation: _stepRots[_stepIdx],
      onFrame: r => { _stepRots[_stepIdx] = r; },
    }).then(({ targetIndex, finalRotation, lootItem }) => {
      _stepRots[_stepIdx] = finalRotation;
      _layerEls[_stepIdx].classList.add("done");
      Engine.setResult("loot", lootItem);
      const absorbed = Engine.addLoot(lootItem);
      showStepResult(step.label, lootItem.name, "loot");
      return { lootItem, absorbed };
    });
  } else {
    // Roues génériques
    const items = _getItems(_stepIdx);
    spinPromise = WheelEngine.spinGeneric({
      canvasId: step.canvasId,
      items,
      paletteIdx: step.pal,
      startRotation: _stepRots[_stepIdx],
      onFrame: r => { _stepRots[_stepIdx] = r; },
    }).then(({ targetIndex, finalRotation }) => {
      _stepRots[_stepIdx] = finalRotation;
      _layerEls[_stepIdx].classList.add("done");
      const result = items[targetIndex];
      Engine.setResult(step.id, result);
      // Stocker le style si c'est la roue personnage
      if (step.id === "perso") {
        Engine.setResult("persoStyle", Engine.getPersoStyle(result));
      }
      showStepResult(step.label, result, "");
      // Préparer la prochaine roue
      if (_stepIdx + 1 < STEPS.length) _initWheelDraw(_stepIdx + 1);
    });
  }

  spinPromise.then((extra) => {
    G.round.spinning = false;
    btn.classList.remove("going");

    if (_stepIdx < STEPS.length - 1) {
      _stepIdx++;
      revealLayer(_stepIdx);
      btn.disabled = false;
      btn.textContent = "⚡ Tourner — " + STEPS[_stepIdx].label;

      // Si on vient de finir la roue Issue → appliquer résultat maintenant
      if (STEPS[_stepIdx - 1].id === "issue") {
        const G2 = Engine.getState();
        const result = applyIssue(G2.round.results.outcomeIdx);
        // Initialiser la roue loot APRÈS l'issue
        _initWheelDraw(_stepIdx);
        if (result.gameOver) { setTimeout(showGameOver, 800); return; }
      }
    } else {
      // Toutes les roues terminées
      btn.textContent = "✓ Round terminé !"; btn.disabled = true;
      $("allBtn").style.display = "none";
      setTimeout(showDestiny, 700);
    }
  });
}

function applyIssue(outcomeIdx) {
  const result = Engine.applyOutcome(outcomeIdx);
  updateHUD();
  updateInventoryBar();

  const outcome = OUTCOMES[outcomeIdx];

  if (result.usedChance) {
    showChanceNotice();
  }
  if (result.usedHeal) {
    showHealNotice();
  }
  if (outcome.life < 0 && !result.usedChance) {
    document.body.classList.add("defeat-flash");
    setTimeout(() => document.body.classList.remove("defeat-flash"), 900);
  }

  if (result.victory) {
    setTimeout(showVictory, 1500);
    return result;
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

// ── DESTINY PANEL ─────────────────────────────────────────────
function showDestiny() {
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
function nextRound() {
  $("destinyPanel").classList.remove("vis");
  $("destinyPanel").style.display = "none";
  _stepIdx  = 0;
  _stepRots = [0,0,0,0,0];
  buildRound();
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
  _selectedPeriodId = null;
  _stepIdx  = 0;
  _stepRots = [0,0,0,0,0];
  buildPeriodScreen();
  showScreen("screenPeriod");
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
  buildPeriodScreen();
  showScreen("screenPeriod");
});
