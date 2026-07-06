/**
 * @file ui-hud.js
 * @module ui/hud
 * @description Affichage des vies et du rang (HUD haut de la sidebar gauche), et
 *              portrait du personnage joué — évolue avec le rang courant du joueur
 *              (voir engine.js → getPortrait()).
 *              Extrait de ui.js lors du refactoring Phase 1.
 *
 * @dependencies
 *   - ../engine.js → Engine.getState(), Engine.currentRank(), Engine.nextRank(),
 *                    Engine.rankPct(), Engine.getPortrait()
 *   - ../data.js   → WINS_PER_RANK
 *   - ui-core.js   → $()
 *   - ui-svg.js    → makeRankEmblem()
 *
 * @exports (fonctions globales)
 *   - updateHUD()
 *   - updateHearts(lives, livesMax)
 *   - updateRankHUD()
 *   - updatePersoPortrait()
 *   - animFill(id, target)
 */

// ── HUD ───────────────────────────────────────────────────────
/**
 * @description Rafraîchit l'intégralité du HUD (vies + rang + portrait du personnage)
 *              à partir de l'état courant du joueur. Appelée après chaque événement qui
 *              peut modifier les vies ou la progression de rang.
 *
 * @sideEffects
 *   Modifie le DOM via updateHearts(), updateRankHUD() et updatePersoPortrait()
 */
function updateHUD() {
  const G = Engine.getState();
  updateHearts(G.lives, G.livesMax);
  updateRankHUD();
  updatePersoPortrait();
}

/**
 * @description Affiche ou masque le portrait du personnage joué (sidebar gauche), à
 *              partir de Engine.getPortrait() — recalculé au rang courant à chaque
 *              appel, le portrait évolue donc automatiquement à mesure que le joueur
 *              progresse en rang (jeune ninja aux rangs Genin/Chûnin, portrait adulte
 *              aux rangs Jônin/Kage — voir CHARACTER_PORTRAITS dans data.js). Reste
 *              masqué tant qu'aucun personnage n'est encore tiré, ou si son nom n'a pas
 *              encore de portrait renseigné (WORK IN PROGRESS — la table ne couvre pas
 *              encore tous les personnages).
 *
 * @sideEffects
 *   Modifie l'affichage de #persoPortraitBox, #persoPortraitImg, #persoPortraitName
 */
function updatePersoPortrait() {
  const G   = Engine.getState();
  const src = Engine.getPortrait(G.perso);
  const box = $("persoPortraitBox");
  if (!src) { box.style.display = "none"; return; }
  $("persoPortraitImg").src = src;
  $("persoPortraitImg").alt = G.perso;
  $("persoPortraitName").textContent = G.perso;
  box.style.display = "flex";
}

/**
 * @description Reconstruit l'affichage des cœurs de vie : un cœur plein par vie
 *              restante, un cœur vide pour chaque vie perdue jusqu'à `livesMax`.
 *
 * @param {number} lives    - Vies restantes
 * @param {number} livesMax - Plafond de vies actuel
 *
 * @sideEffects
 *   Remplace le contenu de #livesHearts
 */
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

/**
 * @description Rafraîchit la zone rang du HUD : nom et couleur du rang courant, emblème
 *              SVG, compteur de victoires vers le prochain examen, nom du rang suivant,
 *              et anime la barre de progression vers sa nouvelle valeur. En mode défense
 *              de Kage (G.kageDefense), la progression de rang n'a plus de sens (rang
 *              déjà maximal) — elle est remplacée par le compteur de vagues repoussées.
 *
 * @sideEffects
 *   Modifie #rankNameHUD, #rankFillHUD, #rankEmblemHUD, #rankWinsC, #rankWinsM,
 *   #rankNextN, #kageWaveCount, l'affichage de #hudRankNormal/#hudKageDefense, et
 *   déclenche l'animation animFill()
 */
function updateRankHUD() {
  const rank = Engine.currentRank();
  const next = Engine.nextRank();
  const G    = Engine.getState();

  $("hudRankNormal").style.display   = G.kageDefense ? "none" : "flex";
  $("hudKageDefense").style.display  = G.kageDefense ? "flex" : "none";

  if (G.kageDefense) {
    $("kageWaveCount").textContent = G.kageDefenseKills;
    return;
  }

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

/**
 * @description Anime en douceur la largeur (en %) d'une barre de progression, de sa
 *              valeur actuelle vers `target`, avec un easing "ease-out" cubique sur 800ms.
 *
 * @param {string} id     - id de l'élément DOM dont on anime `style.width`
 * @param {number} target - Largeur cible en pourcentage (0-100)
 *
 * @sideEffects
 *   Modifie `style.width` de l'élément #`id` à chaque frame via requestAnimationFrame
 */
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
