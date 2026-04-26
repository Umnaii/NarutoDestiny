/* ============================================================
   NARUTO DESTINY WHEEL — engine.js
   Logique de jeu : état global, vies, rang, inventaire, loot.
   SÉCURITÉ : aucune donnée utilisateur. Pas de localStorage.
              Tout est en RAM — réinitialisé à chaque visite.
   ============================================================ */

const Engine = (() => {

  // ── État global ──────────────────────────────────────────────
  const G = {
    // Choix de période (fixé au début de partie)
    periode: null,

    // Round courant
    round: {
      step:    0,      // 0=village 1=perso 2=antag 3=issue 4=loot
      results: {},     // { village, perso, antag, outcome, loot }
      spinning: false,
    },

    // Vies
    lives:    3,
    livesMax: 3,

    // Rang
    rankIdx:  0,
    wins:     0,       // victoires dans le rang actuel

    // Inventaire (items non utilisés)
    inventory: [],     // tableau d'objets LOOT_POOL

    // Collection de badges
    badges: [],        // { antag, outcomeShort, outcomeCls, emoji }

    // Statut global
    status: "period_select", // "period_select" | "playing" | "gameover" | "victory"
  };

  // ── Accès à l'état ───────────────────────────────────────────
  function getState() { return G; }

  // ── Période ──────────────────────────────────────────────────
  function setPeriode(id) {
    const p = PERIODES.find(x => x.id === id);
    if (!p) return false;
    G.periode = p;
    G.status  = "playing";
    return true;
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

  // ── Appliquer le résultat de l'Issue ─────────────────────────
  // Retourne { usedChance, usedHeal, lifeChange, newLives, rankUp, gameOver, victory }
  function applyOutcome(outcomeIdx) {
    const outcome = OUTCOMES[outcomeIdx];
    let usedChance = false;
    let usedHeal   = false;
    let lifeChange = 0;
    let rankUp     = false;

    if (outcome.life < 0) {
      // Défaite : vérifier l'inventaire chance
      const chanceIdx = G.inventory.findIndex(it => it.effect === "chance");
      if (chanceIdx !== -1) {
        // Utilisation automatique du talisman
        G.inventory.splice(chanceIdx, 1);
        usedChance = true;
        // On ne perd pas de vie, on ne gagne pas de XP
      } else {
        // Vraie défaite : -1 vie
        G.lives = Math.max(0, G.lives - 1);
        lifeChange = -1;

        // Soin automatique si on a un item heal et qu'on perd une vie
        const healIdx = G.inventory.findIndex(it => it.effect === "heal");
        if (healIdx !== -1 && G.lives < G.livesMax) {
          G.inventory.splice(healIdx, 1);
          G.lives = Math.min(G.livesMax, G.lives + 1);
          usedHeal = true;
          lifeChange = 0; // compensé
        }
      }
    }

    // XP seulement si pas de défaite nette
    if (outcome.xp > 0) {
      G.wins += outcome.xp;
      if (G.wins >= WINS_PER_RANK && G.rankIdx < RANKS.length - 1) {
        G.wins = 0;
        G.rankIdx++;
        rankUp = true;
      }
    }

    // Vérifier fin de partie
    const gameOver  = G.lives <= 0;
    const victory   = G.rankIdx >= RANKS.length - 1 && !rankUp
                   || (rankUp && G.rankIdx >= RANKS.length - 1);

    if (gameOver) G.status = "gameover";
    if (victory && !gameOver) G.status = "victory";

    // Stocker le badge si pas défaite nette
    if (!gameOver) {
      const won = outcome.life >= 0 || usedChance;
      if (won || outcome.xp > 0 || usedChance) {
        G.badges.push({
          antag: G.round.results.antag,
          outcomeShort: outcome.short,
          outcomeCls:   outcome.cls,
          emoji:        outcome.emoji,
        });
      }
    }

    return { usedChance, usedHeal, lifeChange, rankUp, gameOver, victory };
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
  function newRound() {
    G.round = { step: 0, results: {}, spinning: false };
  }

  // ── Réinitialisation complète ────────────────────────────────
  function fullReset() {
    G.periode   = null;
    G.round     = { step: 0, results: {}, spinning: false };
    G.lives     = 3;
    G.livesMax  = 3;
    G.rankIdx   = 0;
    G.wins      = 0;
    G.inventory = [];
    G.badges    = [];
    G.status    = "period_select";
  }

  // ── Rang actuel ──────────────────────────────────────────────
  function currentRank() { return RANKS[G.rankIdx]; }
  function nextRank()    { return RANKS[G.rankIdx + 1] || null; }
  function rankPct()     { return Math.min(G.wins / WINS_PER_RANK * 100, 100); }

  return {
    getState, setPeriode, getStarters, getPersoStyle, getAntags, getAntagData,
    computeIssueWeights, setResult, applyOutcome, addLoot, buildLootPool,
    newRound, fullReset, currentRank, nextRank, rankPct,
  };
})();
