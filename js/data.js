/**
 * @file data.js
 * @module data
 * @description Base de données statique du jeu : rangs, villages, résultats possibles
 *              des roues, styles de combat, personnages jouables, antagonistes,
 *              portraits et objets de loot. Aucune logique ici — uniquement des
 *              constantes lues par engine.js, wheel.js et les fichiers ui/*.js.
 *
 * @dependencies
 *   - aucune (fichier chargé en premier, source de toutes les autres données)
 *
 * @exports
 *   - WINS_PER_RANK, RANKS, VILLAGES, OUTCOMES, EXAMEN_OUTCOMES,
 *     STARTERS, ANTAGONISTS, CHARACTER_PORTRAITS, LOOT_POOL, RARITY_WEIGHTS, TYPE_CSS,
 *     BADGE_PALETTES, WHEEL_PALETTES, LOOT_WHEEL_COLORS
 *
 * @sideEffects
 *   - Aucun. Toutes les constantes sont en lecture seule pour le reste du code.
 *
 * SÉCURITÉ : données statiques uniquement, aucune entrée utilisateur.
 */

/**
 * @constant WINS_PER_RANK
 * @description Nombre de victoires en combat nécessaires dans un rang pour que
 *              l'examen de passage au rang suivant soit accessible (voir
 *              engine.js → G.wins / rankPct()).
 * @type {number}
 */
const WINS_PER_RANK = 5;

/**
 * @constant RANKS
 * @description Les 4 rangs ninja que le joueur traverse, du premier au dernier.
 *              L'ordre du tableau EST la progression : passer un rang = incrémenter
 *              l'index (voir engine.js → G.rankIdx).
 *
 * @type {RankData[]}
 *
 * @typedef {Object} RankData
 * @property {string}      name  - Nom du rang affiché dans le HUD et les overlays
 * @property {?string}     next  - Nom du rang suivant, ou null si c'est le dernier (Kage)
 * @property {string}      color - Couleur CSS hex associée au rang (HUD, emblème, badge)
 * @property {string}      kanji - Caractère affiché au centre de l'emblème SVG (ui-svg.js)
 * @property {string}      title - Sous-titre affiché lors de la promotion
 * @property {string}      shape - Forme de l'emblème (informatif, non utilisé par ui-svg.js
 *                                 qui choisit la forme par nom de rang)
 */
const RANKS = [
  { name:"Genin",  next:"Chûnin", color:"#4ade80", kanji:"忍", title:"Le voyage commence",     shape:"circle"  },
  { name:"Chûnin", next:"Jônin",  color:"#60a5fa", kanji:"中", title:"Tu t'imposes aux examens",shape:"pentagon"},
  { name:"Jônin",  next:"Kage",   color:"#c084fc", kanji:"上", title:"L'élite des ninjas",     shape:"triangle"},
  { name:"Kage",   next:null,     color:"#facc15", kanji:"影", title:"Le sommet est atteint",  shape:"double"  },
];

/**
 * @constant VILLAGES
 * @description Les 6 villages ninja que le joueur peut choisir en début de partie
 *              (écran "screenVillage"). Le choix est définitif pour toute la partie
 *              et sert de clé dans STARTERS et ANTAGONISTS (rangs Genin/Chûnin).
 *
 * @type {VillageData[]}
 *
 * @typedef {Object} VillageData
 * @property {string} short  - Nom court, utilisé comme clé dans STARTERS (ex: "Konoha")
 * @property {string} emoji  - Emoji affiché sur la carte de sélection
 * @property {string} symbol - Élément associé au village, affiché en sous-titre
 */
const VILLAGES = [
  { short:"Konoha", emoji:"🍃", symbol:"Feuille" },
  { short:"Suna",   emoji:"🏜️", symbol:"Vent"    },
  { short:"Kiri",   emoji:"🌊", symbol:"Eau"     },
  { short:"Kumo",   emoji:"⚡", symbol:"Foudre"  },
  { short:"Iwa",    emoji:"🪨", symbol:"Terre"   },
  { short:"Oto",    emoji:"🎵", symbol:"Son"     },
];

/**
 * @constant OUTCOMES
 * @description Les 3 issues possibles de la roue de combat ("Issue"). Les poids de
 *              base (50/25/25) sont recalculés dynamiquement à chaque combat par
 *              engine.js → computeIssueWeights() selon le style du joueur, celui de
 *              l'ennemi et l'inventaire ; ce tableau ne fournit que les valeurs de base.
 *
 * @type {OutcomeData[]}
 *
 * @typedef {Object} OutcomeData
 * @property {string} short      - Libellé affiché sur la roue et dans le récapitulatif
 * @property {string} emoji      - Emoji associé à l'issue
 * @property {number} life       - Modification de vies : 0 (aucune) ou -1 (perte, sauf
 *                                 annulation par un talisman "chance" ou soin automatique)
 * @property {string} cls        - Classe CSS appliquée au résultat (couleur du texte)
 * @property {string} wheelColor - Couleur hex du segment sur la roue canvas
 */
const OUTCOMES = [
  { short:"Victoire",   emoji:"🏆", life: 0, cls:"out-v", wheelColor:"#059669" },
  { short:"Match nul",  emoji:"🤝", life: 0, cls:"out-d", wheelColor:"#1D4ED8" },
  { short:"Défaite",    emoji:"💀", life:-1, cls:"out-x", wheelColor:"#7F1D1D" },
];

/**
 * @constant EXAMEN_OUTCOMES
 * @description Les 2 issues possibles de la roue d'examen de passage de rang. Les poids
 *              de base sont fournis par engine.js → computeExamenWeights() selon le rang
 *              actuel et l'inventaire ; ce tableau n'est utilisé que pour typer/mapper
 *              les résultats (short, emoji, wheelColor) après le spin
 *              (voir ui-round.js → spinCurrent()).
 *
 * @type {ExamenOutcomeData[]}
 *
 * @typedef {Object} ExamenOutcomeData
 * @property {string} short      - "Réussite" ou "Échec"
 * @property {string} emoji      - Emoji associé
 * @property {string} wheelColor - Couleur hex du segment sur la roue canvas
 */
const EXAMEN_OUTCOMES = [
  { short:"Réussite", emoji:"✅", wheelColor:"#059669" },
  { short:"Échec",    emoji:"❌", wheelColor:"#7F1D1D" },
];

/**
 * @constant STARTERS
 * @description Personnages jouables tirables sur la roue "Personnage", indexés par le
 *              village d'origine choisi en début de partie (VILLAGES[i].short, ex:
 *              "Konoha"). Chaque village liste ses personnages principaux (3 à 15
 *              selon son importance dans le lore). Le personnage tiré devient permanent
 *              pour le reste de la partie (voir engine.js → setPerso()).
 *
 * @type {Object.<string, StarterData[]>}
 *
 * @typedef {Object} StarterData
 * @property {string}  name       - Nom affiché sur la roue et dans le récapitulatif
 * @property {string}  style      - Style de combat : "ninjutsu" | "taijutsu" | "genjutsu"
 * @property {boolean} canBeGenin - false = incohérent avec le lore (le personnage est
 *                                  déjà Kage/chef de village) → exclu du tirage, qui n'a
 *                                  lieu qu'au tout début de la partie, au rang Genin
 *                                  (voir engine.js → getStarters())
 */
const STARTERS = {
  "Konoha": [
    { name:"Naruto Uzumaki",  style:"ninjutsu", canBeGenin:true  },
    { name:"Sasuke Uchiha",   style:"ninjutsu", canBeGenin:true  },
    { name:"Sakura Haruno",   style:"genjutsu", canBeGenin:true  },
    { name:"Rock Lee",        style:"taijutsu", canBeGenin:true  },
    { name:"Neji Hyûga",      style:"taijutsu", canBeGenin:true  },
    { name:"Hinata Hyûga",    style:"taijutsu", canBeGenin:true  },
    { name:"Shikamaru Nara",  style:"genjutsu", canBeGenin:true  },
    { name:"Ino Yamanaka",    style:"genjutsu", canBeGenin:true  },
    { name:"Choji Akimichi",  style:"taijutsu", canBeGenin:true  },
    { name:"Sai",             style:"ninjutsu", canBeGenin:true  },
    { name:"Tenten",          style:"ninjutsu", canBeGenin:true  },
    // Kakashi était déjà Jônin enfant → canBeGenin:false
    { name:"Kakashi Hatake",  style:"ninjutsu", canBeGenin:false },
  ],
  "Suna": [
    { name:"Gaara",   style:"ninjutsu", canBeGenin:true  },
    { name:"Kankuro", style:"ninjutsu", canBeGenin:true  },
    { name:"Temari",  style:"ninjutsu", canBeGenin:true  },
  ],
  "Kiri": [
    { name:"Zabuza Momochi", style:"taijutsu", canBeGenin:true  },
    { name:"Haku",           style:"ninjutsu", canBeGenin:true  },
    { name:"Chojuro",        style:"taijutsu", canBeGenin:true  },
    { name:"Ao",             style:"genjutsu", canBeGenin:true  },
  ],
  "Kumo": [
    { name:"Killer B",  style:"taijutsu", canBeGenin:true  },
    { name:"Omoi",      style:"ninjutsu", canBeGenin:true  },
    { name:"Karui",     style:"taijutsu", canBeGenin:true  },
    // A = déjà Raikage → canBeGenin:false
    { name:"A (Raikage)", style:"taijutsu", canBeGenin:false },
  ],
  "Iwa": [
    { name:"Kurotsuchi", style:"ninjutsu", canBeGenin:true  },
    { name:"Akatsuchi",  style:"taijutsu", canBeGenin:true  },
    // Onoki = déjà Tsuchikage → canBeGenin:false
    { name:"Onoki (Tsuchikage)", style:"ninjutsu", canBeGenin:false },
  ],
  "Oto": [
    { name:"Dosu Kinuta", style:"ninjutsu", canBeGenin:true  },
    { name:"Zaku Abumi",  style:"ninjutsu", canBeGenin:true  },
    { name:"Jugo",        style:"taijutsu", canBeGenin:true  },
    { name:"Suigetsu",    style:"taijutsu", canBeGenin:true  },
    { name:"Karin",       style:"genjutsu", canBeGenin:true  },
    // Kabuto = déjà espion adulte au service d'Orochimaru → canBeGenin:false
    { name:"Kabuto Yakushi", style:"ninjutsu", canBeGenin:false },
  ],
};

/**
 * @constant ANTAGONISTS
 * @description Ennemis tirables sur la roue "Antagoniste". Chaque ennemi définit une
 *              faiblesse et une résistance de style, utilisées par engine.js →
 *              computeIssueWeights() pour moduler les poids de la roue de combat
 *              (Victoire/Nul/Défaite = 50/25/25 de base, x1.4 ou x0.6 selon le matchup
 *              de styles).
 *
 *              Structure à deux niveaux, cohérente avec le lore :
 *              - "Genin" et "Chûnin" (rangs de début de partie) sont indexés par le
 *                *village d'origine du joueur* (VILLAGES[i].short) : les premiers
 *                combats opposent le joueur à des ninjas d'un village rival crédible
 *                (ex: un Genin de Suna affronte des Genin de Konoha, comme lors de
 *                l'invasion des examens Chûnin — voir engine.js → getAntags()).
 *              - "Jônin" et "Kage" (rangs de fin de partie) sont des listes uniques,
 *                partagées par tous les villages : à ce stade de l'histoire, la menace
 *                (Akatsuki, puis Madara/Obito/Kaguya) dépasse les rivalités inter-
 *                villages et concerne le monde ninja entier.
 *
 * @type {Object.<string, AntagonistData[]|Object.<string, AntagonistData[]>>}
 *
 * @typedef {Object} AntagonistData
 * @property {string} name       - Nom affiché sur la roue et dans les badges/récapitulatif
 * @property {string} weakness   - Style qui inflige x1.4 (avantage joueur) à cet ennemi
 * @property {string} resistance - Style qui inflige x0.6 (désavantage joueur) à cet ennemi
 */
const ANTAGONISTS = {
  // ── GENIN — rivalités de village crédibles pour de jeunes ninjas ──
  "Genin": {
    "Konoha": [
      { name:"Dosu Kinuta",    weakness:"taijutsu", resistance:"genjutsu" },
      { name:"Zaku Abumi",     weakness:"genjutsu", resistance:"ninjutsu" },
      { name:"Jirobo",         weakness:"ninjutsu", resistance:"taijutsu" },
      { name:"Gato",           weakness:"taijutsu", resistance:"genjutsu" },
    ],
    "Suna": [
      { name:"Rock Lee",       weakness:"ninjutsu", resistance:"taijutsu" },
      { name:"Neji Hyûga",     weakness:"ninjutsu", resistance:"taijutsu" },
    ],
    // Rivalité de village : Kiri ↔ Suna (aucun rival naturel dans le lore pour ce
    // village, mais Kankuro/Temari/Gaara ont un portrait — mieux vaut de vrais
    // personnages qu'un "Rebelle de la guerre civile" anonyme).
    "Kiri": [
      { name:"Kankuro", weakness:"genjutsu", resistance:"ninjutsu" },
      { name:"Temari",  weakness:"taijutsu", resistance:"ninjutsu" },
      { name:"Gaara",   weakness:"ninjutsu", resistance:"taijutsu" },
    ],
    "Kumo": [
      { name:"Kurotsuchi",         weakness:"taijutsu", resistance:"ninjutsu" },
      { name:"Akatsuchi",          weakness:"ninjutsu", resistance:"taijutsu" },
      { name:"Onoki (Tsuchikage)", weakness:"genjutsu", resistance:"ninjutsu" },
    ],
    "Iwa": [
      { name:"Omoi",     weakness:"taijutsu", resistance:"ninjutsu" },
      { name:"Karui",    weakness:"ninjutsu", resistance:"taijutsu" },
      { name:"Killer B", weakness:"genjutsu", resistance:"taijutsu" },
    ],
    "Oto": [
      { name:"Hinata Hyûga",      weakness:"ninjutsu", resistance:"taijutsu" },
      { name:"Shikamaru Nara",    weakness:"taijutsu", resistance:"genjutsu" },
      { name:"Ino Yamanaka",      weakness:"ninjutsu", resistance:"genjutsu" },
      { name:"Choji Akimichi",    weakness:"genjutsu", resistance:"taijutsu" },
    ],
  },
  // ── CHÛNIN — ennemis plus redoutables, toujours liés au village d'origine ──
  "Chûnin": {
    "Konoha": [
      { name:"Tayuya",             weakness:"taijutsu", resistance:"genjutsu" },
      { name:"Sakon & Ukon",       weakness:"ninjutsu", resistance:"taijutsu" },
      { name:"Kimimaro",           weakness:"genjutsu", resistance:"taijutsu" },
      { name:"Kabuto Yakushi",     weakness:"taijutsu", resistance:"ninjutsu" },
      { name:"Cursed Seal Sasuke", weakness:"genjutsu", resistance:"ninjutsu" },
    ],
    "Suna": [
      { name:"Tenten",          weakness:"genjutsu", resistance:"ninjutsu" },
      { name:"Sai",             weakness:"taijutsu", resistance:"ninjutsu" },
      { name:"Yamato",          weakness:"genjutsu", resistance:"ninjutsu" },
      { name:"Kakashi Hatake",  weakness:"taijutsu", resistance:"genjutsu" },
    ],
    // Même rivalité qu'au rang Genin, en plus redoutable — Gaara/Kankuro/Temari ont
    // gagné en puissance depuis (voir CHARACTER_PORTRAITS : leur portrait évolue de lui-
    // même une fois le joueur Jônin/Kage).
    "Kiri": [
      { name:"Gaara",   weakness:"taijutsu", resistance:"genjutsu" },
      { name:"Kankuro", weakness:"ninjutsu", resistance:"genjutsu" },
      { name:"Temari",  weakness:"genjutsu", resistance:"taijutsu" },
    ],
    "Kumo": [
      { name:"Kurotsuchi", weakness:"genjutsu", resistance:"ninjutsu" },
      { name:"Akatsuchi",  weakness:"ninjutsu", resistance:"taijutsu" },
    ],
    "Iwa": [
      { name:"Karui", weakness:"ninjutsu", resistance:"taijutsu" },
    ],
    "Oto": [
      { name:"Ebisu",          weakness:"genjutsu", resistance:"ninjutsu" },
      { name:"Anko Mitarashi", weakness:"taijutsu", resistance:"genjutsu" },
      { name:"Sakura Haruno",  weakness:"ninjutsu", resistance:"genjutsu" },
    ],
  },
  // ── JÔNIN — Akatsuki et menaces majeures, communes à tous les villages ──
  "Jônin": [
    { name:"Itachi Uchiha",    weakness:"taijutsu", resistance:"genjutsu" },
    { name:"Kisame Hoshigaki", weakness:"genjutsu", resistance:"ninjutsu" },
    { name:"Deidara",          weakness:"genjutsu", resistance:"ninjutsu" },
    { name:"Sasori",           weakness:"ninjutsu", resistance:"taijutsu" },
    { name:"Hidan",            weakness:"ninjutsu", resistance:"taijutsu" },
    { name:"Kakuzu",           weakness:"ninjutsu", resistance:"taijutsu" },
    { name:"Konan",            weakness:"taijutsu", resistance:"ninjutsu" },
    { name:"Orochimaru",       weakness:"taijutsu", resistance:"genjutsu" },
    { name:"Sasuke Uchiha",    weakness:"taijutsu", resistance:"genjutsu" },
  ],
  // ── KAGE — boss ultimes, menace mondiale, communs à tous les villages ──
  "Kage": [
    { name:"Pain / Nagato",          weakness:"taijutsu", resistance:"ninjutsu" },
    { name:"Obito Uchiha",           weakness:"ninjutsu", resistance:"genjutsu" },
    { name:"Madara Uchiha",          weakness:"taijutsu", resistance:"ninjutsu" },
    { name:"Kaguya Otsutsuki",       weakness:"ninjutsu", resistance:"taijutsu" },
    { name:"Zetsu Blanc",            weakness:"taijutsu", resistance:"ninjutsu" },
    { name:"Kabuto Yakushi (Edo T.)",weakness:"taijutsu", resistance:"genjutsu" },
  ],
};

/**
 * @constant CHARACTER_PORTRAITS
 * @description Table de correspondance nom → image(s) de portrait. Utilisée par
 *              engine.js → getPortrait(name) pour le personnage joué (sidebar gauche,
 *              voir ui-hud.js → updatePersoPortrait() — le portrait y est toujours
 *              recalculé au rang courant, donc évolue avec la progression du joueur) et
 *              pour l'antagoniste du round (sidebar droite, voir ui-recap.js →
 *              updateAntagPortrait() pendant le combat). Une valeur figée est aussi
 *              enregistrée sur chaque badge au moment du combat (voir engine.js →
 *              applyOutcome()) pour que le portrait affiché dans l'historique
 *              victoires/nuls/défaites (menu déclenché en cliquant un badge) ne change
 *              plus jamais après coup, même si le rang du joueur progresse ensuite.
 *
 *              Un nom absent de cette table masque simplement le portrait, sans erreur —
 *              WORK IN PROGRESS, tous les personnages n'ont pas encore d'image.
 *
 * @type {Object.<string, string|{young: string, adult: string}>}
 *
 * Chaque entrée est :
 *  - une chaîne : une seule image, utilisée à tous les rangs ;
 *  - un objet `{young, adult}` : `young` est utilisé aux rangs Genin/Chûnin, `adult` aux
 *    rangs Jônin/Kage (voir engine.js → _resolvePortrait()).
 */
const CHARACTER_PORTRAITS = {
  // ── KONOHA ──
  "Naruto Uzumaki":  { young:"images/Naruto_newshot.webp",         adult:"images/Naruto_Part_II.webp" },
  "Sasuke Uchiha":   { young:"images/Sasuke_Part_1.webp",          adult:"images/Sasuke_Part_2.webp" },
  "Sakura Haruno":   { young:"images/Sakura_Part_1.webp",          adult:"images/Sakurap2.webp" },
  "Rock Lee":        { young:"images/Rock_Lee_Part_I.webp",        adult:"images/Lee_timeskip.webp" },
  "Neji Hyûga":      { young:"images/Neji_Part_I_Screenshot.webp", adult:"images/Neji_Part_2.webp" },
  "Hinata Hyûga":    { young:"images/Hinata.webp",                 adult:"images/Hinata_Part_II.webp" },
  "Shikamaru Nara":  { young:"images/Shikamaru_Part_I.webp",       adult:"images/Shikamaru_Nara.webp" },
  "Ino Yamanaka":    { young:"images/Ino.webp",                    adult:"images/Ino2.webp" },
  "Choji Akimichi":  { young:"images/Choji_Akimichi.webp",         adult:"images/Choji_Part_II.webp" },
  "Sai":             "images/Sai_Infobox.webp",
  "Tenten":          { young:"images/Tenten_Part_1.webp",         adult:"images/Tenten_Part_II.webp" },
  "Kakashi Hatake":  "images/Kakashi_Hatake.webp",

  // ── SUNA ──
  "Gaara":           { young:"images/Gaara_in_Part_I.webp",  adult:"images/Gaara_Part_II.webp" },
  "Kankuro":         { young:"images/Kankuro1.webp",         adult:"images/Kankuro_Part_II.webp" },
  "Temari":          { young:"images/Temari_newshot.webp",   adult:"images/Temari_Part_II.webp" },

  // ── KIRI ──
  "Zabuza Momochi":  "images/Zabuza_Momochi.webp",
  "Haku":            "images/Haku.webp",
  "Chojuro":         "images/Chojuro_2.webp",
  "Ao":              "images/Ao.webp",

  // ── KUMO ──
  "Killer B":        "images/Killer_B.webp",
  "Omoi":            "images/Omoi_Part_II.webp",
  "Karui":           "images/Karui.webp",
  "A (Raikage)":     "images/Fourth_Raikage_2.webp",

  // ── IWA ──
  "Kurotsuchi":          "images/Kurotsuchi_Part_II.webp",
  "Akatsuchi":           "images/Akatsuchi_Part_II.webp",
  "Onoki (Tsuchikage)":  "images/Onoki.webp",

  // ── OTO ──
  "Dosu Kinuta":     "images/Dosu_Kinuta.webp",
  "Zaku Abumi":      "images/Zaku_Abumi.webp",
  "Jugo":            "images/Jugo.webp",
  "Suigetsu":        "images/Suigetsu_Hozuki.webp",
  "Karin":           "images/Karin3.webp",
  "Kabuto Yakushi":  { young:"images/Kabuto_Part_1.webp", adult:"images/Kabuto_Part_II.webp" },
  "Kabuto Yakushi (Edo T.)": "images/Kabuto_Part_II.webp",

  // ── ANTAGONISTES SANS FICHE JOUEUR ──
  "Jirobo":            "images/Jirobo_newshot.webp",
  "Gato":              "images/Gato.webp",
  "Tayuya":            "images/Tayuya_Shot.webp",
  "Sakon & Ukon":      "images/Sakon_and_Ukon.webp",
  "Kimimaro":          "images/Kimimaro_infobox.webp",
  "Cursed Seal Sasuke":"images/Sasuke_Part_1.webp",
  "Yamato":            "images/Yamato_newshot.webp",
  "Ebisu":             "images/Ebisu.webp",
  "Anko Mitarashi":    "images/Anko_Part_I.webp",

  // ── JÔNIN (Akatsuki & co) ──
  "Itachi Uchiha":     { young:"images/Itachi_Child_OL.webp", adult:"images/Itachi.webp" },
  "Kisame Hoshigaki":  "images/Kisame.webp",
  "Deidara":           "images/Deidara_mugshot.webp",
  "Sasori":            "images/Hiruko_NUN4.webp",
  "Hidan":             "images/Hidan.webp",
  "Kakuzu":            "images/Kakuzu_mugshot.webp",
  "Konan":             "images/Konan_Infobox.webp",
  "Orochimaru":        "images/Orochimaru_Infobox.webp",

  // ── KAGE (menaces finales) ──
  "Pain / Nagato":     "images/Nagato.webp",
  "Obito Uchiha":      { young:"images/Kid_Obito_full.webp", adult:"images/Obito_Uchiha%20(1).webp" },
  "Madara Uchiha":     "images/Madara.webp",
  "Kaguya Otsutsuki":  "images/Kaguya_Otsutsuki.webp",
  "Zetsu Blanc":       "images/White_Zetsu.webp",
};

/**
 * @constant LOOT_POOL
 * @description Dictionnaire complet des objets tirables sur la roue "Butin" après un
 *              combat. engine.js → buildLootPool() en tire un sous-ensemble pondéré par
 *              rareté (voir RARITY_WEIGHTS) à chaque round ; l'objet gagné est ensuite
 *              ajouté à l'inventaire du joueur (Engine.addLoot()) et modifie les poids
 *              des roues suivantes (computeIssueWeights(), computeExamenWeights()).
 *
 * @type {LootItemData[]}
 *
 * @typedef {Object} LootItemData
 * @property {string} id     - Identifiant unique de l'objet
 * @property {string} name   - Nom affiché
 * @property {string} emoji  - Emoji/icône affiché dans l'inventaire et le récapitulatif
 * @property {string} type   - "weapon" | "ninjutsu" | "taijutsu" | "genjutsu" | "heal" |
 *                              "chance" | "boost" | "skip"
 * @property {string} desc   - Description narrative de l'objet
 * @property {string} rarity - "common" | "uncommon" | "rare" | "epic" — pondère le tirage
 *                              (voir RARITY_WEIGHTS) et l'affichage (_rarityLabel())
 * @property {string} effect - Effet mécanique : "heal" (restaure 1 vie automatiquement à
 *                              la prochaine défaite), "chance" (annule automatiquement 1
 *                              défaite, désarmable), "bonus_xp_N" (cosmétique — accordé
 *                              en bonus de poids par computeIssueWeights()/
 *                              computeExamenWeights() selon le type, pas selon ce champ),
 *                              "boost_issue"/"boost_examen" (gros bonus ponctuel, mais
 *                              n'agit QUE si le joueur l'active lui-même depuis
 *                              l'inventaire avant le combat/examen concerné), "skip_fight"
 *                              (évite entièrement le prochain combat, sans victoire ni
 *                              défaite — n'agit que si activé soi-même). Ces trois
 *                              derniers sont dits "à activation manuelle" (voir
 *                              engine.js → isManualUseItem()/toggleItemArmed() ; inertes
 *                              et gaspillés si jamais activés).
 *                              Seuls les objets consommables ("heal", "chance",
 *                              "boost_issue", "boost_examen", "skip_fight") peuvent être
 *                              looté plusieurs fois dans la même partie — un doublon
 *                              augmente sa quantité (×2, ×3…) dans l'inventaire au lieu
 *                              d'une ligne séparée (voir engine.js → addLoot()). Les
 *                              objets permanents ("bonus_xp_N") sont uniques : une fois
 *                              possédés, ils disparaissent du pool de butin pour le
 *                              reste de la partie (voir engine.js → buildLootPool()).
 * @property {number} [forcedWeight] - Réservé à l'objet fictif "Rien cette fois", ajouté
 *                              par engine.js → buildLootPool() quand le combat de ce
 *                              round n'est pas une victoire nette (match nul ou défaite
 *                              survécue — butin réduit à 40% de chances) : poids
 *                              explicite de la roue Butin, prioritaire sur le poids par
 *                              rareté (voir wheel.js → getLootWheelData()). Absent de
 *                              tous les objets réels de LOOT_POOL.
 */
const LOOT_POOL = [
  // ── ARMES ──
  { id:"kunai",      name:"Kunai",             emoji:"🗡️",  type:"weapon",   rarity:"common",   desc:"L'arme de base de tout ninja.",             effect:"bonus_xp_1" },
  { id:"shuriken",   name:"Shuriken",           emoji:"⭐",  type:"weapon",   rarity:"common",   desc:"Étoile de lancer, précise et mortelle.",     effect:"bonus_xp_1" },
  { id:"tanto",      name:"Tantō",              emoji:"🔪",  type:"weapon",   rarity:"uncommon", desc:"Lame courte pour le combat rapproché.",      effect:"bonus_xp_2" },
  { id:"naginata",   name:"Naginata",           emoji:"⚔️",  type:"weapon",   rarity:"rare",     desc:"Arme d'hast des guerriers d'élite.",         effect:"bonus_xp_2" },
  { id:"samehada",   name:"Samehada (réplique)",emoji:"🦈",  type:"weapon",   rarity:"epic",     desc:"L'épée absorbante de Kisame, en miniature.", effect:"bonus_xp_3" },
  { id:"kiba",       name:"Kiba (réplique)",    emoji:"⚡",  type:"weapon",   rarity:"epic",     desc:"Les épées jumelles de la foudre d'Omoi.",    effect:"bonus_xp_3" },

  // ── NINJUTSU ──
  { id:"katon",      name:"Parchemin Katon",    emoji:"🔥",  type:"ninjutsu", rarity:"common",   desc:"Maîtrise d'un jutsu de feu.",                effect:"bonus_xp_1" },
  { id:"suiton",     name:"Parchemin Suiton",   emoji:"💧",  type:"ninjutsu", rarity:"common",   desc:"Contrôle de l'eau au niveau supérieur.",     effect:"bonus_xp_1" },
  { id:"futon",      name:"Parchemin Fûton",    emoji:"🌀",  type:"ninjutsu", rarity:"uncommon", desc:"Jutsu de vent pour amplifier les attaques.",  effect:"bonus_xp_2" },
  { id:"raikiri",    name:"Raikiri (fragment)", emoji:"⚡",  type:"ninjutsu", rarity:"rare",     desc:"Un éclat de la technique de Kakashi.",        effect:"bonus_xp_2" },
  { id:"rasengan",   name:"Rasengan (sceau)",   emoji:"🌪️", type:"ninjutsu", rarity:"epic",     desc:"Le jutsu signature de Minato et Naruto.",    effect:"bonus_xp_3" },

  // ── TAIJUTSU ──
  { id:"kawarimi",   name:"Manuel Kawarimi",    emoji:"💨",  type:"taijutsu", rarity:"common",   desc:"Substitution corporelle maîtrisée.",          effect:"bonus_xp_1" },
  { id:"gouken",     name:"Parchemin Gouken",   emoji:"💪",  type:"taijutsu", rarity:"uncommon", desc:"Techniques de force brute de style Raikage.", effect:"bonus_xp_2" },
  { id:"hakke",      name:"Parchemin Hakke",    emoji:"👁️",  type:"taijutsu", rarity:"rare",     desc:"Les 64 Mains du clan Hyûga.",                effect:"bonus_xp_2" },
  { id:"ura",        name:"Ura Renge (sceau)",  emoji:"🌀",  type:"taijutsu", rarity:"epic",     desc:"La technique ultime de Rock Lee.",            effect:"bonus_xp_3" },

  // ── GENJUTSU ──
  { id:"kanashibari",name:"Kanashibari no Jutsu",emoji:"😵", type:"genjutsu", rarity:"common",   desc:"Paralyse l'esprit de l'adversaire.",          effect:"bonus_xp_1" },
  { id:"tsukuyomi",  name:"Tsukuyomi (fragment)",emoji:"🌙", type:"genjutsu", rarity:"epic",     desc:"Un éclat du genjutsu absolu d'Itachi.",       effect:"bonus_xp_3" },
  { id:"izanagi",    name:"Parchemin Izanagi",  emoji:"✨",  type:"genjutsu", rarity:"rare",     desc:"Réécrire brièvement la réalité.",             effect:"bonus_xp_2" },

  // ── SOINS ──
  { id:"senzu_nar",  name:"Pilule de Chakra",   emoji:"💊",  type:"heal",     rarity:"uncommon", desc:"Restaure une vie. Utilisé automatiquement si tu es blessé.", effect:"heal" },
  { id:"antidote",   name:"Antidote de Tsunade",emoji:"💉",  type:"heal",     rarity:"rare",     desc:"Soin d'urgence signé Tsunade. Restaure une vie.",            effect:"heal" },
  { id:"soldier_pill", name:"Pilule Soldat",    emoji:"🫘",  type:"heal",     rarity:"common",   desc:"Ration militaire qui restaure les forces. Utilisée automatiquement si tu es blessé.", effect:"heal" },

  // ── CHANCE ──
  { id:"omamori",    name:"Omamori Porte-Bonheur",emoji:"🎴", type:"chance",   rarity:"uncommon", desc:"Annule automatiquement une défaite. Usage unique.", effect:"chance" },
  { id:"talisman",   name:"Talisman de Jiraiya", emoji:"📿",  type:"chance",   rarity:"rare",     desc:"La chance du Sage. Annule une défaite.",             effect:"chance" },

  // ── BOOST (activation manuelle obligatoire — voir Engine.isManualUseItem()) ──
  { id:"sage_seal",  name:"Sceau du Chakra Naturel", emoji:"🐸", type:"boost", rarity:"rare",
    desc:"Un sceau de chakra naturel. Reste inerte tant que tu ne l'actives pas toi-même avant un combat.",
    effect:"boost_issue" },
  { id:"forbidden_scroll", name:"Fragment du Rouleau Interdit", emoji:"📜", type:"boost", rarity:"epic",
    desc:"Un fragment du Parchemin interdit. Reste inerte tant que tu ne l'actives pas toi-même avant un examen.",
    effect:"boost_examen" },

  // ── FUITE (activation manuelle obligatoire — voir Engine.isManualUseItem()) ──
  { id:"smoke_bomb", name:"Bombe Fumigène", emoji:"🌫️", type:"skip", rarity:"rare",
    desc:"Une bombe fumigène pour disparaître avant un affrontement. Reste inerte tant que tu ne l'actives pas toi-même avant le combat concerné.",
    effect:"skip_fight" },
];

/**
 * @constant RARITY_WEIGHTS
 * @description Poids de tirage aléatoire par rareté d'objet — plus la valeur est haute,
 *              plus l'objet a de chances d'apparaître dans le pool de la roue "Butin"
 *              (voir engine.js → buildLootPool()) et sur ses parts (wheel.js → getLootWheelData()).
 * @type {Object.<string, number>}
 */
const RARITY_WEIGHTS = { common:45, uncommon:30, rare:18, epic:7 };

/**
 * @constant TYPE_CSS
 * @description Correspondance entre le type d'un objet de loot et la classe CSS qui
 *              colore sa vignette dans la barre d'inventaire (voir ui-inventory.js →
 *              updateInventoryBar()).
 * @type {Object.<string, string>}
 */
const TYPE_CSS = {
  weapon:   "inv-item-weapon",
  ninjutsu: "inv-item-tech",
  taijutsu: "inv-item-tech",
  genjutsu: "inv-item-tech",
  heal:     "inv-item-heal",
  chance:   "inv-item-chance",
  boost:    "inv-item-boost",
  skip:     "inv-item-skip",
};

/**
 * @constant BADGE_PALETTES
 * @description 7 palettes de 3 couleurs (principale, secondaire, contour) utilisées pour
 *              générer procéduralement le badge SVG d'un antagoniste vaincu. La palette
 *              est choisie de façon déterministe par `hashStr(name) % 7` (voir ui-svg.js →
 *              makeBadgeSvg()), garantissant qu'un même ennemi a toujours le même badge.
 * @type {Array<[string, string, string]>}
 */
const BADGE_PALETTES = [
  ["#E8521A","#FF6B2B","#B83D0E"],
  ["#7C3AED","#A78BFA","#4C1D95"],
  ["#0891B2","#67E8F9","#164E63"],
  ["#DC2626","#FCA5A5","#7F1D1D"],
  ["#059669","#34D399","#064E3B"],
  ["#D97706","#FCD34D","#78350F"],
  ["#BE185D","#F9A8D4","#831843"],
];

/**
 * @constant WHEEL_PALETTES
 * @description Palettes de couleurs cycliques utilisées par wheel.js → drawGeneric()/
 *              spinGeneric() pour les roues à segments égaux, indexées par le paramètre
 *              `pal` défini dans ui-round.js → buildSteps() : 0 = roue Personnage,
 *              1 = roue Antagoniste. Les roues Issue et Loot utilisent leurs propres
 *              couleurs (OUTCOMES[i].wheelColor et LOOT_WHEEL_COLORS) et ne consomment
 *              pas ce tableau.
 * @type {string[][]}
 */
const WHEEL_PALETTES = [
  ["#E8521A","#B83D0E","#F97316","#CC1A1A","#FF6B2B","#8B2500"], // Village
  ["#059669","#064E3B","#10B981","#047857","#34D399","#022C22"], // Personnage
  ["#7C3AED","#4C1D95","#8B5CF6","#6D28D9","#A78BFA","#2E1065"], // Antagoniste
  // Issue — couleurs spécifiques par outcome (utilise OUTCOMES[i].wheelColor)
  // Loot — couleurs par type
];

/**
 * @constant LOOT_WHEEL_COLORS
 * @description Palette de 3 couleurs par type d'objet, utilisée par wheel.js →
 *              getLootWheelData() pour colorer chaque segment de la roue "Butin"
 *              (une couleur est choisie aléatoirement dans le triplet pour chaque item).
 * @type {Object.<string, [string, string, string]>}
 */
const LOOT_WHEEL_COLORS = {
  weapon:   ["#B83D0E","#E8521A","#F97316"],
  ninjutsu: ["#1D4ED8","#3B82F6","#60a5fa"],
  taijutsu: ["#059669","#10B981","#34D399"],
  genjutsu: ["#7C3AED","#8B5CF6","#A78BFA"],
  heal:     ["#BE185D","#EC4899","#F9A8D4"],
  chance:   ["#D97706","#F59E0B","#FCD34D"],
  boost:    ["#B8860B","#E0BC4C","#F3D673"],
  skip:     ["#475569","#64748B","#94A3B8"],
};
