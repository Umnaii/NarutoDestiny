/* ============================================================
   NARUTO DESTINY WHEEL — engine.js
   Logique de jeu : état global, vies, rang, inventaire, loot.
   SÉCURITÉ : aucune donnée utilisateur. Pas de localStorage.
              Tout est en RAM — réinitialisé à chaque visite.
   ============================================================ */

const Engine = (() => {

  // ── État global ──────────────────────────────────────────────
  const G = {
    village:  null,   // fixé au départ
    periode:  null,   // tiré aléatoirement chaque round

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

    // Flux : "combat" → "loot" → "examen" → (réussite→rang suivant | échec→"combat")
    phase: "combat",  // "combat" | "loot" | "examen"
    examReady: false, // true quand assez de victoires pour déclencher l'examen

    status: "village_select",
  };

  // ── Accès à l'état ───────────────────────────────────────────
  function getState() { return G; }

  // ── Village choisi au départ ─────────────────────────────────
  // La période est tirée aléatoirement à chaque round selon le rang
  function setVillage(villageShort) {
    const v = VILLAGES.find(x => x.short === villageShort);
    if (!v) return false;
    G.village = v;
    G.status  = "playing";
    return true;
  }

  // Tire une période aléatoire cohérente avec le rang actuel
  // Genin/Chûnin → Classique ou Ère des Clans / Jônin → Shippuden / Kage → The Last ou Shippuden
  function _drawPeriode() {
    const byRank = {
      0: ["Classique", "Ère des Clans"],              // Genin
      1: ["Classique", "Shippuden"],                  // Chûnin
      2: ["Shippuden"],                               // Jônin
      3: ["Shippuden", "The Last"],                   // Kage
    };
    const pool = byRank[G.rankIdx] || ["Classique"];
    const shortName = pool[Math.floor(Math.random() * pool.length)];
    return PERIODES.find(p => p.short === shortName) || PERIODES[0];
  }

  // ── Starters pour le round courant ───────────────────────────
  // Filtre canBeGenin:true — les persos qui n'ont jamais été Genin sont exclus
  function getStarters() {
    const p = G.periode;
    const v = G.round.results.village;
    if (!p || !v) return ["Ninja inconnu","Ninja errant","Kunoichi"];
    const key = p.short + "-" + v;
    const all = STARTERS[key] || [];
    const filtered = all.filter(s => s.canBeGenin);
    return filtered.length
      ? filtered.map(s => s.name)
      : ["Ninja inconnu","Ninja errant","Héritier"];
  }

  // Récupère le style de combat du perso tiré
  function getPersoStyle(name) {
    const p = G.periode;
    const v = G.round.results.village;
    if (!p || !v) return "ninjutsu";
    const key = p.short + "-" + v;
    const all = STARTERS[key] || [];
    const found = all.find(s => s.name === name);
    return found ? found.style : "ninjutsu";
  }

  // ── Antagonistes selon le grade actuel du joueur ─────────────
  function getAntags() {
    const rank = RANKS[G.rankIdx];
    return (ANTAGONISTS[rank.name] || [{ name:"Ennemi inconnu", weakness:"taijutsu", resistance:"ninjutsu" }]);
  }

  // Récupère l'objet antagoniste complet (avec weakness/resistance)
  function getAntagData(name) {
    const rank = RANKS[G.rankIdx];
    const list = ANTAGONISTS[rank.name] || [];
    return list.find(a => a.name === name) || { name, weakness:"taijutsu", resistance:"ninjutsu" };
  }

  // ── Calcul des poids de la roue Issue ────────────────────────
  // Triangle : Ninjutsu > Taijutsu > Genjutsu > Ninjutsu (coefficient x1.4 / x0.6)
  // Items d'inventaire : chaque tech du bon type ajoute +8pts sur Victoire
  // Armes : +5pts sur Victoire
  // Poids de base : Victoire=50, Nul=25, Défaite=25
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

    return [
      { ...OUTCOMES[0], weight: wVictoire },
      { ...OUTCOMES[1], weight: wNul      },
      { ...OUTCOMES[2], weight: wDefaite  },
    ];
  }

  // ── Résultat d'un spin ───────────────────────────────────────
  function setResult(key, value) {
    G.round.results[key] = value;
  }

  // ── Appliquer le résultat du combat (Issue) ──────────────────
  // Retourne { usedChance, usedHeal, lifeChange, examReady, gameOver }
  function applyOutcome(outcomeIdx) {
    const outcome = OUTCOMES[outcomeIdx];
    let usedChance = false, usedHeal = false, lifeChange = 0;

    if (outcome.life < 0) {
      const chanceIdx = G.inventory.findIndex(it => it.effect === "chance");
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

    const gameOver = G.lives <= 0;
    if (gameOver) { G.status = "gameover"; return { usedChance, usedHeal, lifeChange, examReady: false, gameOver }; }

    // Badge si victoire ou nul
    if (outcome.xp > 0) {
      G.badges.push({
        antag:        G.round.results.antag,
        outcomeShort: outcome.short,
        outcomeCls:   outcome.cls,
        emoji:        outcome.emoji,
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

  // ── Calcul des poids de l'examen ─────────────────────────────
  // Poids de base selon le rang (plus dur à chaque rang)
  //   Genin→Chûnin : Réussite=60, Échec=40
  //   Chûnin→Jônin : Réussite=45, Échec=55
  //   Jônin→Kage   : Réussite=35, Échec=65
  // Bonus inventaire : chance +20, tech (n'importe) +6, arme +4, heal +0
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

    return [
      { short:"Réussite", emoji:"✅", wheelColor:"#059669", weight: wReussite },
      { short:"Échec",    emoji:"❌", wheelColor:"#7F1D1D", weight: wEchec   },
    ];
  }

  // ── Appliquer le résultat de l'examen ────────────────────────
  // Retourne { passed, rankUp, victory }
  function applyExamen(resultIdx) {
    const passed = resultIdx === 0; // index 0 = Réussite

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

  // ── Setter perso persistant ───────────────────────────────────
  function setPerso(name, style) {
    G.perso      = name;
    G.persoStyle = style;
    // On l'injecte aussi dans les résultats du round courant
    G.round.results.perso      = name;
    G.round.results.persoStyle = style;
  }

  // ── Ajouter un item loot à l'inventaire ──────────────────────
  function addLoot(item) {
    // Item soin : si déjà 3 vies → +1 vie supplémentaire (bonus temporaire)
    if (item.effect === "heal" && G.lives >= G.livesMax) {
      G.livesMax = Math.min(G.livesMax + 1, 5); // plafonné à 5
      G.lives    = G.livesMax;
      return { absorbed: true, message: "Vie bonus ! Tu as maintenant " + G.lives + " vies." };
    }
    G.inventory.push({ ...item });
    return { absorbed: false };
  }

  // ── Tirer un loot aléatoire ──────────────────────────────────
  // Retourne un pool de N items distincts pour la roue loot
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

  // ── Nouveau round ────────────────────────────────────────────
  // Conserve perso, persoStyle, inventory, vies entre les rounds.
  function newRound() {
    G.periode = _drawPeriode();
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

  // ── Réinitialisation complète ────────────────────────────────
  function fullReset() {
    G.village    = null;
    G.periode    = null;
    G.round      = { step: 0, results: {}, spinning: false };
    G.lives      = 3;
    G.livesMax   = 3;
    G.rankIdx    = 0;
    G.wins       = 0;
    G.perso      = null;
    G.persoStyle = null;
    G.inventory  = [];
    G.badges     = [];
    G.phase      = "combat";
    G.examReady  = false;
    G.status     = "village_select";
  }

  // ── Rang actuel ──────────────────────────────────────────────
  function currentRank() { return RANKS[G.rankIdx]; }
  function nextRank()    { return RANKS[G.rankIdx + 1] || null; }
  function rankPct()     { return Math.min(G.wins / WINS_PER_RANK * 100, 100); }

  return {
    getState, setVillage, getStarters, getPersoStyle, getAntags, getAntagData,
    computeIssueWeights, computeExamenWeights,
    setResult, setPerso, applyOutcome, applyExamen, addLoot, buildLootPool,
    newRound, fullReset, currentRank, nextRank, rankPct,
  };
})();
