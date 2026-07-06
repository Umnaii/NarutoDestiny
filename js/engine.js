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
 *     applyOutcome, applyExamen, addLoot, buildLootPool, useHealNow,
 *     useSkipFight, toggleItemArmed, isManualUseItem, markManualUseTutorialSeen,
 *     newRound, fullReset, currentRank, nextRank, rankPct,
 *     enterKageDefense, recordKageWave, recordRun, getScoreboard,
 *     saveGame, hasSaveGame, loadGame, deleteSaveGame
 *
 * @sideEffects
 *   - Toutes les fonctions ci-dessus (hors getState/currentRank/nextRank/rankPct/
 *     hasSaveGame, qui sont des lectures pures) modifient l'objet d'état interne `G`.
 *   - saveGame()/loadGame()/deleteSaveGame() et recordRun() lisent/écrivent aussi
 *     localStorage (voir section SAUVEGARDE ci-dessous).
 *
 * SÉCURITÉ : aucune donnée utilisateur identifiable, aucune requête réseau, aucune base
 *            de données. Seule persistance : l'état de partie et le classement de
 *            session, stockés en clair dans localStorage (clés "ndw_save_v1" et
 *            "ndw_scoreboard_v1", voir saveGame()/getScoreboard()) — uniquement sur la
 *            machine du joueur, jamais transmis nulle part.
 */

const Engine = (() => {

  // ── SAUVEGARDE (localStorage) ──────────────────────────────────
  // Seul mécanisme de persistance de ce jeu : ni backend, ni compte, ni base de
  // données — juste localStorage sur la machine du joueur. Le nom de chaque clé inclut
  // une version ("v1") pour pouvoir ignorer proprement une sauvegarde d'un format
  // devenu incompatible après une évolution du jeu, plutôt que de planter au chargement.
  const SAVE_KEY       = "ndw_save_v1";
  const SCOREBOARD_KEY = "ndw_scoreboard_v1";

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
   * @property {number}  wins            - Victoires NETTES en combat depuis la dernière promotion (un match nul ne compte pas — statu quo) ; déclenche l'examen dès que > 0. Valeur initiale : 0. @type {number}
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
   * @property {string}  status          - Statut global de la partie : "village_select" | "playing" | "gameover" | "victory" | "kage_defense". Valeur initiale : "village_select". @type {string}
   * @property {boolean} seenManualUseTutorial - true dès que le joueur a fermé la popup
   *                     tutoriel expliquant les objets à activation manuelle obligatoire
   *                     (voir isManualUseItem(), markManualUseTutorialSeen()) ; ne
   *                     s'affiche alors plus jamais pour le reste de la partie, même si
   *                     un autre objet du même genre est ensuite obtenu. Valeur initiale :
   *                     false. @type {boolean}
   * @property {boolean} kageDefense     - true une fois le rang Kage atteint : la partie
   *                     ne s'arrête plus, le village doit être défendu indéfiniment
   *                     (voir enterKageDefense()). Valeur initiale : false. @type {boolean}
   * @property {number}  kageDefenseKills - Nombre de vagues d'ennemis repoussées depuis
   *                     l'entrée en mode défense de Kage — sert de score pour le
   *                     classement (voir recordRun(), SCOREBOARD). Valeur initiale : 0.
   *                     @type {number}
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

    kageDefense: false,      // true une fois le rang Kage atteint (voir enterKageDefense())
    kageDefenseKills: 0,     // vagues d'ennemis repoussées en mode défense de Kage

    status: "village_select",
  };

  // ── CLASSEMENT (persisté dans localStorage — survit aux rechargements de page) ──
  // Hors de G volontairement : fullReset() ne doit PAS l'effacer, pour permettre de
  // comparer plusieurs parties d'affilée (voir recordRun(), getScoreboard()). Chargé une
  // fois au démarrage du module, puis réécrit en entier à chaque partie terminée (voir
  // recordRun() → _persistScoreboard()).
  const SCOREBOARD = _loadScoreboard();

  /**
   * @description Charge le classement persisté depuis localStorage, au démarrage du
   *              module. Repli silencieux sur un classement vide si localStorage est
   *              indisponible (navigation privée, quota…) ou si son contenu est corrompu.
   * @returns {Object[]} Le classement chargé, ou [] en cas d'échec
   */
  function _loadScoreboard() {
    try {
      const raw = localStorage.getItem(SCOREBOARD_KEY);
      const parsed = raw ? JSON.parse(raw) : null;
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      return [];
    }
  }

  /**
   * @description Réécrit l'intégralité du classement dans localStorage. Appelée à la
   *              fin de recordRun(), après chaque partie terminée.
   * @sideEffects
   *   Écrit dans localStorage sous la clé SCOREBOARD_KEY. Échoue silencieusement si
   *   localStorage est indisponible.
   */
  function _persistScoreboard() {
    try { localStorage.setItem(SCOREBOARD_KEY, JSON.stringify(SCOREBOARD)); } catch (e) {}
  }

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
   *              G.antagHistory) et journalise le combat dans G.badges (victoire, nul, OU
   *              défaite — voir ui-recap.js → updateCollection()), détecte le game over,
   *              incrémente le compteur de victoires (uniquement victoire/nul), puis
   *              passe la phase à "loot".
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
   *   G.badges (ajoute un badge pour ce combat, quel qu'en soit le résultat), G.wins
   *   (uniquement sur une victoire nette — un match nul est un statu quo, il ne fait ni
   *   gagner ni perdre de terrain), G.examReady, G.phase (passe à "loot" si la partie continue)
   */
  function applyOutcome(outcomeIdx) {
    const outcome = OUTCOMES[outcomeIdx];
    let usedChance = false, usedHeal = false, lifeChange = 0;

    if (outcome.life < 0) {
      const chanceIdx = G.inventory.findIndex(it => it.effect === "chance" && it.armed !== false);
      if (chanceIdx !== -1) {
        _consumeOne(chanceIdx);
        usedChance = true;
      } else {
        G.lives = Math.max(0, G.lives - 1);
        lifeChange = -1;
        const healIdx = G.inventory.findIndex(it => it.effect === "heal");
        if (healIdx !== -1) {
          _consumeOne(healIdx);
          G.lives = Math.min(G.livesMax, G.lives + 1);
          usedHeal = true;
          lifeChange = 0;
        }
      }
    }

    // Le boost à activation manuelle est consommé après ce combat, qu'il soit gagné
    // ou perdu (voir computeIssueWeights(), isManualUseItem()).
    const issueBoostIdx = G.inventory.findIndex(it => it.effect === "boost_issue" && it.armed === true);
    if (issueBoostIdx !== -1) _consumeOne(issueBoostIdx);

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

    // Badge pour CHAQUE combat mené (victoire, nul, ou défaite) — le "Tableau des
    // victoires" (voir ui-recap.js → updateCollection()) journalise ainsi tout
    // l'historique de combat du joueur, pas seulement les victoires.
    G.badges.push({
      antag:        G.round.results.antag,
      outcomeShort: outcome.short,
      outcomeCls:   outcome.cls,
      emoji:        outcome.emoji,
      portrait:     antagName ? G.antagHistory[antagName].portrait : null,
    });

    const gameOver = G.lives <= 0;
    if (gameOver) { G.status = "gameover"; return { usedChance, usedHeal, lifeChange, examReady: false, gameOver }; }

    // Compteur de victoires pour déclencher l'examen — uniquement une victoire nette :
    // un match nul est un statu quo (ni gain ni perte de terrain), il ne compte pas.
    if (outcomeIdx === 0) G.wins++;

    // L'examen se déclenche après 1 victoire (win > 0 suffit)
    // On ne passe à l'examen qu'après le loot
    G.examReady = G.wins > 0;
    G.phase = "loot";

    return { usedChance, usedHeal, lifeChange, examReady: G.examReady, gameOver: false };
  }

  /**
   * @description Calcule les poids réels de la roue d'examen de passage de rang, à
   *              partir de poids de base qui durcissent à chaque rang (Genin→Chûnin :
   *              60/40, Chûnin→Jônin : 45/55, Jônin→Kage : 35/65 — chaque examen est donc
   *              plus dur que le précédent, dans cet ordre).
   *
   *              Ce poids de base est ensuite adouci par la progression du joueur DANS
   *              CE RANG : chaque victoire en combat avant de tenter l'examen (G.wins)
   *              rapproche un peu plus de la réussite garantie, jusqu'à 100% de chances
   *              une fois WINS_PER_RANK victoires (5) atteintes — même sans le moindre
   *              bonus d'inventaire. Concrètement : à 1 victoire, l'examen est un peu
   *              plus facile qu'au tout premier essai ; à chaque nouvel échec suivi d'une
   *              victoire supplémentaire, il redevient un peu plus facile ; à 5 victoires
   *              cumulées, la réussite est certaine.
   *
   *              S'ajoute enfin un bonus de réussite selon l'inventaire : +20 par
   *              talisman "chance", +6 par technique (ninjutsu/taijutsu/genjutsu, quel
   *              que soit le style), +4 par arme (les soins n'apportent aucun bonus), et
   *              +30 si un objet "boost_examen" a été activé manuellement par le joueur
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
    const [bR] = basePoids[Math.min(G.rankIdx, 2)] || [50, 50];

    // Progression vers la réussite garantie : WINS_PER_RANK (5) victoires cumulées
    // dans ce rang suffisent à elles seules, sans le moindre objet.
    const progress   = Math.min(G.wins, WINS_PER_RANK) / WINS_PER_RANK;
    let wReussite = bR + (100 - bR) * progress;
    let wEchec    = 100 - wReussite;

    G.inventory.forEach(item => {
      if (item.effect === "chance")  wReussite += 20 * (item.count || 1);
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
    if (examBoostIdx !== -1) _consumeOne(examBoostIdx);

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
   *              (voir toggleItemArmed()). Les objets "boost_issue"/"boost_examen"/
   *              "skip_fight" (voir isManualUseItem()) sont désarmés par défaut : ils
   *              n'ont aucun effet tant que le joueur ne les active pas lui-même.
   *
   *              Objets consommables (voir _isConsumableItem()) : un doublon augmente la
   *              quantité (`count`) de l'entrée déjà possédée au lieu d'ajouter une
   *              ligne séparée — ils peuvent donc être lootés plusieurs fois dans la même
   *              partie. Objets permanents ("bonus_xp_N") : buildLootPool() les retire du
   *              pool dès qu'ils sont possédés, donc ce cas ne devrait normalement plus se
   *              présenter une fois looté une première fois.
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

    if (_isConsumableItem(item)) {
      const existing = G.inventory.find(it => it.id === item.id);
      if (existing) {
        existing.count = (existing.count || 1) + 1;
        return { absorbed: false, stacked: true };
      }
    }

    let armed;
    if (item.effect === "chance") armed = true;               // protection active par défaut
    else if (isManualUseItem(item)) armed = false;             // inerte tant que non activé
    G.inventory.push({ ...item, armed, count: 1 });
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
    _consumeOne(idx);
    G.lives = Math.min(G.livesMax, G.lives + 1);
    return { ok: true };
  }

  /**
   * @description Consomme un objet "skip_fight" armé pour éviter entièrement le combat
   *              en cours (ni victoire, ni défaite, ni butin, ni entrée dans
   *              G.antagHistory) — déclenché depuis le bouton "Fuir" affiché sur l'étape
   *              Combat quand un tel objet est armé (voir ui-round.js → fleeCombat()).
   *
   * @returns {Object} result
   * @returns {boolean} result.ok - true si un objet "skip_fight" armé a été trouvé et
   *                                consommé
   *
   * @sideEffects
   *   Si ok:true, consomme l'objet (voir _consumeOne())
   */
  function useSkipFight() {
    const idx = G.inventory.findIndex(it => it.effect === "skip_fight" && it.armed === true);
    if (idx === -1) return { ok: false };
    _consumeOne(idx);
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
   * @returns {boolean} true si `item.effect` est "boost_issue", "boost_examen" ou
   *                    "skip_fight"
   */
  function isManualUseItem(item) {
    return !!item && (item.effect === "boost_issue" || item.effect === "boost_examen" || item.effect === "skip_fight");
  }

  /**
   * @description Détermine si un objet est consommable (soin, chance, boost, fuite) —
   *              ces objets peuvent être looté plusieurs fois dans la même partie, un
   *              doublon augmentant simplement la quantité de l'entrée existante (voir
   *              addLoot()). Les objets permanents ("bonus_xp_N" : armes/techniques) ne
   *              le sont pas — une fois possédés, buildLootPool() les retire du pool
   *              pour le reste de la partie.
   *
   * @param {?Object} item - Objet de loot ou d'inventaire, ou falsy
   *
   * @returns {boolean} true si l'objet est consommable
   */
  function _isConsumableItem(item) {
    if (!item) return false;
    return item.effect === "heal" || item.effect === "chance" || isManualUseItem(item);
  }

  /**
   * @description Consomme une unité d'un objet empilé (quantité `count`) : décrémente
   *              la quantité si elle est supérieure à 1, sinon retire l'entrée de
   *              l'inventaire. Centralise la logique partagée par tous les points de
   *              consommation (chance, soin, boost…).
   *
   * @param {number} idx - Index de l'objet dans G.inventory
   *
   * @sideEffects
   *   Modifie G.inventory[idx].count, ou retire G.inventory[idx]
   */
  function _consumeOne(idx) {
    const it = G.inventory[idx];
    if (!it) return;
    if ((it.count || 1) > 1) it.count -= 1;
    else G.inventory.splice(idx, 1);
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
   * @description Construit le pool d'objets distincts pour la roue "Butin" du round en
   *              cours, tiré depuis LOOT_POOL avec un tirage pondéré par rareté (voir
   *              RARITY_WEIGHTS) après mélange initial. Retente jusqu'à 200 fois pour
   *              obtenir `size` objets uniques ; si le pool reste trop court (<4), le
   *              complète en piochant les objets restants dans l'ordre. Les objets
   *              permanents ("bonus_xp_N") déjà possédés (voir _isConsumableItem()) sont
   *              exclus du pool — inutile de les looter à nouveau, ils disparaissent donc
   *              du butin possible pour le reste de la partie. Les objets consommables
   *              (soin, chance, boost, fuite) restent tirables même si le joueur en
   *              possède déjà (voir addLoot() pour l'empilement en quantité).
   *
   *              Le butin dépend de l'issue du combat de ce round (voir `guaranteed`) :
   *              une victoire nette garantit un objet ; un match nul ou une défaite
   *              (survécue grâce à un talisman/soin) ne laisse que 40% de chances d'en
   *              obtenir un — un objet fictif "Rien cette fois" est alors ajouté au pool,
   *              avec un poids calculé pour occuper exactement 60% de la roue (les objets
   *              réels se partagent les 40% restants, proportionnellement à leur rareté
   *              comme d'habitude).
   *
   * @param {number}  [size=8]          - Nombre d'objets réels à inclure dans le pool
   * @param {boolean} [guaranteed=true] - true si le combat de ce round est une victoire
   *                                      nette (butin garanti, pas de "Rien" sur la
   *                                      roue) ; false pour un match nul ou une défaite
   *                                      survécue (40% de chances seulement)
   *
   * @returns {Object[]} `size` objets réels (déjà possédés exclus) au maximum, plus
   *                     l'objet "Rien cette fois" en dernière position si `guaranteed`
   *                     est false
   */
  function buildLootPool(size = 8, guaranteed = true) {
    const ownedPermanentIds = new Set(
      G.inventory.filter(it => !_isConsumableItem(it)).map(it => it.id)
    );
    const available = LOOT_POOL.filter(it => !ownedPermanentIds.has(it.id));

    // Pondéré par rareté
    const pool = [];
    const candidates = [...available];

    // Shuffle
    for (let i = candidates.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
    }

    // Tirage avec poids rareté jusqu'à 'size' items uniques
    const total = candidates.reduce((s, it) => s + RARITY_WEIGHTS[it.rarity], 0) || 1;
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
      for (const item of available) {
        if (!used.has(item.id)) { pool.push(item); used.add(item.id); }
        if (pool.length >= size) break;
      }
    }

    const realPool = pool.slice(0, size);
    if (guaranteed) return realPool;

    const realTotal = realPool.reduce((s, it) => s + RARITY_WEIGHTS[it.rarity], 0) || 1;
    const nothing = {
      id: "nothing", name: "Rien cette fois", emoji: "💨", type: "none",
      rarity: "common", desc: "Cette fois, aucun butin.", effect: "none",
      forcedWeight: realTotal * 1.5, // 1.5T / (1.5T + T) = 60% (donc 40% de chances réelles)
    };
    return [...realPool, nothing];
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
   *              (comme au premier chargement). Appelée en sortie de game over ou lors
   *              d'un redémarrage manuel (confirmRestart() dans index.html). N'efface PAS
   *              SCOREBOARD, qui doit survivre à plusieurs parties d'affilée dans la même
   *              session (voir recordRun(), getScoreboard()).
   *
   * @sideEffects
   *   Remet à zéro tous les champs de G (village, round, lives, livesMax,
   *   rankIdx, wins, perso, persoStyle, inventory, badges, antagHistory,
   *   seenManualUseTutorial, kageDefense, kageDefenseKills, phase, examReady, status)
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
    G.kageDefense       = false;
    G.kageDefenseKills  = 0;
    G.phase        = "combat";
    G.examReady    = false;
    G.status       = "village_select";
  }

  /**
   * @description Fait entrer le joueur en mode "défense de Kage" : au lieu de terminer
   *              la partie, celle-ci continue indéfiniment — des ennemis sont envoyés en
   *              continu (voir ui-round.js → continueKageDefense()) jusqu'à ce que le
   *              joueur tombe à 0 vie (voir applyOutcome()). Appelée une seule fois,
   *              quand le joueur ferme l'overlay de victoire (voir ui-overlays.js →
   *              closeKage()).
   *
   * @sideEffects
   *   Modifie G.kageDefense, G.kageDefenseKills, G.status
   */
  function enterKageDefense() {
    G.kageDefense      = true;
    G.kageDefenseKills = 0;
    G.status           = "kage_defense";
  }

  /**
   * @description Incrémente le compteur de vagues repoussées en mode défense de Kage —
   *              sert de score pour le classement (voir recordRun(), getScoreboard()).
   *              Appelée à chaque vague survécue (voir ui-round.js → continueKageDefense()).
   *
   * @sideEffects
   *   Modifie G.kageDefenseKills
   */
  function recordKageWave() {
    G.kageDefenseKills++;
  }

  /**
   * @description Enregistre la partie en cours dans le classement (SCOREBOARD), avant
   *              qu'elle ne soit remise à zéro (voir fullReset()). Appelée en sortie de
   *              game over (voir ui-overlays.js → closeGameOver()), que le joueur ait ou
   *              non atteint le mode défense de Kage.
   *
   * @sideEffects
   *   Ajoute une entrée à SCOREBOARD (village, rang atteint, badges, vagues repoussées,
   *   horodatage) et la persiste dans localStorage (voir _persistScoreboard())
   */
  function recordRun() {
    SCOREBOARD.push({
      village:            G.village ? G.village.short : "?",
      rank:               currentRank().name,
      badges:             G.badges.length,
      kageDefenseKills:   G.kageDefenseKills,
      reachedKageDefense: G.kageDefense,
      endedAt:            Date.now(),
    });
    _persistScoreboard();
  }

  /**
   * @description Retourne une copie triée du classement des parties jouées dans cette
   *              session (voir recordRun()) — les parties les plus longues (le plus de
   *              vagues repoussées en mode défense de Kage) en premier, puis par rang
   *              atteint, puis par nombre de badges.
   *
   * @returns {Object[]} Copie de SCOREBOARD, triée du meilleur run au moins bon
   */
  function getScoreboard() {
    return [...SCOREBOARD].sort((a, b) =>
      b.kageDefenseKills - a.kageDefenseKills ||
      RANKS.findIndex(r => r.name === b.rank) - RANKS.findIndex(r => r.name === a.rank) ||
      b.badges - a.badges
    );
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

  /**
   * @description Sauvegarde l'intégralité de la partie en cours dans localStorage, pour
   *              permettre de la reprendre après avoir fermé/rechargé la page. Appelée
   *              par les fichiers ui/*.js uniquement à une limite "propre" de round —
   *              juste après que les roues d'un nouveau round (ou d'une nouvelle vague en
   *              mode défense de Kage) ont été (re)dessinées, jamais en cours de spin —
   *              pour ne jamais reprendre une partie au milieu d'un tirage en suspens.
   *
   * @sideEffects
   *   Écrit dans localStorage sous la clé SAVE_KEY. Échoue silencieusement si
   *   localStorage est indisponible (navigation privée, quota dépassé…) — la partie
   *   continue normalement en RAM, seule la sauvegarde est perdue.
   */
  function saveGame() {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify({ v: 1, state: G }));
    } catch (e) { /* stockage indisponible — silencieux */ }
  }

  /**
   * @description Indique si une sauvegarde valide est présente. Utilisée par
   *              ui-village.js pour afficher (ou masquer) le bouton "Reprendre la
   *              partie en cours" sur l'écran de sélection de village.
   *
   * @returns {boolean} true si une sauvegarde exploitable existe dans localStorage
   */
  function hasSaveGame() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return false;
      const parsed = JSON.parse(raw);
      return !!(parsed && parsed.v === 1 && parsed.state);
    } catch (e) {
      return false;
    }
  }

  /**
   * @description Recharge la partie sauvegardée : remplace tous les champs de l'état
   *              global `G` par ceux issus de la sauvegarde. Ne modifie rien si aucune
   *              sauvegarde valide n'est trouvée (format inconnu, entrée absente ou
   *              corrompue).
   *
   * @returns {boolean} true si une sauvegarde a été chargée avec succès
   *
   * @sideEffects
   *   Si le retour est true, remplace tous les champs de G par ceux de la sauvegarde
   */
  function loadGame() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return false;
      const parsed = JSON.parse(raw);
      if (!parsed || parsed.v !== 1 || !parsed.state) return false;
      Object.assign(G, parsed.state);
      return true;
    } catch (e) {
      return false;
    }
  }

  /**
   * @description Efface la sauvegarde de partie en cours, s'il y en a une. Appelée
   *              chaque fois qu'une partie se termine pour de bon (game over — voir
   *              ui-overlays.js → closeGameOver()) ou est abandonnée volontairement
   *              (voir index.html → confirmRestart()) : il n'y a alors plus rien à
   *              reprendre.
   *
   * @sideEffects
   *   Retire l'entrée SAVE_KEY de localStorage. Échoue silencieusement si localStorage
   *   est indisponible.
   */
  function deleteSaveGame() {
    try { localStorage.removeItem(SAVE_KEY); } catch (e) {}
  }

  return {
    getState, setVillage, getStarters, getPersoStyle, getAntags, getAntagData,
    getPortrait, computeIssueWeights, computeExamenWeights,
    setResult, setPerso, applyOutcome, applyExamen, addLoot, buildLootPool,
    useHealNow, useSkipFight, toggleItemArmed, isManualUseItem, markManualUseTutorialSeen,
    newRound, fullReset, currentRank, nextRank, rankPct,
    enterKageDefense, recordKageWave, recordRun, getScoreboard,
    saveGame, hasSaveGame, loadGame, deleteSaveGame,
  };
})();
