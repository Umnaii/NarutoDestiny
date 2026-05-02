/* ============================================================
   NARUTO DESTINY WHEEL — data.js
   Toutes les données du jeu. Aucune logique ici.
   SÉCURITÉ : données statiques uniquement, aucune entrée utilisateur.
   ============================================================ */

const WINS_PER_RANK = 5;

const RANKS = [
  { name:"Genin",  next:"Chûnin", color:"#4ade80", kanji:"忍", title:"Le voyage commence",     shape:"circle"  },
  { name:"Chûnin", next:"Jônin",  color:"#60a5fa", kanji:"中", title:"Tu t'imposes aux examens",shape:"pentagon"},
  { name:"Jônin",  next:"Kage",   color:"#c084fc", kanji:"上", title:"L'élite des ninjas",     shape:"triangle"},
  { name:"Kage",   next:null,     color:"#facc15", kanji:"影", title:"Le sommet est atteint",  shape:"double"  },
];

const PERIODES = [
  {
    id: "classique",
    short: "Classique",
    emoji: "📜",
    desc: "L'ère de l'Académie, des Examens Chûnin et des premières grandes menaces.",
    cssClass: "pc-classique",
  },
  {
    id: "shippuden",
    short: "Shippuden",
    emoji: "🔥",
    desc: "L'Akatsuki, la 4ème Grande Guerre Ninja, et la montée de Kaguya.",
    cssClass: "pc-shippuden",
  },
  {
    id: "thelast",
    short: "The Last",
    emoji: "🌙",
    desc: "Deux ans après la Guerre — Toneri Otsutsuki menace la Lune.",
    cssClass: "pc-thelast",
  },
  {
    id: "ereclans",
    short: "Ère des Clans",
    emoji: "⚔️",
    desc: "Avant les villages, les clans s'affrontent pour la domination du monde ninja.",
    cssClass: "pc-ereclans",
  },
];

const VILLAGES = [
  { short:"Konoha", emoji:"🍃", symbol:"Feuille" },
  { short:"Suna",   emoji:"🏜️", symbol:"Vent"    },
  { short:"Kiri",   emoji:"🌊", symbol:"Eau"     },
  { short:"Kumo",   emoji:"⚡", symbol:"Foudre"  },
  { short:"Iwa",    emoji:"🪨", symbol:"Terre"   },
  { short:"Oto",    emoji:"🎵", symbol:"Son"     },
];

// Résultats de la roue Issue — 3 segments, poids calculés dynamiquement par engine.js
// xp = points de progression vers le rang suivant
// life = modification de vies (0 ou -1)
// Les poids de base sont modifiés par computeIssueWeights() selon style vs ennemi.
const OUTCOMES = [
  { short:"Victoire",   emoji:"🏆", xp:3, life: 0, cls:"out-v", wheelColor:"#059669" },
  { short:"Match nul",  emoji:"🤝", xp:1, life: 0, cls:"out-d", wheelColor:"#1D4ED8" },
  { short:"Défaite",    emoji:"💀", xp:0, life:-1, cls:"out-x", wheelColor:"#7F1D1D" },
];

// Résultats de la roue Examen — 2 segments, poids calculés par computeExamenWeights()
const EXAMEN_OUTCOMES = [
  { short:"Réussite", emoji:"✅", wheelColor:"#059669" },
  { short:"Échec",    emoji:"❌", wheelColor:"#7F1D1D" },
];

// ── STYLES DE COMBAT ──────────────────────────────────────────
// Triangle de faiblesses : Ninjutsu > Taijutsu > Genjutsu > Ninjutsu
// "bat" = avantage x1.4, "perd" = désavantage x0.6
const STYLE_TRIANGLE = {
  ninjutsu: { bat: "taijutsu",  perd: "genjutsu"  },
  taijutsu: { bat: "genjutsu",  perd: "ninjutsu"  },
  genjutsu: { bat: "ninjutsu",  perd: "taijutsu"  },
};

// Starters : chaque perso a style + canBeGenin
// canBeGenin:false = jamais Genin dans le lore (déjà Kage/Sannin/Akatsuki au moment de la période)
// style: "ninjutsu" | "taijutsu" | "genjutsu"
const STARTERS = {
  "Classique-Konoha": [
    { name:"Naruto Uzumaki",  style:"ninjutsu", canBeGenin:true  },
    { name:"Sasuke Uchiha",   style:"ninjutsu", canBeGenin:true  },
    { name:"Sakura Haruno",   style:"genjutsu", canBeGenin:true  },
    { name:"Rock Lee",        style:"taijutsu", canBeGenin:true  },
    { name:"Neji Hyûga",      style:"taijutsu", canBeGenin:true  },
    { name:"Hinata Hyûga",    style:"taijutsu", canBeGenin:true  },
    { name:"Shino Aburame",   style:"ninjutsu", canBeGenin:true  },
    { name:"Kiba Inuzuka",    style:"taijutsu", canBeGenin:true  },
    { name:"Shikamaru Nara",  style:"genjutsu", canBeGenin:true  },
    { name:"Ino Yamanaka",    style:"genjutsu", canBeGenin:true  },
    { name:"Choji Akimichi",  style:"taijutsu", canBeGenin:true  },
  ],
  "Classique-Suna": [
    { name:"Gaara",   style:"ninjutsu", canBeGenin:true  },
    { name:"Kankuro", style:"ninjutsu", canBeGenin:true  },
    { name:"Temari",  style:"ninjutsu", canBeGenin:true  },
  ],
  "Classique-Kiri": [
    { name:"Zabuza Momochi (jeune)", style:"taijutsu", canBeGenin:true  },
    { name:"Haku (jeune)",           style:"ninjutsu", canBeGenin:true  },
    // Kisame était déjà Jônin en mission en Classique → canBeGenin:false
    { name:"Kisame Hoshigaki",       style:"taijutsu", canBeGenin:false },
  ],
  "Classique-Kumo": [
    { name:"Killer B (jeune)", style:"taijutsu", canBeGenin:true  },
    { name:"Yugito Nii (jeune)",style:"ninjutsu", canBeGenin:true },
  ],
  "Classique-Iwa": [
    { name:"Kurotsuchi (jeune)", style:"ninjutsu", canBeGenin:true },
    { name:"Akatsuchi (jeune)",  style:"taijutsu", canBeGenin:true },
  ],
  "Classique-Oto": [
    { name:"Dosu Kinuta", style:"ninjutsu", canBeGenin:true },
    { name:"Zaku Abumi",  style:"ninjutsu", canBeGenin:true },
    { name:"Kin Tsuchi",  style:"genjutsu", canBeGenin:true },
  ],

  "Shippuden-Konoha": [
    { name:"Naruto Uzumaki",  style:"ninjutsu", canBeGenin:true  },
    { name:"Sakura Haruno",   style:"taijutsu", canBeGenin:true  }, // Chûnin+ en Shippuden mais a été Genin
    { name:"Sai",             style:"ninjutsu", canBeGenin:true  },
    { name:"Yamato",          style:"ninjutsu", canBeGenin:true  },
    { name:"Shikamaru Nara",  style:"genjutsu", canBeGenin:true  },
    // Kakashi était déjà Jônin enfant → canBeGenin:false ici
    { name:"Kakashi Hatake",  style:"ninjutsu", canBeGenin:false },
  ],
  "Shippuden-Suna": [
    { name:"Temari",  style:"ninjutsu", canBeGenin:true  },
    { name:"Kankuro", style:"ninjutsu", canBeGenin:true  },
    // Gaara était déjà Kazekage → canBeGenin:false
    { name:"Gaara (Kazekage)", style:"ninjutsu", canBeGenin:false },
  ],
  "Shippuden-Kiri": [
    { name:"Chojuro",  style:"taijutsu", canBeGenin:true  },
    { name:"Ao",       style:"genjutsu", canBeGenin:true  },
    // Mei Terumi = Mizukage → canBeGenin:false
    { name:"Mei Terumi", style:"ninjutsu", canBeGenin:false },
  ],
  "Shippuden-Kumo": [
    { name:"Omoi",  style:"ninjutsu", canBeGenin:true  },
    { name:"Karui", style:"taijutsu", canBeGenin:true  },
    { name:"Killer B",    style:"taijutsu", canBeGenin:true  },
    // A = Raikage → canBeGenin:false
    { name:"A (Raikage)", style:"taijutsu", canBeGenin:false },
  ],
  "Shippuden-Iwa": [
    { name:"Kurotsuchi", style:"ninjutsu", canBeGenin:true  },
    { name:"Akatsuchi",  style:"taijutsu", canBeGenin:true  },
    // Onoki = Tsuchikage → canBeGenin:false
    { name:"Onoki (Tsuchikage)", style:"ninjutsu", canBeGenin:false },
  ],
  "Shippuden-Oto": [
    { name:"Jugo",     style:"taijutsu", canBeGenin:true  },
    { name:"Suigetsu", style:"taijutsu", canBeGenin:true  },
    { name:"Karin",    style:"genjutsu", canBeGenin:true  },
    // Kabuto = déjà espion adulte → canBeGenin:false
    { name:"Kabuto Yakushi", style:"ninjutsu", canBeGenin:false },
  ],

  "The Last-Konoha": [
    { name:"Hinata Hyûga", style:"taijutsu", canBeGenin:true  },
    { name:"Sai",          style:"ninjutsu", canBeGenin:true  },
    { name:"Shikamaru",    style:"genjutsu", canBeGenin:true  },
    { name:"Rock Lee",     style:"taijutsu", canBeGenin:true  },
    { name:"Tenten",       style:"ninjutsu", canBeGenin:true  },
    // Naruto = Héros de guerre, Sakura = Jônin confirmé, mais ont été Genin
    { name:"Naruto Uzumaki", style:"ninjutsu", canBeGenin:true },
    { name:"Sakura Haruno",  style:"taijutsu", canBeGenin:true },
  ],
  "The Last-Suna": [
    { name:"Temari", style:"ninjutsu", canBeGenin:true  },
    // Gaara = Kazekage → canBeGenin:false
    { name:"Gaara",  style:"ninjutsu", canBeGenin:false },
  ],
  "The Last-Kiri": [
    { name:"Chojuro",    style:"taijutsu", canBeGenin:true  },
    { name:"Mei Terumi", style:"ninjutsu", canBeGenin:false },
  ],
  "The Last-Kumo": [
    { name:"Omoi",     style:"ninjutsu", canBeGenin:true  },
    { name:"Killer B", style:"taijutsu", canBeGenin:true  },
  ],
  "The Last-Iwa": [
    { name:"Kurotsuchi", style:"ninjutsu", canBeGenin:true },
  ],
  "The Last-Oto": [
    { name:"Kabuto Yakushi (reclus)", style:"ninjutsu", canBeGenin:false },
  ],

  "Ère des Clans-Konoha": [
    { name:"Tobirama Senju",        style:"ninjutsu", canBeGenin:true  },
    { name:"Madara Uchiha (jeune)", style:"ninjutsu", canBeGenin:true  },
    // Hashirama = déjà Hokage / chef de clan → canBeGenin:false
    { name:"Hashirama Senju",       style:"ninjutsu", canBeGenin:false },
  ],
  "Ère des Clans-Suna": [
    { name:"Chef du clan du Sable", style:"ninjutsu", canBeGenin:false },
    { name:"Guerrière du Vent",     style:"ninjutsu", canBeGenin:true  },
  ],
  "Ère des Clans-Kiri": [
    { name:"Guerrier brumeux",  style:"taijutsu", canBeGenin:true  },
    { name:"Premier Mizukage", style:"ninjutsu", canBeGenin:false },
  ],
  "Ère des Clans-Kumo": [
    { name:"Kumo no Senshi",  style:"taijutsu", canBeGenin:true  },
    { name:"Premier Raikage", style:"taijutsu", canBeGenin:false },
  ],
  "Ère des Clans-Iwa": [
    { name:"Guerrier de Roche",  style:"taijutsu", canBeGenin:true  },
    { name:"Premier Tsuchikage", style:"ninjutsu", canBeGenin:false },
  ],
  "Ère des Clans-Oto": [
    { name:"Guerrier errant",  style:"ninjutsu", canBeGenin:true },
    { name:"Shinobi solitaire",style:"taijutsu", canBeGenin:true },
  ],
};

// Antagonistes par grade du joueur — chaque ennemi a :
//   weakness   : style qui lui inflige x1.4 (avantage joueur)
//   resistance : style qui lui inflige x0.6 (désavantage joueur)
// Les poids de base de la roue Issue (Victoire/Nul/Défaite = 50/25/25)
// sont multipliés par ces coefficients dans engine.computeIssueWeights().
const ANTAGONISTS = {
  // ── GENIN — ennemis faibles, pas encore maîtres ──
  "Genin": [
    { name:"Mizuki",          weakness:"taijutsu", resistance:"ninjutsu" },
    { name:"Haku",            weakness:"genjutsu", resistance:"ninjutsu" },
    { name:"Dosu Kinuta",     weakness:"taijutsu", resistance:"genjutsu" },
    { name:"Zaku Abumi",      weakness:"genjutsu", resistance:"ninjutsu" },
    { name:"Kin Tsuchi",      weakness:"ninjutsu", resistance:"genjutsu" },
    { name:"Kidomaru",        weakness:"taijutsu", resistance:"ninjutsu" },
    { name:"Jirobo",          weakness:"ninjutsu", resistance:"taijutsu" },
    { name:"Gato",            weakness:"taijutsu", resistance:"genjutsu" },
    { name:"Genin de Sound",  weakness:"genjutsu", resistance:"taijutsu" },
  ],
  // ── CHÛNIN — ennemis intermédiaires, style marqué ──
  "Chûnin": [
    { name:"Tayuya",              weakness:"taijutsu", resistance:"genjutsu" },
    { name:"Sakon & Ukon",        weakness:"ninjutsu", resistance:"taijutsu" },
    { name:"Kimimaro",            weakness:"genjutsu", resistance:"taijutsu" },
    { name:"Kabuto Yakushi",      weakness:"taijutsu", resistance:"ninjutsu" },
    { name:"Zabuza Momochi",      weakness:"ninjutsu", resistance:"taijutsu" },
    { name:"Gaara (antagoniste)", weakness:"ninjutsu", resistance:"taijutsu" },
    { name:"Temari (adversaire)", weakness:"taijutsu", resistance:"ninjutsu" },
    { name:"Kankuro (adversaire)",weakness:"genjutsu", resistance:"ninjutsu" },
    { name:"Cursed Seal Sasuke",  weakness:"genjutsu", resistance:"ninjutsu" },
  ],
  // ── JÔNIN — ennemis puissants, spécialistes ──
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
    { name:"Toneri Otsutsuki", weakness:"taijutsu", resistance:"ninjutsu" },
  ],
  // ── KAGE — boss ultimes, résistances marquées ──
  "Kage": [
    { name:"Pain / Nagato",          weakness:"taijutsu", resistance:"ninjutsu" },
    { name:"Obito Uchiha",           weakness:"ninjutsu", resistance:"genjutsu" },
    { name:"Madara Uchiha",          weakness:"taijutsu", resistance:"ninjutsu" },
    { name:"Kaguya Otsutsuki",       weakness:"ninjutsu", resistance:"taijutsu" },
    { name:"Kinkaku & Ginkaku",      weakness:"genjutsu", resistance:"ninjutsu" },
    { name:"Zetsu Blanc",            weakness:"taijutsu", resistance:"ninjutsu" },
    { name:"Kabuto Yakushi (Edo T.)",weakness:"taijutsu", resistance:"genjutsu" },
  ],
};

// ── LOOT POOL ─────────────────────────────────────────────────
// Chaque item a : id, name, emoji, type, desc, rarity, effect
// type: weapon | ninjutsu | taijutsu | genjutsu | heal | chance
// rarity: common | uncommon | rare | epic
// effect: "heal" = +1 vie / "chance" = annule 1 défaite / autres = cosmétique + xp bonus futur
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

  // ── CHANCE ──
  { id:"omamori",    name:"Omamori Porte-Bonheur",emoji:"🎴", type:"chance",   rarity:"uncommon", desc:"Annule automatiquement une défaite. Usage unique.", effect:"chance" },
  { id:"talisman",   name:"Talisman de Jiraiya", emoji:"📿",  type:"chance",   rarity:"rare",     desc:"La chance du Sage. Annule une défaite.",             effect:"chance" },
];

// Poids de tirage par rareté (commun = plus fréquent)
const RARITY_WEIGHTS = { common:45, uncommon:30, rare:18, epic:7 };

// Correspondance type → classe CSS inventaire
const TYPE_CSS = {
  weapon:   "inv-item-weapon",
  ninjutsu: "inv-item-tech",
  taijutsu: "inv-item-tech",
  genjutsu: "inv-item-tech",
  heal:     "inv-item-heal",
  chance:   "inv-item-chance",
};

// Palettes couleurs des badges (7 palettes, choisies par hashStr % 7)
const BADGE_PALETTES = [
  ["#E8521A","#FF6B2B","#B83D0E"],
  ["#7C3AED","#A78BFA","#4C1D95"],
  ["#0891B2","#67E8F9","#164E63"],
  ["#DC2626","#FCA5A5","#7F1D1D"],
  ["#059669","#34D399","#064E3B"],
  ["#D97706","#FCD34D","#78350F"],
  ["#BE185D","#F9A8D4","#831843"],
];

// Palettes couleurs des roues (par index de roue)
const WHEEL_PALETTES = [
  ["#E8521A","#B83D0E","#F97316","#CC1A1A","#FF6B2B","#8B2500"], // Village
  ["#059669","#064E3B","#10B981","#047857","#34D399","#022C22"], // Personnage
  ["#7C3AED","#4C1D95","#8B5CF6","#6D28D9","#A78BFA","#2E1065"], // Antagoniste
  // Issue — couleurs spécifiques par outcome (utilise OUTCOMES[i].wheelColor)
  // Loot — couleurs par type
];

// Couleurs roue Loot par type d'item
const LOOT_WHEEL_COLORS = {
  weapon:   ["#B83D0E","#E8521A","#F97316"],
  ninjutsu: ["#1D4ED8","#3B82F6","#60a5fa"],
  taijutsu: ["#059669","#10B981","#34D399"],
  genjutsu: ["#7C3AED","#8B5CF6","#A78BFA"],
  heal:     ["#BE185D","#EC4899","#F9A8D4"],
  chance:   ["#D97706","#F59E0B","#FCD34D"],
};
