/**
 * @file ui-svg.js
 * @module ui/svg
 * @description Génération des SVG procéduraux : badges antagonistes, emblèmes de rang.
 *              Extrait de ui.js lors du refactoring Phase 1.
 *
 * @dependencies
 *   - ../data.js  → BADGE_PALETTES (lecture seule)
 *   - ui-core.js  → hashStr()
 *
 * @exports (fonctions globales)
 *   - makeBadgeSvg(name, sz)
 *   - makeRankEmblem(rank, sz)
 */

// ── SVG GENERATION ────────────────────────────────────────────
/**
 * @description Génère procéduralement un badge SVG unique pour un antagoniste, dérivé
 *              de façon déterministe du hash de son nom : palette de couleurs
 *              (hashStr(name) % 7 dans BADGE_PALETTES), forme de fond (polygone
 *              hexagonal/cercle/losange/octogone), style des yeux, et symbole en bas du
 *              badge. Un même nom produit donc toujours exactement le même badge.
 *
 * SÉCURITÉ : SVG généré uniquement depuis hashStr(name) et des tableaux de constantes.
 *            Aucune entrée utilisateur interpolée directement dans les attributs SVG.
 *
 * @param {string} name    - Nom de l'antagoniste, utilisé uniquement pour dériver le hash
 * @param {number} [sz=110] - Taille du SVG en pixels (largeur = hauteur)
 *
 * @returns {string} Balisage SVG complet sous forme de chaîne, prêt à être assigné à
 *                   `innerHTML`
 */
function makeBadgeSvg(name, sz = 110) {
  const h  = hashStr(name);
  const [c1, c2, c3] = BADGE_PALETTES[h % BADGE_PALETTES.length];
  const cx = sz / 2, cy = sz / 2, r = sz / 2 - 4;
  const shp = h % 4, eye = (h >> 4) % 3, mrk = (h >> 8) % 4;
  let inn = "";

  // Forme de fond
  if (shp === 0) {
    const pts = R => Array.from({length:6}, (_, i) => {
      const a = Math.PI / 180 * (60 * i - 30);
      return `${(cx + R * Math.cos(a)).toFixed(1)},${(cy + R * Math.sin(a)).toFixed(1)}`;
    }).join(" ");
    inn += `<polygon points="${pts(r)}" fill="${c1}" stroke="${c3}" stroke-width="2"/>`;
    inn += `<polygon points="${pts(r-7)}" fill="none" stroke="${c2}" stroke-width="1" opacity=".4"/>`;
  } else if (shp === 1) {
    inn += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${c1}" stroke="${c3}" stroke-width="2"/>`;
    inn += `<circle cx="${cx}" cy="${cy}" r="${r-7}" fill="none" stroke="${c2}" stroke-width="1" opacity=".4"/>`;
  } else if (shp === 2) {
    inn += `<polygon points="${cx},4 ${sz-4},${cy} ${cx},${sz-4} 4,${cy}" fill="${c1}" stroke="${c3}" stroke-width="2"/>`;
  } else {
    const o = sz * .15;
    inn += `<polygon points="${o},4 ${sz-o},4 ${sz-4},${o} ${sz-4},${sz-o} ${sz-o},${sz-4} ${o},${sz-4} 4,${sz-o} 4,${o}" fill="${c1}" stroke="${c3}" stroke-width="2"/>`;
  }

  // Visage
  const fr = r * .42;
  inn += `<circle cx="${cx}" cy="${cy-3}" r="${fr}" fill="${c2}" opacity=".9"/>`;

  // Yeux
  const ey = cy - 3 - fr * .18, ex1 = cx - fr * .32, ex2 = cx + fr * .32, er = fr * .13;
  if (eye === 0) {
    inn += `<circle cx="${ex1}" cy="${ey}" r="${er}" fill="${c3}"/><circle cx="${ex2}" cy="${ey}" r="${er}" fill="${c3}"/>`;
    inn += `<circle cx="${ex1}" cy="${ey}" r="${er*.5}" fill="#fff"/><circle cx="${ex2}" cy="${ey}" r="${er*.5}" fill="#fff"/>`;
  } else if (eye === 1) {
    const ew = er * 1.4, eh = er * .5;
    inn += `<rect x="${ex1-ew}" y="${ey-eh}" width="${ew*2}" height="${eh*2}" rx="${eh*.4}" fill="${c1}" transform="rotate(-10,${ex1},${ey})"/>`;
    inn += `<rect x="${ex2-ew}" y="${ey-eh}" width="${ew*2}" height="${eh*2}" rx="${eh*.4}" fill="${c1}" transform="rotate(10,${ex2},${ey})"/>`;
  } else {
    inn += `<circle cx="${ex1}" cy="${ey}" r="${er}" fill="#9B59B6"/><circle cx="${ex2}" cy="${ey}" r="${er}" fill="#9B59B6"/>`;
    inn += `<circle cx="${ex1}" cy="${ey}" r="${er*.35}" fill="#fff"/><circle cx="${ex2}" cy="${ey}" r="${er*.35}" fill="#fff"/>`;
  }

  // Bouche
  const my = cy - 3 + fr * .3;
  inn += `<line x1="${cx-fr*.26}" y1="${my}" x2="${cx+fr*.26}" y2="${my}" stroke="${c1}" stroke-width="${fr*.09}" stroke-linecap="round"/>`;

  // Symbole
  const mc = cx, mcy2 = cy + fr * 1.08;
  if (mrk === 0) inn += `<polygon points="${mc},${mcy2-8} ${mc+7},${mcy2+4} ${mc-7},${mcy2+4}" fill="${c2}" opacity=".85"/>`;
  else if (mrk === 1) inn += `<text x="${mc}" y="${mcy2+6}" text-anchor="middle" font-size="14" fill="${c2}" opacity=".9" font-family="serif">☯</text>`;
  else if (mrk === 2) inn += `<text x="${mc}" y="${mcy2+6}" text-anchor="middle" font-size="14" fill="${c2}" opacity=".9">✦</text>`;
  else inn += `<line x1="${mc-7}" y1="${mcy2}" x2="${mc+7}" y2="${mcy2}" stroke="${c2}" stroke-width="2" opacity=".7"/><line x1="${mc}" y1="${mcy2-7}" x2="${mc}" y2="${mcy2+7}" stroke="${c2}" stroke-width="2" opacity=".7"/>`;

  return `<svg width="${sz}" height="${sz}" viewBox="0 0 ${sz} ${sz}" xmlns="http://www.w3.org/2000/svg">${inn}</svg>`;
}

/**
 * @description Génère le SVG de l'emblème d'un rang (cercle Genin, pentagone Chûnin,
 *              triangle Jônin, cercle double Kage), avec le kanji du rang au centre et
 *              sa couleur associée.
 *
 * SÉCURITÉ : SVG généré depuis les constantes de RANKS uniquement, aucune entrée
 *            utilisateur interpolée.
 *
 * @param {RankData} rank - Entrée de RANKS (utilise rank.name et rank.color)
 * @param {number}   sz   - Taille du SVG en pixels (largeur = hauteur)
 *
 * @returns {string} Balisage SVG complet sous forme de chaîne, prêt à être assigné à
 *                   `innerHTML`. Repli sur l'emblème "Genin" si rank.name est inconnu.
 */
function makeRankEmblem(rank, sz) {
  const cx = sz/2, cy = sz/2, r = sz/2-3, c = rank.color;
  const emblems = {
    "Genin":  `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${c}22" stroke="${c}" stroke-width="2"/><text x="${cx}" y="${cy+sz*.1}" text-anchor="middle" font-size="${sz*.32}" fill="${c}" font-family="serif">忍</text>`,
    "Chûnin": `<polygon points="${cx},3 ${sz-3},${cy+r*.5} ${cx+r*.8},${sz-3} ${cx-r*.8},${sz-3} 3,${cy+r*.5}" fill="${c}22" stroke="${c}" stroke-width="2"/><text x="${cx}" y="${cy+sz*.1}" text-anchor="middle" font-size="${sz*.3}" fill="${c}" font-family="serif">中</text>`,
    "Jônin":  `<polygon points="${cx},2 ${sz-2},${sz-2} 2,${sz-2}" fill="${c}22" stroke="${c}" stroke-width="2"/><text x="${cx}" y="${cy+sz*.14}" text-anchor="middle" font-size="${sz*.28}" fill="${c}" font-family="serif">上</text>`,
    "Kage":   `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${c}33" stroke="${c}" stroke-width="3"/><circle cx="${cx}" cy="${cy}" r="${r-5}" fill="none" stroke="${c}" stroke-width="1" opacity=".4"/><text x="${cx}" y="${cy+sz*.1}" text-anchor="middle" font-size="${sz*.3}" fill="${c}" font-family="serif">影</text>`,
  };
  return emblems[rank.name] || emblems["Genin"];
}
