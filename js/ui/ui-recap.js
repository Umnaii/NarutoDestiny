/**
 * @file ui-recap.js
 * @module ui/recap
 * @description Récapitulatif de round, analyses combat/examen, échec d'examen,
 *              collection de badges (cliquable pour ouvrir l'historique
 *              victoires/nuls/défaites d'un antagoniste), notices chance/soin/sauvegarde,
 *              portrait de l'adversaire du round en cours (voir engine.js → getPortrait()).
 *              Extrait de ui.js lors du refactoring Phase 1.
 *
 * @dependencies
 *   - ../data.js   → OUTCOMES
 *   - ../engine.js → Engine.getState(), Engine.getAntagData(), Engine.getPortrait(),
 *                    Engine.currentRank(), Engine.nextRank()
 *   - ui-core.js   → $()
 *   - ui-svg.js    → makeBadgeSvg()
 *
 * @exports (fonctions globales)
 *   - showRoundSummary(), showExamenAnalysis(weights), showExamFailure(),
 *     _typeLabel(t), _rarityLabel(r), updateCollection(),
 *     showCombatAnalysis(weights), showChanceNotice(), showHealNotice(), showSaveNotice(),
 *     updateAntagPortrait(), openAntagHistory(name), closeAntagHistory()
 */

// ── PORTRAIT ADVERSAIRE ───────────────────────────────────────
/**
 * @description Affiche ou masque le portrait de l'adversaire du round courant (sidebar
 *              droite), à partir de Engine.getPortrait() — résolu au rang courant du
 *              joueur (celui auquel se déroule le combat). Reste masqué tant qu'aucun
 *              antagoniste n'est encore tiré ce round (voir ui-round.js →
 *              buildRound()), ou si son nom n'a pas encore de portrait renseigné (WORK IN
 *              PROGRESS — la table ne couvre pas encore tous les personnages).
 *              Reste visible pendant tout le round (donc pendant le combat) une fois
 *              l'antagoniste tiré. Ce portrait n'est qu'un affichage "live" : une fois
 *              le combat résolu, c'est le portrait figé dans G.antagHistory (voir
 *              engine.js → applyOutcome()) qui fait foi dans l'historique
 *              (openAntagHistory()), pas celui-ci.
 *
 * @sideEffects
 *   Modifie l'affichage de #antagPortraitBox, #antagPortraitImg, #antagPortraitName
 */
function updateAntagPortrait() {
  const G    = Engine.getState();
  const name = G.round.results.antag;
  const src  = Engine.getPortrait(name);
  const box  = $("antagPortraitBox");
  if (!src) { box.style.display = "none"; return; }
  $("antagPortraitImg").src = src;
  $("antagPortraitImg").alt = name;
  $("antagPortraitName").textContent = name;
  box.style.display = "flex";
}

// ── HISTORIQUE ADVERSAIRE (victoires / nuls / défaites) ───────
/**
 * @description Affiche la popup d'historique de combats contre un antagoniste donné :
 *              portrait figé au moment de la première rencontre (voir G.antagHistory
 *              dans engine.js), et décompte cumulé de tous les combats menés contre lui
 *              durant la partie. Déclenchée en cliquant un badge de la collection (voir
 *              updateCollection()).
 *
 * @param {string} name - Nom de l'antagoniste (clé de G.antagHistory)
 *
 * @sideEffects
 *   Modifie #antagHistImg/#antagHistName/#antagHistWin/#antagHistDraw/#antagHistLoss,
 *   affiche l'overlay #antagHistOv
 */
function openAntagHistory(name) {
  const G   = Engine.getState();
  const rec = G.antagHistory[name];
  if (!rec) return;

  const img = $("antagHistImg");
  if (rec.portrait) { img.src = rec.portrait; img.alt = name; img.style.display = "block"; }
  else { img.style.display = "none"; }

  $("antagHistName").textContent  = name;
  $("antagHistWin").textContent   = rec.win;
  $("antagHistDraw").textContent  = rec.draw;
  $("antagHistLoss").textContent  = rec.loss;

  $("antagHistOv").classList.add("show");
}

/**
 * @description Ferme la popup d'historique de combats contre un antagoniste.
 * @sideEffects
 *   Retire la classe `.show` de #antagHistOv
 */
function closeAntagHistory() {
  $("antagHistOv").classList.remove("show");
}

// ── RÉSUMÉ DE ROUND ───────────────────────────────────────────
/**
 * @description Construit et affiche le récapitulatif complet du round dans une popup
 *              plein écran : grille personnage/antagoniste/combat/butin, récit
 *              narratif, panneau de butin obtenu, badge d'ennemi vaincu (si le combat
 *              n'est pas une défaite). L'historique des combats (collection de badges)
 *              n'est pas rafraîchi ici : il l'est déjà, instantanément, dès la fin du
 *              combat (voir ui-round.js → applyIssue()), avant même ce récapitulatif.
 *              Affiché après la phase loot quand l'examen n'est pas encore disponible,
 *              ou en fin de round complet. Fermée par le bouton "⚡ Round suivant" de la
 *              popup, qui appelle nextRound() (voir ui-round.js).
 *
 * @sideEffects
 *   Affiche l'overlay #recapOv, modifie #dGrid, #dStory, #lootPanel (+ enfants),
 *   #badgeSection (+ enfants) ; remet le scroll de #recapBox en haut
 */
function showRoundSummary() {
  const G = Engine.getState();
  const { perso, antag, outcome, loot, outcomeIdx, persoStyle } = G.round.results;
  const od = OUTCOMES[outcomeIdx] || OUTCOMES[0];
  const lootItem = loot;
  const antagData = Engine.getAntagData(antag);
  const STYLE_EMOJI = { ninjutsu:"🔥", taijutsu:"💪", genjutsu:"😵" };
  const STYLE_NOM   = { ninjutsu:"Ninjutsu", taijutsu:"Taijutsu", genjutsu:"Genjutsu" };

  const box = $("recapBox");
  $("recapOv").classList.add("show");

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
    $("badgeSvgWrap").innerHTML = makeBadgeSvg(antag, 64);
    $("badgeNm").textContent    = antag;
    $("badgeSb").textContent    = od.emoji+" "+outcome;
  } else { badgeSection.style.display = "none"; }

  box.scrollTop = 0;
}

// ── ANALYSE EXAMEN ────────────────────────────────────────────
/**
 * @description Affiche, juste avant le spin de la roue d'examen, un résumé du rang visé
 *              et de la chance de réussite estimée à partir des poids calculés.
 *
 * @param {Object[]} weights - Poids de la roue d'examen, tel que retourné par
 *                             Engine.computeExamenWeights() (index 0 = Réussite)
 *
 * @sideEffects
 *   Remplace le contenu de #arenaStepLabel
 */
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
/**
 * @description Affiche un récapitulatif simplifié en cas d'échec à l'examen de passage :
 *              pas de perte de vie, invitation à retourner combattre.
 *
 * @sideEffects
 *   Affiche l'overlay #recapOv, modifie #dGrid, #dStory, masque #lootPanel et
 *   #badgeSection, remet le scroll de #recapBox en haut
 */
function showExamFailure() {
  const box = $("recapBox");
  $("recapOv").classList.add("show");

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

  box.scrollTop = 0;
}

/**
 * @description Traduit un type d'objet en libellé français lisible.
 * @param {string} t - Type d'objet ("weapon"|"ninjutsu"|"taijutsu"|"genjutsu"|"heal"|"chance")
 * @returns {string} Libellé français, ou `t` inchangé si le type est inconnu
 */
function _typeLabel(t) {
  const m = { weapon:"Arme", ninjutsu:"Ninjutsu", taijutsu:"Taijutsu", genjutsu:"Genjutsu", heal:"Soin", chance:"Chance" };
  return m[t] || t;
}
/**
 * @description Traduit une rareté d'objet en libellé français lisible.
 * @param {string} r - Rareté ("common"|"uncommon"|"rare"|"epic")
 * @returns {string} Libellé français, ou `r` inchangé si la rareté est inconnue
 */
function _rarityLabel(r) {
  const m = { common:"Commun", uncommon:"Peu commun", rare:"Rare", epic:"Épique" };
  return m[r] || r;
}

// ── COLLECTION ────────────────────────────────────────────────
/**
 * @description Reconstruit l'historique des combats (une ligne compacte par combat mené,
 *              victoire/nul/défaite confondus — voir G.badges dans engine.js →
 *              applyOutcome()) dans la sidebar droite. Ne fait rien tant qu'aucun combat
 *              n'a encore eu lieu. Chaque ligne montre le portrait de l'antagoniste (ou,
 *              à défaut de portrait connu, son badge procédural, réduit), son nom et le
 *              résultat, sur une seule ligne ; cliquer une ligne ouvre l'historique
 *              cumulé (victoires/nuls/défaites) contre cet antagoniste (voir
 *              openAntagHistory()).
 *
 * @sideEffects
 *   Ajoute la classe `.show` à #collSection, remplit #collSub et reconstruit #collGrid
 */
function updateCollection() {
  const G = Engine.getState();
  if (!G.badges.length) return;

  const sec = $("collSection");
  sec.classList.add("show");
  $("collSub").textContent = G.badges.length + " combat" + (G.badges.length > 1 ? "s" : "") + " mené" + (G.badges.length > 1 ? "s" : "");

  const grid = $("collGrid");
  grid.textContent = "";
  G.badges.forEach((b, i) => {
    const sl  = document.createElement("div"); sl.className = "bslot"; sl.style.animationDelay = (i * .03) + "s";
    sl.tabIndex = 0;
    sl.setAttribute("role", "button");
    sl.setAttribute("aria-label", "Voir l'historique de combats contre " + b.antag);

    const imgWrap = document.createElement("span"); imgWrap.className = "bslot-img-wrap";
    if (b.portrait) {
      const img = document.createElement("img");
      img.className = "bslot-img"; img.src = b.portrait; img.alt = "";
      imgWrap.appendChild(img);
    } else {
      // SÉCURITÉ : SVG depuis makeBadgeSvg — constantes + hash uniquement
      imgWrap.innerHTML = makeBadgeSvg(b.antag, 32);
    }

    const nm  = document.createElement("span"); nm.className = "bslot-nm";  nm.textContent = b.antag;
    const out = document.createElement("span"); out.className = "bslot-out " + b.outcomeCls; out.textContent = b.emoji + " " + b.outcomeShort;

    sl.appendChild(imgWrap); sl.appendChild(nm); sl.appendChild(out);
    sl.addEventListener("click", () => openAntagHistory(b.antag));
    sl.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openAntagHistory(b.antag); } });
    grid.appendChild(sl);
  });
}

// ── ANALYSE COMBAT ────────────────────────────────────────────
/**
 * @description Affiche, juste avant le spin de la roue de combat, le matchup de styles
 *              (avantage/désavantage/neutre) entre le joueur et l'antagoniste, ainsi que
 *              la chance de victoire estimée à partir des poids calculés.
 *
 * @param {Object[]} weights - Poids de la roue de combat, tel que retourné par
 *                             Engine.computeIssueWeights() (index 0 = Victoire)
 *
 * @sideEffects
 *   Remplace le contenu de #arenaStepLabel
 */
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

// ── CHANCE / HEAL / SAUVEGARDE NOTICES ────────────────────────
/**
 * @description Affiche une notice temporaire (5s) confirmant qu'un talisman "chance" a
 *              automatiquement annulé une défaite.
 *
 * @sideEffects
 *   Ajoute un élément à #arenaBox, le retire après 5000ms
 */
function showChanceNotice() {
  const el = document.createElement("div");
  el.className = "chance-used-notice";
  el.textContent = "🎴 Talisman utilisé automatiquement — défaite annulée !";
  $("arenaBox").appendChild(el);
  setTimeout(() => el.remove(), 5000);
}

/**
 * @description Affiche une notice temporaire (5s) confirmant qu'un soin a été consommé
 *              automatiquement pour récupérer une vie après une défaite.
 *
 * @sideEffects
 *   Ajoute un élément à #arenaBox, le retire après 5000ms
 */
function showHealNotice() {
  const el = document.createElement("div");
  el.className = "heal-used-notice";
  el.textContent = "💊 Soin utilisé automatiquement — une vie récupérée !";
  $("arenaBox").appendChild(el);
  setTimeout(() => el.remove(), 5000);
}

/**
 * @description Affiche une notice temporaire (2.5s) confirmant qu'une sauvegarde
 *              manuelle vient d'être effectuée (voir ui-round.js → manualSaveGame()).
 *              Plus courte que les notices chance/soin : une simple confirmation
 *              d'action volontaire n'a pas besoin de rester affichée aussi longtemps.
 *
 * @sideEffects
 *   Ajoute un élément à #arenaBox, le retire après 2500ms
 */
function showSaveNotice() {
  const el = document.createElement("div");
  el.className = "save-notice";
  el.textContent = "💾 Partie sauvegardée !";
  $("arenaBox").appendChild(el);
  setTimeout(() => el.remove(), 2500);
}

