/**
 * @file kage-loot.js
 * @module kage-loot
 * @description Butin du mode défense de Kage — règles DÉDIÉES et volontairement tenues
 *              à l'écart de engine.js → buildLootPool() (le butin "normal", avant le rang
 *              Kage) pour ne jamais confondre les deux systèmes : une fois Kage, chaque
 *              vague donne 25% de chances d'obtenir un objet réel si le combat est gagné
 *              nettement, seulement 15% s'il est perdu (mais survécu grâce à un talisman
 *              "chance" ou un soin automatique), et aucune chance sur un match nul — un
 *              match nul est un statu quo pur (voir engine.js → applyOutcome()), il ne
 *              fait ni gagner ni perdre de butin, pas plus qu'il ne fait progresser le
 *              score de vagues repoussées.
 *
 * @dependencies
 *   - ../data.js   → RARITY_WEIGHTS (pour calculer le poids de l'objet fictif "Rien
 *                    cette fois" relativement aux objets réels du pool)
 *   - ../engine.js → Engine.buildLootPool(size, true) — utilisé uniquement pour tirer
 *                    les objets réels du pool (toujours en mode "garanti" : le "Rien"
 *                    éventuel est entièrement géré ici, jamais par engine.js pour ce mode)
 *
 * @exports (objet KageLoot)
 *   - buildPool(size, outcomeIdx)
 *
 * SÉCURITÉ : données statiques et calculs purs uniquement, aucune manipulation du DOM.
 */

const KageLoot = (() => {

  // Chances d'obtenir un objet réel sur une vague, selon l'issue de son combat. Ces
  // valeurs sont propres au mode défense de Kage — ne pas les confondre avec la règle du
  // butin normal (garanti sur victoire, 40% sinon — voir engine.js → buildLootPool()).
  const WIN_CHANCE  = 0.25;
  const LOSS_CHANCE = 0.15;

  /**
   * @description Construit le pool de la roue "Butin" d'une vague du mode défense de
   *              Kage. Un match nul (outcomeIdx===1) est un statu quo pur : le pool ne
   *              contient alors que l'objet fictif "Rien cette fois" (100% de chances,
   *              aucun objet réel tiré). Sinon, tire `size` objets réels (voir
   *              Engine.buildLootPool(size, true)) et leur ajoute un "Rien cette fois"
   *              dont le poids est calculé pour que la chance réelle d'obtenir un objet
   *              soit exactement WIN_CHANCE (victoire) ou LOSS_CHANCE (défaite survécue).
   *
   * @param {number} size       - Nombre d'objets réels à inclure si un butin est possible
   * @param {number} outcomeIdx - Issue du combat de cette vague (0=Victoire, 1=Match nul,
   *                              2=Défaite — voir data.js → OUTCOMES)
   *
   * @returns {Object[]} Pool prêt pour WheelEngine.drawLoot()/spinLoot() : soit un unique
   *                     objet "Rien cette fois" (match nul), soit les objets réels +
   *                     "Rien cette fois" en dernière position, pondéré pour respecter la
   *                     chance exacte de la victoire ou de la défaite
   */
  function buildPool(size, outcomeIdx) {
    const nothing = {
      id: "nothing", name: "Rien cette fois", emoji: "💨", type: "none",
      rarity: "common", desc: "Cette fois, aucun butin.", effect: "none",
    };

    const chance = outcomeIdx === 0 ? WIN_CHANCE : outcomeIdx === 2 ? LOSS_CHANCE : 0;
    if (chance <= 0) return [nothing]; // match nul : statu quo pur, aucune chance de butin

    const realPool  = Engine.buildLootPool(size, true);
    const realTotal = realPool.reduce((s, it) => s + RARITY_WEIGHTS[it.rarity], 0) || 1;

    return [
      ...realPool,
      { ...nothing, forcedWeight: realTotal * (1 - chance) / chance },
    ];
  }

  return { buildPool };
})();
