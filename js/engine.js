/**
 * @file engine.js
 * @module engine
 * @description Moteur de jeu : détient l'état global (playerState `G`), les règles de
 *              calcul des probabilités de combat/examen, et les transitions de phase
 *              (combat → loot → examen → promotion/game over). Ne touche jamais au DOM :
 *              les fichiers ui/*.js lisent Engine.getState() et appellent ses fonctions,
 *              jamais l'inverse.
 *
 * @dependencies
 *   - data.js → VILLAGES, STARTERS, RANKS, ANTAGONISTS, CHARACTER_PORTRAITS, OUTCOMES,
 *               LOOT_POOL, RARITY_WEIGHTS
 *
 * @exports (objet Engine)
 *   - getState, setVillage, getStarters, getPersoStyle, getAntags, getAntagData,
 *     getPortrait, computeIssueWeights, computeExamenWeights, setResult, setPerso,
 *     applyOutcome, applyExamen, addLoot, buildLootPool, useHealNow, toggleItemArmed,
 *     isManualUseItem, markManualUseTutorialSeen,
 *     newRound, fullReset, currentRank, nextRank, rankPct
 *
 * @sideEffects
 *   - Toutes les fonctions ci-dessus (hors getState/currentRank/nextRank/rankPct, qui
 *     sont des lectures pures) modifient l'objet d'état interne `G`.
 *
 * SÉCURITÉ : aucune donnée utilisateur. Pas de localStorage.
 *            Tout est en RAM — réinitialisé à chaque visite.
 */

const Engine = (() => {

  // ── État global ──────────────────────────────────────────────
  /**
   * État global du joueur et de la partie en cours. Objet unique, muté en place par
   * les fonctions de ce module. Lu par toutes les fonctions Engine.getState() côté UI,
   * jamais modifié directement par les fichiers ui/*.js.
   *
   * @typedef {Object} PlayerState
   * @property {?VillageData} village    - Village choisi au départ (fixe pour la partie). @type {?VillageData}
   * @property {Object}  round           - État du round en cours.
   * @property {number}  round.step      - Index de l'étape courante (informatif — le pilotage réel utilise _stepIdx dans ui-round.js).
   * @property {Object}  round.results   - Résultats accumulés du round (village, perso, persoStyle, antag, outcome, outcomeIdx, loot, examen, examenIdx).
   * @property {boolean} round.spinning  - true pendant qu'une roue est en train de tourner (empêche un double spin).
   * @property {number}  lives           - Vies restantes. Valeur initiale : 3. Game over si atteint 0. @type {number}
   * @property {number}  livesMax        - Plafond de vies, peut monter jusqu'à 5 via un soin obtenu à vies pleines. Valeur initiale : 3. @type {number}
   * @property {number}  rankIdx         - Index courant dans RANKS (0 = Genin … 3 = Kage). Valeur initiale : 0. @type {number}
   * @property {number}  wins            - Victoires en combat depuis la dernière promotion ; déclenche l'examen dès que > 0. Valeur initiale : 0. @type {number}
   * @property {?string} perso           - Nom du personnage tiré, persistant jusqu'au game over/victoire. Valeur initiale : null. @type {?string}
   * @property {?string} persoStyle      - Style de combat du personnage ("ninjutsu"|"taijutsu"|"genjutsu"). Valeur initiale : null. @type {?string}
   * @property {Array}   inventory       - Objets de loot possédés (voir data.js → LootItemData). Valeur initiale : []. @type {Array}
   * @property {Array}   badges          - Badges d'ennemis vaincus/affrontés (voir applyOutcome()). Valeur initiale : []. @type {Array}
   * @property {Object.<string, {win:number, draw:number, loss:number, portrait:?string}>}
   *                     antagHistory    - Historique cumulé (victoires/nuls/défaites) par
   *                                       antagoniste affronté, tous rounds confondus (voir
   *                                       applyOutcome(), getAntagHistory()). Le portrait
   *                                       de chaque antagoniste y est figé à sa première
   *                                       rencontre et ne change plus jamais ensuite, même
   *                                       si le rang du joueur progresse par la suite.
   *                                       Valeur initiale : {}. @type {Object}
   * @property {string}  phase           - Phase du flux de round : "combat" | "loot" | "examen". Valeur initiale : "combat". @type {string}
   * @property {boolean} examReady       - true quand l'examen de passage est accessible ce round (wins > 0). Valeur initiale : false. @type {boolean}
   * @property {string}  status          - Statut global de la partie : "village_select" | "playing" | "gameover" | "victory". Valeur initiale : "village_select". @type {string}
   * @property {boolean} seenManualUseTutorial - true dès que le joueur a fermé la popup
   *                     tutoriel expliquant les objets à activation manuelle obligatoire
   *                     (voir isManualUseItem(), markManualUseTutorialSeen()) ; ne
   *                     s'affiche alors plus jamais pour le reste de la partie, même si
   *                     un autre objet du même genre est ensuite obtenu. Valeur initiale :
   *                     false. @type {boolean}
   */
  const G = {
    village:  null,   // fixé au départ

    round: {
      step:    0,
      results: {},
      spinning: false,
    },

    lives:    3,
    livesMax: 3,
    rankIdx:  0,
    wins:     0,      // combats gagnés dans le rang courant (pour déclencher l'examen)

    // Persistants entre les rounds
    perso:    null,   // nom du perso (fixé après 1er spin jusqu'au game over)
    persoStyle: null, // style de combat du perso

    inventory: [],
    badges:    [],
    antagHistory: {}, // { [nomAntagoniste]: { win, draw, loss, portrait } }
    seenManualUseTutorial: false,

    // Flux : "combat" → "loot" → "examen" → (réussite→rang suivant | échec→"combat")
    phase: "combat",  // "combat" | "loot" | "examen"
    examReady: false, // true quand assez de victoires pour déclencher l'examen

    status: "village_select",
  };

  // ── Accès à l'état ───────────────────────────────────────────
  /**
   * @description Retourne une référence directe à l'état global du joueur. Ne fait
   *              aucune copie — tout appelant obtient l'objet mutable réel.
   * @returns {PlayerState} L'état global `G`.
   */
  function getState() { return G; }

  /**
   * @description Fixe le village d'origine du joueur pour toute la partie et passe le
   *              statut de jeu à "playing". Appelée une seule fois, au moment de la
   *              confirmation de l'écran de sélection (voir ui-village.js → confirmVillage()).
   *
   * @param {string} villageShort - Nom court du village (VILLAGES[i].short, ex: "Konoha")
   *
   * @returns {boolean} true si le village existe et a été appliqué, false si `villageShort`
   *                     ne correspond à aucune entrée de VILLAGES (état non modifié)
   *
   * @sideEffects
   *   Modifie G.village et G.status
   */
  function setVillage(villageShort) {
    const v = VILLAGES.find(x => x.short === villageShort);
    if (!v) return false;
    G.village = v;
    G.status  = "playing";
    return true;
  }

  /**
   * @description Calcule la liste des personnages jouables tirables sur la roue
   *              "Personnage" pour le village du joueur. Filtre `canBeGenin:true`
   *              uniquement — les personnages qui n'ont jamais été Genin dans le lore
   *              (déjà Kage/chef de village) sont exclus, puisque ce tirage n'a lieu
   *              qu'au tout début de la partie.
   *
   * @returns {string[]} Noms des personnages tirables. Si aucun starter n'est défini
   *                     pour ce village, retourne un pool de noms génériques de repli.
   */
  function getStarters() {
    const v = G.round.results.village;
    if (!v) return ["Ninja inconnu","Ninja errant","Kunoichi"];
    const all = STARTERS[v] || [];
    const filtered = all.filter(s => s.canBeGenin);
    return filtered.length
      ? filtered.map(s => s.name)
      : ["Ninja inconnu","Ninja errant","Héritier"];
  }

  /**
   * @description Retrouve le style de combat associé à un personnage donné, pour le
   *              village du joueur. Appelée juste après le tirage de la roue
   *              "Personnage" pour fixer le style persistant du joueur (voir
   *              ui-round.js → spinCurrent(), setPerso()).
   *
   * @param {string} name - Nom du personnage (tel que retourné par getStarters())
   *
   * @returns {string} Style de combat : "ninjutsu" | "taijutsu" | "genjutsu".
   *                   Retourne "ninjutsu" par défaut si le personnage est introuvable
   *                   ou si aucun village n'est encore fixé.
   */
  function getPersoStyle(name) {
    const v = G.round.results.village;
    if (!v) return "ninjutsu";
    const all = STARTERS[v] || [];
    const found = all.find(s => s.name === name);
    return found ? found.style : "ninjutsu";
  }

  /**
   * @description Retourne le pool d'antagonistes tirables sur la roue "Antagoniste"
   *              pour le rang actuel du joueur. Aux rangs Genin et Chûnin, ANTAGONISTS
   *              est indexé une seconde fois par le village d'origine du joueur (des
   *              rivalités de village crédibles) ; aux rangs Jônin et Kage, la liste est
   *              unique et partagée par tous les villages (menace mondiale — voir
   *              data.js → ANTAGONISTS).
   *
   * @returns {AntagonistData[]} Liste des ennemis du rang (et village) courant. Repli
   *                             sur un ennemi générique si aucune entrée ne correspond.
   */
  function getAntags() {
    const rank = RANKS[G.rankIdx];
    const pool = ANTAGONISTS[rank.name];
    const fallback = [{ name:"Ennemi inconnu", weakness:"taijutsu", resistance:"ninjutsu" }];
    if (!pool) return fallback;
    if (Array.isArray(pool)) return pool.length ? pool : fallback;
    const village = G.village ? G.village.short : null;
    const list = (village && pool[village]) || [];
    return list.length ? list : fallback;
  }

  /**
   * @description Retrouve l'objet antagoniste complet (avec weakness/resistance) à
   *              partir de son nom, pour le rang (et éventuellement le village) courant
   *              du joueur. Utilisé pour calculer le matchup de styles
   *              (computeIssueWeights()) et l'affichage du récapitulatif (ui-recap.js).
   *
   * @param {string} name - Nom de l'antagoniste (tel que retourné par getAntags())
   *
   * @returns {AntagonistData} L'antagoniste trouvé, ou un objet de repli
   *                           `{ name, weakness:"taijutsu", resistance:"ninjutsu" }`
   *                           si `name` ne correspond à aucune entrée du pool courant.
   */
  function getAntagData(name) {
    const list = getAntags();
    return list.find(a => a.name === name) || { name, weakness:"taijutsu", resistance:"ninjutsu" };
  }

  /**
   * @description Résout le portrait d'un personnage pour un rang donné, à partir de
   *              CHARACTER_PORTRAITS (voir data.js). Une entrée `{young, adult}` bascule
   *              sur `young` aux rangs Genin/Chûnin et `adult` aux rangs Jônin/Kage ;
   *              une entrée simple (chaîne) s'applique à tous les rangs.
   *
   * @param {string} name    - Nom du personnage
   * @param {number} rankIdx - Index de rang (0=Genin … 3=Kage), voir RANKS
   *
   * @returns {?string} Chemin de l'image, ou null si `name` n'a pas d'entrée dans
   *                     CHARACTER_PORTRAITS
   */
  function _resolvePortrait(name, rankIdx) {
    const entry = CHARACTER_PORTRAITS[name];
    if (!entry) return null;
    if (typeof entry === "string") return entry;
    return (rankIdx <= 1 ? entry.young : entry.adult) || entry.young || entry.adult || null;
  }

  /**
   * @description Résout le portrait d'un personnage au rang courant du joueur (voir
   *              _resolvePortrait()). Utilisée pour le personnage joué (toujours
   *              recalculée — évolue avec la progression de rang, voir ui-hud.js →
   *              updatePersoPortrait()) et l'antagoniste en cours de round (voir
   *              ui-recap.js → updateAntagPortrait()). Pour un portrait figé qui ne doit
   *              plus évoluer une fois le combat passé, voir G.antagHistory[name].portrait
   *              (fixé une seule fois par applyOutcome()).
   *
   * @param {?string} name - Nom du personnage, ou falsy
   *
   * @returns {?string} Chemin de l'image, ou null si `name` est vide ou sans portrait
   */
  function getPortrait(name) {
    if (!name) return null;
    return _resolvePortrait(name, G.rankIdx);
  }

  /**
   * @description Calcule les poids réels de la roue de combat ("Issue") pour le round
   *              courant, à partir des poids de base (Victoire=50, Nul=25, Défaite=25) :
   *              - Triangle de styles : le joueur bat l'ennemi (son style == weakness
   *                ennemi) → Victoire x1.4 / Défaite x0.6 ; l'ennemi résiste (son style ==
   *                resistance ennemi) → Victoire x0.6 / Défaite x1.4.
   *              - Inventaire : chaque objet dont le type correspond au style du joueur
   *                ajoute +8 à Victoire ; chaque arme ajoute +5 à Victoire ; un objet
   *                "boost_issue" activé manuellement par le joueur (item.armed === true)
   *                ajoute +25 à Victoire — consommé après ce combat, quel qu'en soit le
   *                résultat (voir applyOutcome()).
   *
   * @returns {Object[]} Copie des 3 entrées d'OUTCOMES enrichies d'un champ `weight`
   *                     (Victoire, Match nul, Défaite dans cet ordre)
   */
  function computeIssueWeights() {
    const persoName = G.round.results.perso;
    const antagName = G.round.results.antag;
    const playerStyle = persoName ? getPersoStyle(persoName) : "ninjutsu";
    const antagData   = antagName ? getAntagData(antagName) : null;

    let wVictoire = 50, wNul = 25, wDefaite = 25;

    if (antagData) {
      // Avantage style
      if (playerStyle === antagData.weakness) {
        // Le joueur bat l'ennemi → victoire plus probable
        wVictoire = Math.round(wVictoire * 1.4);
        wDefaite  = Math.round(wDefaite  * 0.6);
      } else if (playerStyle === antagData.resistance) {
        // L'ennemi résiste → défaite plus probable
        wVictoire = Math.round(wVictoire * 0.6);
        wDefaite  = Math.round(wDefaite  * 1.4);
      }
    }

    // Bonus inventaire
    G.inventory.forEach(item => {
      if (item.type === playerStyle) wVictoire += 8; // tech du bon type
      if (item.type === "weapon")    wVictoire += 5; // arme générique
    });

    // Boost à activation manuelle (voir isManualUseItem()) — gros bonus ponctuel
    if (G.inventory.some(it => it.effect === "boost_issue" && it.armed === true)) {
      wVictoire += 25;
    }

    return [
      { ...OUTCOMES[0], weight: wVictoire },
      { ...OUTCOMES[1], weight: wNul      },
      { ...OUTCOMES[2], weight: wDefaite  },
    ];
  }

  /**
   * @description Enregistre le résultat d'un spin de roue dans G.round.results, sous
   *              la clé fournie. Utilisée pour tous les types de roue (perso, antag,
   *              outcome, loot, examen…) — voir ui-round.js → spinCurrent().
   *
   * @param {string} key   - Clé sous laquelle stocker la valeur (ex: "perso", "antag")
   * @param {*}      value - Valeur du résultat tiré
   *
   * @sideEffects
   *   Modifie G.round.results[key]
   */
  function setResult(key, value) {
    G.round.results[key] = value;
  }

  /**
   * @description Applique le résultat de la roue de combat : consomme automatiquement
   *              un talisman "chance" armé pour annuler une défaite, sinon décrémente
   *              une vie (puis consomme un soin disponible pour la récupérer aussitôt),
   *              enregistre le résultat dans l'historique de l'antagoniste (voir
   *              G.antagHistory), détecte le game over, ajoute un badge en cas de
   *              victoire/nul et incrémente le compteur de victoires, puis passe la
   *              phase à "loot".
   *
   * @param {number} outcomeIdx - Index dans OUTCOMES du résultat tiré (0=Victoire,
   *                              1=Match nul, 2=Défaite)
   *
   * @returns {Object} result
   * @returns {boolean} result.usedChance - true si un talisman "chance" a annulé la défaite
   * @returns {boolean} result.usedHeal   - true si un soin a été consommé automatiquement
   * @returns {number}  result.lifeChange - Variation nette de vies appliquée (0 ou -1)
   * @returns {boolean} result.examReady  - true si l'examen de passage est accessible
   *                                        (false si game over)
   * @returns {boolean} result.gameOver   - true si les vies sont tombées à 0
   *
   * @sideEffects
   *   Modifie G.inventory (retire le talisman/soin utilisé, et le boost "boost_issue"
   *   s'il était activé), G.lives, G.status (si game over), G.antagHistory (incrémente
   *   win/draw/loss de l'antagoniste, fige son portrait à la première rencontre),
   *   G.badges (ajoute un badge si victoire/nul), G.wins, G.examReady, G.phase (passe à
   *   "loot" si la partie continue)
   */
  function applyOutcome(outcomeIdx) {
    const outcome = OUTCOMES[outcomeIdx];
    let usedChance = false, usedHeal = false, lifeChange = 0;

    if (outcome.life < 0) {
      const chanceIdx = G.inventory.findIndex(it => it.effect === "chance" && it.armed !== false);
      if (chanceIdx !== -1) {
        G.inventory.splice(chanceIdx, 1);
        usedChance = true;
      } else {
        G.lives = Math.max(0, G.lives - 1);
        lifeChange = -1;
        const healIdx = G.inventory.findIndex(it => it.effect === "heal");
        if (healIdx !== -1) {
          G.inventory.splice(healIdx, 1);
          G.lives = Math.min(G.livesMax, G.lives + 1);
          usedHeal = true;
          lifeChange = 0;
        }
      }
    }

    // Le boost à activation manuelle est consommé après ce combat, qu'il soit gagné
    // ou perdu (voir computeIssueWeights(), isManualUseItem()).
    const issueBoostIdx = G.inventory.findIndex(it => it.effect === "boost_issue" && it.armed === true);
    if (issueBoostIdx !== -1) G.inventory.splice(issueBoostIdx, 1);

    // Historique cumulé (victoires/nuls/défaites) par antagoniste, tous rounds confondus.
    // Le portrait est figé à la première rencontre — il ne change plus jamais ensuite,
    // même si le rang du joueur progresse par la suite (voir CHARACTER_PORTRAITS).
    const antagName = G.round.results.antag;
    if (antagName) {
      if (!G.antagHistory[antagName]) {
        G.antagHistory[antagName] = { win: 0, draw: 0, loss: 0, portrait: _resolvePortrait(antagName, G.rankIdx) };
      }
      const rec = G.antagHistory[antagName];
      if (outcomeIdx === 0) rec.win++;
      else if (outcomeIdx === 1) rec.draw++;
      else rec.loss++;
    }

    const gameOver = G.lives <= 0;
    if (gameOver) { G.status = "gameover"; return { usedChance, usedHeal, lifeChange, examReady: false, gameOver }; }

    // Badge si victoire ou nul
    if (outcome.xp > 0) {
      G.badges.push({
        antag:        G.round.results.antag,
        outcomeShort: outcome.short,
        outcomeCls:   outcome.cls,
        emoji:        outcome.emoji,
        portrait:     antagName ? G.antagHistory[antagName].portrait : null,
      });
      // Compteur de victoires pour déclencher l'examen
      G.wins++;
    }

    // L'examen se déclenche après 1 victoire (win > 0 suffit)
    // On ne passe à l'examen qu'après le loot
    G.examReady = G.wins > 0;
    G.phase = "loot";

    return { usedChance, usedHeal, lifeChange, examReady: G.examReady, gameOver: false };
  }

  /**
   * @description Calcule les poids réels de la roue d'examen de passage de rang, à
   *              partir de poids de base qui durcissent à chaque rang
   *              (Genin→Chûnin : 60/40, Chûnin→Jônin : 45/55, Jônin→Kage : 35/65),
   *              puis ajoute un bonus de réussite selon l'inventaire : +20 par talisman
   *              "chance", +6 par technique (ninjutsu/taijutsu/genjutsu, quel que soit
   *              le style), +4 par arme (les soins n'apportent aucun bonus), et +30 si un
   *              objet "boost_examen" a été activé manuellement par le joueur
   *              (item.armed === true) — consommé après cet examen, quel qu'en soit le
   *              résultat (voir applyExamen()).
   *
   * @returns {Object[]} Deux entrées `{ short, emoji, wheelColor, weight }` — Réussite
   *                     puis Échec, dans cet ordre (index 0 = Réussite, cohérent avec
   *                     EXAMEN_OUTCOMES)
   */
  function computeExamenWeights() {
    const basePoids = [
      [60, 40],  // Genin → Chûnin
      [45, 55],  // Chûnin → Jônin
      [35, 65],  // Jônin → Kage
    ];
    const [bR, bE] = basePoids[Math.min(G.rankIdx, 2)] || [50, 50];
    let wReussite = bR, wEchec = bE;

    G.inventory.forEach(item => {
      if (item.effect === "chance")  wReussite += 20;
      else if (item.type === "ninjutsu" || item.type === "taijutsu" || item.type === "genjutsu") wReussite += 6;
      else if (item.type === "weapon")  wReussite += 4;
    });

    // Boost à activation manuelle (voir isManualUseItem()) — gros bonus ponctuel
    if (G.inventory.some(it => it.effect === "boost_examen" && it.armed === true)) {
      wReussite += 30;
    }

    return [
      { short:"Réussite", emoji:"✅", wheelColor:"#059669", weight: wReussite },
      { short:"Échec",    emoji:"❌", wheelColor:"#7F1D1D", weight: wEchec   },
    ];
  }

  /**
   * @description Applique le résultat de la roue d'examen. En cas d'échec, remet la
   *              phase à "combat" sans pénalité (G.wins n'est pas réinitialisé — l'examen
   *              reste accessible dès le prochain combat gagné). En cas de réussite,
   *              remet G.wins à 0, avance G.rankIdx d'un cran, et déclare la victoire si
   *              le rang Kage est atteint. Dans tous les cas, consomme le boost
   *              "boost_examen" s'il avait été activé (voir computeExamenWeights()).
   *
   * @param {number} resultIdx - Index dans EXAMEN_OUTCOMES du résultat tiré
   *                             (0 = Réussite, 1 = Échec)
   *
   * @returns {Object} result
   * @returns {boolean} result.passed  - true si l'examen est réussi
   * @returns {boolean} result.rankUp  - true si le rang a été incrémenté (= passed)
   * @returns {boolean} result.victory - true si le joueur vient d'atteindre le rang Kage
   *
   * @sideEffects
   *   Modifie G.inventory (retire le boost "boost_examen" s'il était activé), G.phase,
   *   G.examReady toujours ; en cas de réussite modifie aussi G.wins, G.rankIdx et
   *   G.status (passe à "victory" si rang Kage atteint)
   */
  function applyExamen(resultIdx) {
    const passed = resultIdx === 0; // index 0 = Réussite

    const examBoostIdx = G.inventory.findIndex(it => it.effect === "boost_examen" && it.armed === true);
    if (examBoostIdx !== -1) G.inventory.splice(examBoostIdx, 1);

    if (!passed) {
      // Échec : pas de perte de vie, on repart en combat
      G.phase     = "combat";
      G.examReady = false;
      // On ne réinitialise PAS G.wins — l'examen reste accessible après le prochain combat
      return { passed: false, rankUp: false, victory: false };
    }

    // Réussite : promotion
    G.wins    = 0;
    G.rankIdx = Math.min(G.rankIdx + 1, RANKS.length - 1);
    G.phase   = "combat";
    G.examReady = false;

    const victory = G.rankIdx >= RANKS.length - 1;
    if (victory) G.status = "victory";

    return { passed: true, rankUp: true, victory };
  }

  /**
   * @description Fixe le personnage joué et son style de combat pour le reste de la
   *              partie (jusqu'au game over ou à la victoire), et les injecte aussi dans
   *              les résultats du round courant.
   *
   * @param {string} name  - Nom du personnage (tel que tiré sur la roue "Personnage")
   * @param {string} style - Style de combat : "ninjutsu" | "taijutsu" | "genjutsu"
   *
   * @sideEffects
   *   Modifie G.perso, G.persoStyle, G.round.results.perso, G.round.results.persoStyle
   */
  function setPerso(name, style) {
    G.perso      = name;
    G.persoStyle = style;
    // On l'injecte aussi dans les résultats du round courant
    G.round.results.perso      = name;
    G.round.results.persoStyle = style;
  }

  /**
   * @description Ajoute un objet de loot à l'inventaire du joueur. Cas particulier : si
   *              l'objet est un soin ("heal") et que le joueur a déjà toutes ses vies, il
   *              n'est pas stocké — il augmente à la place le plafond de vies (livesMax,
   *              plafonné à 5) et restaure immédiatement le joueur à ce nouveau plafond.
   *              Les talismans "chance" sont armés par défaut (déclenchement automatique
   *              à la prochaine défaite) ; le joueur peut les désarmer depuis l'inventaire
   *              (voir toggleItemArmed()). À l'inverse, les objets "boost_issue"/
   *              "boost_examen" (voir isManualUseItem()) sont désarmés par défaut : ils
   *              n'ont aucun effet tant que le joueur ne les active pas lui-même.
   *
   * @param {Object} item - Objet de loot tiré (voir data.js → LootItemData)
   *
   * @returns {Object} result
   * @returns {boolean} result.absorbed - true si l'objet a été converti en vie bonus
   *                                      plutôt que stocké
   * @returns {string} [result.message]  - Message à afficher si absorbed est true
   *
   * @sideEffects
   *   Modifie G.livesMax et G.lives (cas absorbed), ou G.inventory (cas normal)
   */
  function addLoot(item) {
    // Item soin : si déjà 3 vies → +1 vie supplémentaire (bonus temporaire)
    if (item.effect === "heal" && G.lives >= G.livesMax) {
      G.livesMax = Math.min(G.livesMax + 1, 5); // plafonné à 5
      G.lives    = G.livesMax;
      return { absorbed: true, message: "Vie bonus ! Tu as maintenant " + G.lives + " vies." };
    }
    let armed;
    if (item.effect === "chance") armed = true;               // protection active par défaut
    else if (isManualUseItem(item)) armed = false;             // inerte tant que non activé
    G.inventory.push({ ...item, armed });
    return { absorbed: false };
  }

  /**
   * @description Consomme immédiatement un objet de soin de l'inventaire, avant même
   *              qu'une défaite ne survienne (déclenché depuis la popup d'utilisation
   *              d'objet, voir ui-inventory.js → openItemUsePopup()).
   *
   * @param {number} idx - Index de l'objet dans G.inventory
   *
   * @returns {Object} result
   * @returns {boolean} result.ok     - true si le soin a été appliqué
   * @returns {string} [result.reason] - Raison de l'échec si ok est false :
   *                                    "invalid" (index hors limites ou objet non-soin),
   *                                    "full" (vies déjà au maximum, rien à soigner)
   *
   * @sideEffects
   *   Si ok:true, retire l'objet de G.inventory et incrémente G.lives (plafonné à G.livesMax)
   */
  function useHealNow(idx) {
    const it = G.inventory[idx];
    if (!it || it.effect !== "heal") return { ok: false, reason: "invalid" };
    if (G.lives >= G.livesMax) return { ok: false, reason: "full" };
    G.inventory.splice(idx, 1);
    G.lives = Math.min(G.livesMax, G.lives + 1);
    return { ok: true };
  }

  /**
   * @description Inverse l'état armé/désarmé d'un objet à drapeau `armed` : talisman
   *              "chance" (désarmé, il reste dans l'inventaire — garde son bonus de
   *              poids à l'examen — mais ne s'active plus automatiquement pour annuler
   *              une défaite), ou objet à activation manuelle "boost_issue"/
   *              "boost_examen" (armé, il s'applique au prochain combat/examen puis est
   *              consommé — voir computeIssueWeights(), computeExamenWeights(),
   *              applyOutcome(), applyExamen()).
   *
   * @param {number} idx - Index de l'objet dans G.inventory
   *
   * @returns {?boolean} Le nouvel état `armed` de l'objet, ou null si l'objet à cet
   *                     index n'existe pas ou n'a pas de drapeau `armed` (état non
   *                     modifié dans ce cas)
   *
   * @sideEffects
   *   Modifie G.inventory[idx].armed
   */
  function toggleItemArmed(idx) {
    const it = G.inventory[idx];
    if (!it || it.armed === undefined) return null;
    it.armed = it.armed === false ? true : false;
    return it.armed;
  }

  /**
   * @description Détermine si un objet requiert une activation manuelle du joueur pour
   *              produire son effet (contrairement aux soins/talismans "chance", qui
   *              agissent automatiquement). Utilisée pour afficher le symbole "à
   *              activer" dans la barre d'inventaire (voir ui-inventory.js) et pour
   *              déclencher la popup tutoriel à la première obtention d'un tel objet
   *              (voir markManualUseTutorialSeen()).
   *
   * @param {?Object} item - Objet de loot ou d'inventaire, ou falsy
   *
   * @returns {boolean} true si `item.effect` est "boost_issue" ou "boost_examen"
   */
  function isManualUseItem(item) {
    return !!item && (item.effect === "boost_issue" || item.effect === "boost_examen");
  }

  /**
   * @description Marque comme vue la popup tutoriel expliquant les objets à activation
   *              manuelle obligatoire. Appelée une seule fois, quand le joueur ferme
   *              cette popup (voir ui-inventory.js → closeManualUseTutorial()) ; elle ne
   *              s'affiche alors plus jamais pour le reste de la partie.
   *
   * @sideEffects
   *   Modifie G.seenManualUseTutorial
   */
  function markManualUseTutorialSeen() {
    G.seenManualUseTutorial = true;
  }

  /**
   * @description Construit un pool d'objets distincts pour la roue "Butin", tiré depuis
   *              LOOT_POOL avec un tirage pondéré par rareté (voir RARITY_WEIGHTS) après
   *              mélange initial. Retente jusqu'à 200 fois pour obtenir `size` objets
   *              uniques ; si le pool reste trop court (<4), le complète en piochant les
   *              objets restants de LOOT_POOL dans l'ordre.
   *
   * @param {number} [size=8] - Nombre d'objets à inclure dans le pool
   *
   * @returns {Object[]} Sous-ensemble de LOOT_POOL, de longueur `size` au maximum
   *                     (peut être plus court si LOOT_POOL contient moins d'objets)
   */
  function buildLootPool(size = 8) {
    // Pondéré par rareté
    const pool = [];
    const candidates = [...LOOT_POOL];

    // Shuffle
    for (let i = candidates.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
    }

    // Tirage avec poids rareté jusqu'à 'size' items uniques
    const total = candidates.reduce((s, it) => s + RARITY_WEIGHTS[it.rarity], 0);
    const used  = new Set();

    let tries = 0;
    while (pool.length < size && tries < 200) {
      tries++;
      let r = Math.random() * total;
      for (const item of candidates) {
        r -= RARITY_WEIGHTS[item.rarity];
        if (r <= 0 && !used.has(item.id)) {
          pool.push(item);
          used.add(item.id);
          break;
        }
      }
    }

    // Fallback si pool trop court
    if (pool.length < 4) {
      for (const item of LOOT_POOL) {
        if (!used.has(item.id)) { pool.push(item); used.add(item.id); }
        if (pool.length >= size) break;
      }
    }

    return pool.slice(0, size);
  }

  /**
   * @description Démarre un nouveau round : réinitialise G.round (step, results,
   *              spinning). Conserve le personnage, son style, l'inventaire et les vies,
   *              qui persistent entre les rounds jusqu'au game over ou à la victoire.
   *              L'examen ne se déclenchera qu'après au moins une victoire en combat
   *              dans ce round ou un précédent (voir applyOutcome()).
   *
   * @sideEffects
   *   Modifie G.round
   */
  function newRound() {
    // On conserve le village dans les résultats ; le perso est persistant
    G.round = {
      step: 0,
      results: {
        village:    G.village ? G.village.short : null,
        perso:      G.perso,
        persoStyle: G.persoStyle,
      },
      spinning: false,
    };
    // L'examen ne se déclenche qu'après 1 victoire combat dans le rang courant
    // (géré par applyOutcome → examReady)
  }

  /**
   * @description Réinitialise entièrement l'état de la partie à ses valeurs par défaut
   *              (comme au premier chargement). Appelée en sortie de game over, de
   *              victoire, ou lors d'un redémarrage manuel (confirmRestart() dans
   *              index.html).
   *
   * @sideEffects
   *   Remet à zéro tous les champs de G (village, round, lives, livesMax,
   *   rankIdx, wins, perso, persoStyle, inventory, badges, antagHistory,
   *   seenManualUseTutorial, phase, examReady, status)
   */
  function fullReset() {
    G.village      = null;
    G.round        = { step: 0, results: {}, spinning: false };
    G.lives        = 3;
    G.livesMax     = 3;
    G.rankIdx      = 0;
    G.wins         = 0;
    G.perso        = null;
    G.persoStyle   = null;
    G.inventory    = [];
    G.badges       = [];
    G.antagHistory = {};
    G.seenManualUseTutorial = false;
    G.phase        = "combat";
    G.examReady    = false;
    G.status       = "village_select";
  }

  /**
   * @description Retourne le rang actuel du joueur.
   * @returns {RankData} L'entrée de RANKS à l'index G.rankIdx
   */
  function currentRank() { return RANKS[G.rankIdx]; }

  /**
   * @description Retourne le rang suivant, s'il existe.
   * @returns {?RankData} L'entrée de RANKS suivant le rang courant, ou null si le
   *                      joueur est déjà Kage (dernier rang)
   */
  function nextRank()    { return RANKS[G.rankIdx + 1] || null; }

  /**
   * @description Calcule la progression du joueur vers le prochain examen, en
   *              pourcentage, pour l'affichage de la barre de progression du HUD.
   * @returns {number} Pourcentage entre 0 et 100 (G.wins / WINS_PER_RANK * 100, plafonné à 100)
   */
  function rankPct()     { return Math.min(G.wins / WINS_PER_RANK * 100, 100); }

  return {
    getState, setVillage, getStarters, getPersoStyle, getAntags, getAntagData,
    getPortrait, computeIssueWeights, computeExamenWeights,
    setResult, setPerso, applyOutcome, applyExamen, addLoot, buildLootPool,
    useHealNow, toggleItemArmed, isManualUseItem, markManualUseTutorialSeen,
    newRound, fullReset, currentRank, nextRank, rankPct,
  };
})();
