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

// Résultats de la roue Issue — ordre fixe pour la roue canvas
// xp = points de progression vers le rang suivant
// life = modification de vies (0 ou -1)
const OUTCOMES = [
  { short:"Victoire éclatante", emoji:"🏆", xp:3, life: 0, cls:"out-v", wheelColor:"#059669" },
  { short:"Victoire difficile", emoji:"⚔️",  xp:2, life: 0, cls:"out-h", wheelColor:"#D97706" },
  { short:"Match nul",          emoji:"🤝", xp:1, life: 0, cls:"out-d", wheelColor:"#1D4ED8" },
  { short:"Défaite",            emoji:"💀", xp:0, life:-1, cls:"out-x", wheelColor:"#7F1D1D" },
];

// Starters indexés par "periode.short-village.short"
const STARTERS = {
  "Classique-Konoha": ["Naruto Uzumaki","Sasuke Uchiha","Sakura Haruno","Rock Lee","Neji Hyûga","Hinata Hyûga","Shino Aburame","Kiba Inuzuka"],
  "Classique-Suna":   ["Gaara","Kankuro","Temari"],
  "Classique-Kiri":   ["Zabuza Momochi (jeune)","Haku (jeune)","Kisame (jeune)"],
  "Classique-Kumo":   ["Killer B (jeune)","Yugito Nii (jeune)"],
  "Classique-Iwa":    ["Kurotsuchi (jeune)","Akatsuchi (jeune)"],
  "Classique-Oto":    ["Dosu Kinuta","Zaku Abumi","Kin Tsuchi"],

  "Shippuden-Konoha": ["Naruto Uzumaki","Sakura Haruno","Sai","Yamato","Kakashi Hatake","Shikamaru Nara"],
  "Shippuden-Suna":   ["Gaara (Kazekage)","Temari","Kankuro"],
  "Shippuden-Kiri":   ["Mei Terumi","Chojuro","Ao"],
  "Shippuden-Kumo":   ["Killer B","A (Raikage)","Yugito Nii","Omoi","Karui"],
  "Shippuden-Iwa":    ["Onoki (Tsuchikage)","Kurotsuchi","Akatsuchi"],
  "Shippuden-Oto":    ["Kabuto Yakushi","Jugo","Suigetsu","Karin"],

  "The Last-Konoha":  ["Naruto Uzumaki","Hinata Hyûga","Sakura Haruno","Sai","Shikamaru","Lee","Tenten"],
  "The Last-Suna":    ["Gaara","Temari"],
  "The Last-Kiri":    ["Mei Terumi","Chojuro"],
  "The Last-Kumo":    ["Killer B","Omoi"],
  "The Last-Iwa":     ["Kurotsuchi"],
  "The Last-Oto":     ["Kabuto Yakushi (reclus)"],

  "Ère des Clans-Konoha": ["Hashirama Senju","Tobirama Senju","Madara Uchiha (jeune)"],
  "Ère des Clans-Suna":   ["Chef du clan du Sable","Guerrière du Vent"],
  "Ère des Clans-Kiri":   ["Premier Mizukage","Guerrier brumeux"],
  "Ère des Clans-Kumo":   ["Premier Raikage","Kumo no Senshi"],
  "Ère des Clans-Iwa":    ["Premier Tsuchikage","Guerrier de Roche"],
  "Ère des Clans-Oto":    ["Guerrier errant","Shinobi solitaire"],
};

const ANTAGONISTS = {
  "Classique":    ["Orochimaru","Zabuza Momochi","Kabuto Yakushi","Gato","Mizuki","Haku","Les frères Démon","Jirobo","Kidomaru","Tayuya","Sakon & Ukon","Kimimaro"],
  "Shippuden":    ["Pain / Nagato","Itachi Uchiha","Kisame Hoshigaki","Deidara","Sasori","Hidan","Kakuzu","Konan","Zetsu","Obito Uchiha","Madara Uchiha","Kabuto Yakushi","Sasuke Uchiha","Kaguya Otsutsuki"],
  "The Last":     ["Toneri Otsutsuki","Hamura Otsutsuki (vision)","Gardiens de la Lune"],
  "Ère des Clans":["Madara Uchiha","Kinkaku & Ginkaku","Chefs des clans rivaux","Esprit du Bijuu errant","Le démon des terres du vent"],
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
