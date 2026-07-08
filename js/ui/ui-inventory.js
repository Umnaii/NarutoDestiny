/**
 * @file ui-inventory.js
 * @module ui/inventory
 * @description Barre d'inventaire (liste compacte icône + nom, cliquable pour voir le
 *              détail), popup d'utilisation d'objet avant combat, et popup tutoriel pour
 *              les objets à activation manuelle obligatoire (voir data.js →
 *              LOOT_POOL/effect "boost_issue"/"boost_examen").
 *              Extrait de ui.js lors du refactoring Phase 1.
 *
 * @dependencies
 *   - ../data.js   → TYPE_CSS
 *   - ../engine.js → Engine.getState(), Engine.useHealNow(), Engine.toggleItemArmed(),
 *                    Engine.isManualUseItem(), Engine.markManualUseTutorialSeen()
 *   - ui-core.js   → $()
 *   - ui-hud.js    → updateHUD()
 *   - ui-round.js  → updateFleeButtonVisibility()
 *
 * @exports (fonctions globales)
 *   - updateInventoryBar()
 *   - openItemUsePopup(idx)
 *   - closeItemUsePopup()
 *   - showManualUseTutorial(item)
 *   - closeManualUseTutorial()
 */

// ── INVENTORY BAR ─────────────────────────────────────────────
const STYLE_NOM_INV = { ninjutsu:"Ninjutsu", taijutsu:"Taijutsu", genjutsu:"Genjutsu" };

/**
 * @description Génère un texte lisible décrivant le bonus/effet réel d'un objet
 *              d'inventaire, en reflétant la logique de pondération d'Engine
 *              (computeIssueWeights()/computeExamenWeights()) pour que le texte reste
 *              toujours synchronisé avec l'effet réel appliqué en jeu. Les bonus sont
 *              exprimés en % de chances (le combat et l'examen reposent tous deux sur
 *              un pool de poids qui totalise 100 avant matchup de styles, donc un bonus
 *              de poids +N s'y lit directement comme +N% de chances).
 *
 * @param {Object} item - Objet d'inventaire (voir data.js → LootItemData)
 *
 * @returns {string} Description du bonus, adaptée au type/effet de l'objet et, pour
 *                   les techniques, au style de combat du joueur (G.persoStyle)
 */
function _itemBonusText(item) {
  const G = Engine.getState();
  if (item.effect === "heal") {
    return "💊 Restaure automatiquement 1 vie à la prochaine défaite (usage unique par exemplaire).";
  }
  if (item.effect === "chance") {
    const n = item.count || 1;
    return "🎴 Annule automatiquement ta prochaine défaite (usage unique par exemplaire) · +" + (20 * n) + "% de chances de réussite à l'examen.";
  }
  if (item.effect === "boost_issue") {
    return "🥷 À activer toi-même avant un combat : +25% de chances de victoire pour ce combat uniquement (usage unique — inutile si jamais activé).";
  }
  if (item.effect === "boost_examen") {
    return "🥷 À activer toi-même avant un examen : +30% de chances de réussite pour cet examen uniquement (usage unique — inutile si jamais activé).";
  }
  if (item.effect === "skip_fight") {
    return "🥷 À activer toi-même avant un combat : évite entièrement ce combat (ni victoire, ni défaite, ni butin). Usage unique — inutile si jamais activé.";
  }
  if (item.type === "weapon") {
    return "+5% de chances de victoire en combat · +4% de chances de réussite à l'examen.";
  }
  if (item.type === "ninjutsu" || item.type === "taijutsu" || item.type === "genjutsu") {
    const matches = item.type === G.persoStyle;
    return matches
      ? "+8% de chances de victoire en combat (ton style : " + STYLE_NOM_INV[item.type] + ") · +6% de chances de réussite à l'examen."
      : "+6% de chances de réussite à l'examen (style " + STYLE_NOM_INV[item.type] + " ≠ le tien).";
  }
  return item.desc;
}

/**
 * @description Reconstruit entièrement la barre d'inventaire de la sidebar gauche, sous
 *              forme de liste compacte : une ligne par objet, icône + nom uniquement (le
 *              détail — bonus, description, actions — s'affiche dans la popup ouverte au
 *              clic, voir openItemUsePopup()). Un objet à activation manuelle obligatoire
 *              (voir Engine.isManualUseItem()) qui n'a pas encore été activé affiche un
 *              petit symbole 🥷 sur son icône, pour signaler qu'il ne sert à rien tant
 *              qu'on ne l'utilise pas soi-même. Un objet consommable looté plusieurs fois
 *              (voir Engine.addLoot()) affiche sa quantité ("×2", "×3"…) à côté de son nom.
 *
 * @sideEffects
 *   Remplace le contenu de #invItems ; attache un listener click/clavier sur chaque
 *   objet (ouvre openItemUsePopup())
 */
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
    const el = document.createElement("div");
    el.className = "inv-item " + (TYPE_CSS[item.type] || "");
    el.tabIndex = 0;
    el.setAttribute("role", "button");
    el.setAttribute("aria-label", "Voir " + item.name);

    const icoWrap = document.createElement("span"); icoWrap.className = "inv-icon-wrap";
    const ico = document.createElement("span"); ico.className = "loot-icon"; ico.textContent = item.emoji;
    icoWrap.appendChild(ico);
    if (Engine.isManualUseItem(item) && item.armed === false) {
      const badge = document.createElement("span");
      badge.className = "inv-needs-use";
      badge.textContent = "🥷";
      badge.title = "À activer toi-même pour qu'il serve";
      icoWrap.appendChild(badge);
    }

    const name = document.createElement("div"); name.className = "inv-item-name";
    name.textContent = item.name + ((item.count || 1) > 1 ? " ×" + item.count : "");

    el.appendChild(icoWrap); el.appendChild(name);
    el.addEventListener("click", () => openItemUsePopup(i));
    el.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openItemUsePopup(i); } });
    bar.appendChild(el);
  });
}

// ── POPUP D'UTILISATION D'OBJET AVANT COMBAT ─────────────────
/**
 * @description Ouvre la popup d'utilisation d'objet pour l'index d'inventaire donné,
 *              avec un bouton d'action adapté au type d'objet : "Utiliser maintenant"
 *              (soin, désactivé si vies déjà pleines), "Activer/Désactiver la
 *              protection" (talisman "chance"), ou "Activer pour le prochain
 *              combat/examen" (objet à activation manuelle "boost_issue"/
 *              "boost_examen" — voir Engine.isManualUseItem()), plus un bouton "Garder
 *              tel quel". Pour les objets sans action possible (armes, techniques),
 *              seul le bouton "Garder tel quel" est affiché — la popup sert alors
 *              uniquement à consulter le détail de l'objet.
 *
 * @param {number} idx - Index de l'objet dans G.inventory
 *
 * @sideEffects
 *   Remplit #iuIcon/#iuName/#iuDesc/#iuBonus/#iuActions et affiche l'overlay #itemUseOv
 */
function openItemUsePopup(idx) {
  const G = Engine.getState();
  const item = G.inventory[idx];
  if (!item) return;

  $("iuIcon").textContent = item.emoji;
  $("iuName").textContent = item.name;
  $("iuDesc").textContent = item.desc;
  $("iuBonus").textContent = _itemBonusText(item);

  const actions = $("iuActions");
  actions.textContent = "";

  if (item.effect === "heal") {
    const canHeal = G.lives < G.livesMax;
    const useBtn = document.createElement("button");
    useBtn.className = "btn-next-round";
    useBtn.textContent = canHeal ? "💊 Utiliser maintenant (+1 vie)" : "Vies déjà au maximum";
    useBtn.disabled = !canHeal;
    if (!canHeal) useBtn.style.cssText = "opacity:.45;cursor:not-allowed;";
    useBtn.onclick = () => {
      const res = Engine.useHealNow(idx);
      if (res.ok) { updateHUD(); updateInventoryBar(); }
      closeItemUsePopup();
    };
    actions.appendChild(useBtn);
  }

  if (item.effect === "chance") {
    const armed = item.armed !== false;
    const toggleBtn = document.createElement("button");
    toggleBtn.className = "btn-next-round";
    toggleBtn.textContent = armed ? "○ Désactiver la protection" : "✓ Réactiver la protection";
    toggleBtn.onclick = () => {
      Engine.toggleItemArmed(idx);
      updateInventoryBar();
      closeItemUsePopup();
    };
    actions.appendChild(toggleBtn);
  }

  if (item.effect === "boost_issue" || item.effect === "boost_examen") {
    const armed = item.armed === true;
    const target = item.effect === "boost_issue" ? "combat" : "examen";
    const toggleBtn = document.createElement("button");
    toggleBtn.className = "btn-next-round";
    toggleBtn.textContent = armed
      ? "✓ Activé pour le prochain " + target
      : "🥷 Activer pour le prochain " + target;
    toggleBtn.onclick = () => {
      Engine.toggleItemArmed(idx);
      updateInventoryBar();
      closeItemUsePopup();
    };
    actions.appendChild(toggleBtn);
  }

  if (item.effect === "skip_fight") {
    const armed = item.armed === true;
    const toggleBtn = document.createElement("button");
    toggleBtn.className = "btn-next-round";
    toggleBtn.textContent = armed ? "✓ Activé — fuis le prochain combat" : "🥷 Activer pour fuir le prochain combat";
    toggleBtn.onclick = () => {
      Engine.toggleItemArmed(idx);
      updateInventoryBar();
      updateFleeButtonVisibility();
      closeItemUsePopup();
    };
    actions.appendChild(toggleBtn);
  }

  const closeBtn = document.createElement("button");
  closeBtn.className = "iu-btn-secondary";
  closeBtn.textContent = "Garder tel quel";
  closeBtn.onclick = closeItemUsePopup;
  actions.appendChild(closeBtn);

  $("itemUseOv").classList.add("show");
}

/**
 * @description Ferme la popup d'utilisation d'objet.
 * @sideEffects
 *   Retire la classe `.show` de #itemUseOv
 */
function closeItemUsePopup() {
  $("itemUseOv").classList.remove("show");
}

// ── TUTORIEL OBJET À ACTIVATION MANUELLE ─────────────────────
/**
 * @description Affiche, une seule fois pour toute la partie, la popup tutoriel
 *              expliquant qu'un objet à activation manuelle obligatoire (voir
 *              Engine.isManualUseItem()) ne sert à rien tant que le joueur ne l'active
 *              pas lui-même depuis l'inventaire. Appelée par ui-round.js →
 *              spinCurrent() dès qu'un tel objet est obtenu, tant que
 *              G.seenManualUseTutorial est encore false.
 *
 * @param {Object} item - L'objet à activation manuelle qui vient d'être obtenu
 *
 * @sideEffects
 *   Remplit #muIcon/#muName et affiche l'overlay #manualUseOv
 */
function showManualUseTutorial(item) {
  $("muIcon").textContent = item.emoji;
  $("muName").textContent = item.name;
  $("manualUseOv").classList.add("show");
}

/**
 * @description Ferme la popup tutoriel et la marque comme vue pour le reste de la
 *              partie (voir Engine.markManualUseTutorialSeen()) — elle ne s'affichera
 *              alors plus jamais, même si un autre objet à activation manuelle est
 *              obtenu plus tard dans la même partie.
 *
 * @sideEffects
 *   Retire la classe `.show` de #manualUseOv, appelle Engine.markManualUseTutorialSeen()
 */
function closeManualUseTutorial() {
  $("manualUseOv").classList.remove("show");
  Engine.markManualUseTutorialSeen();
}
