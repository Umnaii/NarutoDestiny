/**
 * @file wheel.js
 * @module wheel
 * @description Moteur de dessin Canvas et d'animation des roues du destin. Fournit un
 *              dessin générique (draw) et des variantes spécialisées par type de roue
 *              (Issue, Loot, générique) qui préparent items/couleurs/poids puis délèguent
 *              à draw()/spin(). Ne connaît rien de l'état du jeu — reçoit toutes ses
 *              données en paramètres depuis ui-round.js.
 *
 * @dependencies
 *   - data.js → WHEEL_PALETTES, LOOT_WHEEL_COLORS, RARITY_WEIGHTS (via getLootWheelData)
 *
 * @exports (objet WheelEngine)
 *   - draw, drawGeneric, spinGeneric, spinIssue, drawLoot, spinLoot, SZ
 *
 * @sideEffects
 *   - Manipule directement le DOM : lit le canvas via document.getElementById(canvasId)
 *     et dessine dedans avec l'API Canvas 2D. Les fonctions spin*() enchaînent des
 *     requestAnimationFrame jusqu'à résolution de la Promise retournée.
 *
 * SÉCURITÉ : ne manipule que des données constantes de DATA.
 *            Aucune valeur utilisateur dans les canvas.
 */

const WheelEngine = (() => {
  const SZ = 640; // taille logique canvas (px) — alignée sur la nouvelle taille d'affichage (voir .stack-wrap)
  const PS = SZ / 380; // facteur d'échelle par rapport à la taille de référence d'origine (380px),
                       // utilisé pour agrandir proportionnellement le pointeur, les traits et les polices.

  /**
   * @description Dessine une roue complète sur un canvas : segments (répartis
   *              proportionnellement aux poids si fournis, sinon à parts égales),
   *              libellés adaptés à l'angle du segment, anneau extérieur, et pointeur
   *              fixe en haut. Fonction bas niveau utilisée par toutes les variantes
   *              drawLoot/drawGeneric et par les animations spin*().
   *
   * @param {string}   canvasId - id de l'élément <canvas> cible dans le DOM
   * @param {string[]} items    - Libellés affichés dans chaque segment
   * @param {string[]} colors   - Couleurs hex des segments (recyclées si plus courtes que items)
   * @param {number}   rotation - Angle de rotation courant de la roue, en radians
   * @param {number[]} [weights] - Poids relatif de chaque segment (même longueur que
   *                              items). Si omis, tous les segments ont la même taille.
   *
   * @returns {undefined} Ne retourne rien — dessine directement sur le canvas.
   *
   * @sideEffects
   *   Efface et redessine le contenu du canvas #`canvasId`. Ne fait rien si le canvas
   *   est introuvable ou si `items` est vide.
   */
  function draw(canvasId, items, colors, rotation, weights) {
    const cv = document.getElementById(canvasId);
    if (!cv) return;
    const ctx = cv.getContext("2d");
    const n = items.length;
    if (!n) return;

    // Rendu net sur écrans HiDPI/Retina : le canvas physique est dimensionné
    // à SZ * devicePixelRatio (voir ui.js), on remet le repère logique à SZ
    // à chaque frame pour éviter tout flou de texte dû au sur-échantillonnage.
    const dpr = window.devicePixelRatio || 1;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const cx = SZ / 2, cy = SZ / 2, r = SZ / 2 - 4;
    const w = (weights && weights.length === n) ? weights : new Array(n).fill(1);
    const total = w.reduce((s, x) => s + x, 0) || 1;
    const arcs = w.map(x => (x / total) * Math.PI * 2);

    ctx.clearRect(0, 0, SZ, SZ);

    let cum = 0;
    for (let i = 0; i < n; i++) {
      const arcSize = arcs[i];
      const sa = rotation + cum;
      const ea = sa + arcSize;
      cum += arcSize;

      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, r, sa, ea);
      ctx.closePath();
      ctx.fillStyle = colors[i % colors.length];
      ctx.fill();
      ctx.strokeStyle = "rgba(0,0,0,.4)";
      ctx.lineWidth = 1.5 * PS;
      ctx.stroke();

      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(sa + arcSize / 2);
      ctx.textAlign = "right";
      ctx.fillStyle = "#fff";
      ctx.shadowColor = "rgba(0,0,0,.85)";
      ctx.shadowBlur = 4 * PS;

      // Taille de police adaptée à l'angle du segment (les petites parts
      // ont un texte plus discret pour ne pas déborder).
      const arcDeg = arcSize * (180 / Math.PI);
      const fs = Math.round((arcDeg >= 70 ? 20 : arcDeg >= 40 ? 16 : arcDeg >= 22 ? 13 : 11) * PS);
      ctx.font = `700 ${fs}px Rajdhani, sans-serif`;

      // Largeur max approx. par la corde du segment à mi-rayon, plus la marge radiale
      const maxW = Math.max(24 * PS, Math.min(r - 32 * PS, r * arcSize * 0.72));
      let lbl = items[i];
      while (ctx.measureText(lbl).width > maxW && lbl.length > 3) lbl = lbl.slice(0, -1);
      if (lbl !== items[i]) lbl += "…";
      ctx.fillText(lbl, r - 12 * PS, fs / 3);
      ctx.restore();
    }

    // Anneau extérieur
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(232,82,26,.52)";
    ctx.lineWidth = 3 * PS;
    ctx.stroke();

    // ── Pointeur fixe en haut ────────────────────────────────────
    // Dessiné par-dessus la roue, toujours visible, pointe vers 12h
    const pW = 18 * PS;  // demi-largeur base
    const pTipY = 8 * PS;      // pointe Y (haut)
    const pBaseY = pTipY + 38 * PS; // base Y

    // Ombre portée
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,.6)";
    ctx.shadowBlur  = 8 * PS;
    ctx.shadowOffsetY = 2 * PS;

    // Corps du pointeur (triangle)
    ctx.beginPath();
    ctx.moveTo(cx,        pTipY);      // pointe
    ctx.lineTo(cx - pW,   pBaseY);     // bas gauche
    ctx.lineTo(cx + pW,   pBaseY);     // bas droite
    ctx.closePath();
    ctx.fillStyle = "#E8521A";
    ctx.fill();

    // Contour sombre
    ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
    ctx.strokeStyle = "#7A2000";
    ctx.lineWidth = 2 * PS;
    ctx.stroke();

    // Reflet interne (dégradé)
    const grad = ctx.createLinearGradient(cx - pW, pTipY, cx + pW, pBaseY);
    grad.addColorStop(0,   "rgba(255,255,255,.35)");
    grad.addColorStop(1,   "rgba(255,255,255,0)");
    ctx.beginPath();
    ctx.moveTo(cx,        pTipY);
    ctx.lineTo(cx - pW,   pBaseY);
    ctx.lineTo(cx + pW,   pBaseY);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();

    // Rivet central (petit cercle au-dessus de la pointe)
    ctx.beginPath();
    ctx.arc(cx, pBaseY, 6 * PS, 0, Math.PI * 2);
    ctx.fillStyle = "#FF6B2B";
    ctx.fill();
    ctx.strokeStyle = "#7A2000";
    ctx.lineWidth = 1.5 * PS;
    ctx.stroke();

    ctx.restore();
  }

  /**
   * @description Calcule l'angle de rotation nécessaire pour que le pointeur fixe
   *              (en haut, -π/2) tombe pile au milieu du segment `targetIndex`, compte
   *              tenu des poids relatifs des segments — la même logique de répartition
   *              angulaire que draw(), pour garantir que la roue affichée coïncide avec
   *              le résultat réellement tiré.
   *
   * @param {number[]} weights     - Poids relatif de chaque segment
   * @param {number}   targetIndex - Index du segment visé
   *
   * @returns {number} Angle de base en radians (sans les tours supplémentaires
   *                   d'animation, ajoutés séparément par les fonctions spin*())
   */
  function _targetBaseAngle(weights, targetIndex) {
    const total = weights.reduce((s, x) => s + x, 0) || 1;
    let cum = 0;
    for (let i = 0; i < targetIndex; i++) cum += (weights[i] / total) * Math.PI * 2;
    const arcSize = (weights[targetIndex] / total) * Math.PI * 2;
    return -Math.PI / 2 - (cum + arcSize / 2);
  }

  /**
   * @description Détermine l'index du segment actuellement aligné avec le pointeur fixe
   *              (en haut, -π/2) pour un angle de rotation donné — même répartition
   *              angulaire que draw()/_targetBaseAngle(), afin de rester cohérent avec ce
   *              qui est visuellement affiché. Utilisé par les fonctions spin*() pour
   *              détecter les changements de segment sous le pointeur pendant l'animation
   *              (voir le paramètre `onTick` de spin()/spinIssue()/spinLoot()) et
   *              déclencher un tic sonore synchronisé.
   *
   * @param {number[]} weights  - Poids relatif de chaque segment
   * @param {number}   rotation - Angle de rotation courant, en radians
   *
   * @returns {number} Index du segment sous le pointeur (-1 si `weights` est vide)
   */
  function _segmentAtPointer(weights, rotation) {
    const n = weights.length;
    if (!n) return -1;
    const total = weights.reduce((s, x) => s + x, 0) || 1;
    const TWO_PI = Math.PI * 2;
    let local = (-Math.PI / 2 - rotation) % TWO_PI;
    if (local < 0) local += TWO_PI;
    let cum = 0;
    for (let i = 0; i < n; i++) {
      const arc = (weights[i] / total) * TWO_PI;
      if (local < cum + arc) return i;
      cum += arc;
    }
    return n - 1;
  }

  /**
   * @description Anime le spin d'une roue à segments égaux (utilisée pour les roues
   *              "générique" : personnage, antagoniste) : tire un index cible aléatoire,
   *              calcule une rotation finale (angle cible + 6 à 10 tours complets), puis
   *              anime la rotation sur 3200-4600ms avec un easing "ease-out" quartique,
   *              en redessinant la roue à chaque frame.
   *
   * @param {Object}   params
   * @param {string}   params.canvasId      - id du canvas cible
   * @param {string[]} params.items         - Libellés des segments (tous de poids égal)
   * @param {string[]} params.colors        - Couleurs des segments
   * @param {number}   params.startRotation - Angle de départ de l'animation, en radians
   * @param {function} [params.onFrame]     - Callback appelé à chaque frame avec l'angle courant
   * @param {function} [params.onTick]      - Callback appelé uniquement quand le segment
   *                                          sous le pointeur change (voir
   *                                          _segmentAtPointer()) — sert à synchroniser un
   *                                          tic sonore sur les changements de résultat
   *                                          affiché, pas sur chaque frame
   *
   * @returns {Promise<Object>} Résout avec `{ targetIndex, finalRotation }` une fois
   *                            l'animation terminée
   *
   * @sideEffects
   *   Enchaîne des requestAnimationFrame qui redessinent le canvas #`canvasId`
   */
  function spin({ canvasId, items, colors, startRotation, onFrame, onTick }) {
    return new Promise(resolve => {
      const n = items.length;
      const weights = new Array(n).fill(1); // roue générique : segments égaux
      const targetIndex = Math.floor(Math.random() * n);

      const baseAngle = _targetBaseAngle(weights, targetIndex);
      const extraSpins = (6 + Math.floor(Math.random() * 5)) * 2 * Math.PI;
      const finalRotation = baseAngle + extraSpins;

      const duration = 3200 + Math.random() * 1400;
      const t0 = performance.now();
      let lastSeg = _segmentAtPointer(weights, startRotation);

      function ease(t) { return 1 - Math.pow(1 - t, 4); }

      function frame(now) {
        const t = Math.min((now - t0) / duration, 1);
        const cur = startRotation + (finalRotation - startRotation) * ease(t);
        draw(canvasId, items, colors, cur, weights);
        if (onFrame) onFrame(cur);
        if (onTick) {
          const seg = _segmentAtPointer(weights, cur);
          if (seg !== lastSeg) { lastSeg = seg; onTick(seg); }
        }
        if (t < 1) {
          requestAnimationFrame(frame);
        } else {
          draw(canvasId, items, colors, finalRotation, weights);
          if (onFrame) onFrame(finalRotation);
          resolve({ targetIndex, finalRotation });
        }
      }
      requestAnimationFrame(frame);
    });
  }

  /**
   * @description Tire un index aléatoire parmi une liste d'objets pondérés, selon leur
   *              champ `weight` (probabilité proportionnelle au poids).
   *
   * @param {Array<{weight: number}>} items - Objets avec un champ numérique `weight`
   *
   * @returns {number} Index tiré dans `items` (toujours valide même en cas d'arrondi
   *                   flottant — repli sur le dernier index)
   */
  function _weightedRandomFromWeights(items) {
    const total = items.reduce((s, it) => s + it.weight, 0);
    let r = Math.random() * total;
    for (let i = 0; i < items.length; i++) {
      r -= items[i].weight;
      if (r <= 0) return i;
    }
    return items.length - 1;
  }

  /**
   * @description Anime le spin de la roue de combat ("Issue"), avec des parts
   *              proportionnelles aux poids réels fournis par Engine.computeIssueWeights()
   *              — une issue à 60% de chance occupe 60% du cercle. Même fonction
   *              utilisée pour la roue d'examen (ui-round.js lui passe les poids
   *              d'EXAMEN_OUTCOMES via Engine.computeExamenWeights()).
   *
   * @param {Object}   params
   * @param {string}   params.canvasId      - id du canvas cible
   * @param {number}   params.startRotation - Angle de départ, en radians
   * @param {Object[]} params.weights       - Résultats pondérés (`{short, wheelColor, weight}`)
   *                                          depuis Engine.computeIssueWeights()/computeExamenWeights()
   * @param {function} [params.onFrame]     - Callback appelé à chaque frame avec l'angle courant
   * @param {function} [params.onTick]      - Callback appelé uniquement quand le segment
   *                                          sous le pointeur change (voir spin())
   *
   * @returns {Promise<Object>} Résout avec `{ targetIndex, finalRotation }`
   *
   * @sideEffects
   *   Enchaîne des requestAnimationFrame qui redessinent le canvas #`canvasId`
   */
  function spinIssue({ canvasId, startRotation, weights, onFrame, onTick }) {
    const items  = weights.map(o => o.short);
    const colors = weights.map(o => o.wheelColor);
    const w      = weights.map(o => o.weight);
    const targetIndex = _weightedRandomFromWeights(weights);
    const baseAngle = _targetBaseAngle(w, targetIndex);
    const finalRotation = baseAngle + (6 + Math.floor(Math.random() * 5)) * 2 * Math.PI;
    const duration = 3200 + Math.random() * 1400;
    const t0 = performance.now();
    let lastSeg = _segmentAtPointer(w, startRotation);
    function ease(t) { return 1 - Math.pow(1 - t, 4); }

    return new Promise(resolve => {
      function frame(now) {
        const t = Math.min((now - t0) / duration, 1);
        const cur = startRotation + (finalRotation - startRotation) * ease(t);
        draw(canvasId, items, colors, cur, w);
        if (onFrame) onFrame(cur);
        if (onTick) {
          const seg = _segmentAtPointer(w, cur);
          if (seg !== lastSeg) { lastSeg = seg; onTick(seg); }
        }
        if (t < 1) { requestAnimationFrame(frame); }
        else {
          draw(canvasId, items, colors, finalRotation, w);
          if (onFrame) onFrame(finalRotation);
          resolve({ targetIndex, finalRotation });
        }
      }
      requestAnimationFrame(frame);
    });
  }

  /**
   * @description Prépare les données d'affichage de la roue "Butin" à partir d'un pool
   *              d'objets : libellé, couleur (choisie aléatoirement parmi les 3 teintes
   *              du type dans LOOT_WHEEL_COLORS, repli gris si type inconnu), et poids
   *              selon la rareté (RARITY_WEIGHTS) — les objets rares occupent donc
   *              visiblement moins de place sur la roue que les communs. Si un item
   *              porte un champ `forcedWeight` (voir Engine.buildKageLootPool()), ce
   *              poids explicite est utilisé à la place du poids par rareté — utile pour
   *              un objet fictif comme "Rien cette fois" dont la part doit être calculée
   *              précisément plutôt que dérivée d'une rareté.
   *
   * @param {Object[]} pool - Sous-ensemble de LOOT_POOL déjà filtré (voir
   *                          Engine.buildLootPool()/buildKageLootPool())
   *
   * @returns {Object[]} Un objet `{ label, color, weight }` par item du pool, dans le
   *                     même ordre
   */
  function getLootWheelData(pool) {
    // pool = sous-ensemble du LOOT_POOL déjà filtré
    return pool.map(item => ({
      label: item.name,
      color: LOOT_WHEEL_COLORS[item.type]
        ? LOOT_WHEEL_COLORS[item.type][Math.floor(Math.random() * 3)]
        : "#444",
      weight: item.forcedWeight != null ? item.forcedWeight : RARITY_WEIGHTS[item.rarity],
    }));
  }

  /**
   * @description Dessine la roue "Butin" pour un pool d'objets donné.
   *
   * @param {string}   canvasId - id du canvas cible
   * @param {Object[]} pool     - Sous-ensemble de LOOT_POOL à afficher
   * @param {number}   rotation - Angle de rotation à dessiner, en radians
   *
   * @returns {Object[]} Les données de roue calculées par getLootWheelData(pool)
   *                     (utile à l'appelant pour réutiliser les couleurs tirées)
   *
   * @sideEffects
   *   Redessine le canvas #`canvasId`
   */
  function drawLoot(canvasId, pool, rotation) {
    const data = getLootWheelData(pool);
    draw(canvasId, data.map(d => d.label), data.map(d => d.color), rotation, data.map(d => d.weight));
    return data;
  }

  /**
   * @description Anime le spin de la roue "Butin" : tire un objet pondéré par rareté
   *              et anime la rotation jusqu'à ce segment.
   *
   * @param {Object}   params
   * @param {string}   params.canvasId      - id du canvas cible
   * @param {Object[]} params.pool          - Sous-ensemble de LOOT_POOL à faire tourner
   * @param {number}   params.startRotation - Angle de départ, en radians
   * @param {function} [params.onFrame]     - Callback appelé à chaque frame avec l'angle courant
   * @param {function} [params.onTick]      - Callback appelé uniquement quand le segment
   *                                          sous le pointeur change (voir spin())
   *
   * @returns {Promise<Object>} Résout avec `{ targetIndex, finalRotation, lootItem }`
   *                            où `lootItem` est l'entrée de `pool` tirée
   *
   * @sideEffects
   *   Enchaîne des requestAnimationFrame qui redessinent le canvas #`canvasId`
   */
  function spinLoot({ canvasId, pool, startRotation, onFrame, onTick }) {
    const data = getLootWheelData(pool);
    const items  = data.map(d => d.label);
    const colors = data.map(d => d.color);
    const w      = data.map(d => d.weight);
    const targetIndex = _weightedRandomFromWeights(data);
    const baseAngle = _targetBaseAngle(w, targetIndex);
    const finalRotation = baseAngle + (6 + Math.floor(Math.random() * 5)) * 2 * Math.PI;
    const duration = 3000 + Math.random() * 1200;
    const t0 = performance.now();
    let lastSeg = _segmentAtPointer(w, startRotation);
    function ease(t) { return 1 - Math.pow(1 - t, 4); }

    return new Promise(resolve => {
      function frame(now) {
        const t = Math.min((now - t0) / duration, 1);
        const cur = startRotation + (finalRotation - startRotation) * ease(t);
        draw(canvasId, items, colors, cur, w);
        if (onFrame) onFrame(cur);
        if (onTick) {
          const seg = _segmentAtPointer(w, cur);
          if (seg !== lastSeg) { lastSeg = seg; onTick(seg); }
        }
        if (t < 1) { requestAnimationFrame(frame); }
        else {
          draw(canvasId, items, colors, finalRotation, w);
          if (onFrame) onFrame(finalRotation);
          resolve({ targetIndex, finalRotation, lootItem: pool[targetIndex] });
        }
      }
      requestAnimationFrame(frame);
    });
  }

  /**
   * @description Dessine une roue à segments égaux (personnage ou antagoniste) : chaque
   *              candidat a la même probabilité, donc la même part angulaire. La palette
   *              de couleurs est choisie dans WHEEL_PALETTES via `paletteIdx`.
   *
   * @param {string}   canvasId   - id du canvas cible
   * @param {string[]} items      - Libellés des segments
   * @param {number}   paletteIdx - Index dans WHEEL_PALETTES (repli sur la première
   *                                palette si hors limites)
   * @param {number}   rotation   - Angle de rotation à dessiner, en radians
   *
   * @sideEffects
   *   Redessine le canvas #`canvasId`
   */
  function drawGeneric(canvasId, items, paletteIdx, rotation) {
    const pal = WHEEL_PALETTES[paletteIdx] || WHEEL_PALETTES[0];
    const colors = items.map((_, i) => pal[i % pal.length]);
    draw(canvasId, items, colors, rotation);
  }

  /**
   * @description Anime le spin d'une roue à segments égaux (personnage ou antagoniste) —
   *              délègue à spin() après avoir résolu la palette de couleurs.
   *
   * @param {Object}   params
   * @param {string}   params.canvasId      - id du canvas cible
   * @param {string[]} params.items         - Libellés des segments
   * @param {number}   params.paletteIdx    - Index dans WHEEL_PALETTES
   * @param {number}   params.startRotation - Angle de départ, en radians
   * @param {function} [params.onFrame]     - Callback appelé à chaque frame avec l'angle courant
   * @param {function} [params.onTick]      - Callback appelé uniquement quand le segment
   *                                          sous le pointeur change (voir spin())
   *
   * @returns {Promise<Object>} Résout avec `{ targetIndex, finalRotation }`
   *
   * @sideEffects
   *   Enchaîne des requestAnimationFrame qui redessinent le canvas #`canvasId`
   */
  function spinGeneric({ canvasId, items, paletteIdx, startRotation, onFrame, onTick }) {
    const pal = WHEEL_PALETTES[paletteIdx] || WHEEL_PALETTES[0];
    const colors = items.map((_, i) => pal[i % pal.length]);
    return spin({ canvasId, items, colors, startRotation, onFrame, onTick });
  }

  return { draw, drawGeneric, spinGeneric, spinIssue, drawLoot, spinLoot, SZ };
})();
