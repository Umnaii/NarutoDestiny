/* ============================================================
   NARUTO DESTINY WHEEL — wheel.js
   Moteur de dessin et d'animation des roues canvas.
   SÉCURITÉ : ne manipule que des données constantes de DATA.
              Aucune valeur utilisateur dans les canvas.
   ============================================================ */

const WheelEngine = (() => {
  const PS = SZ / 380; // facteur d'échelle par rapport à la taille de référence d'origine (380px),
                       // utilisé pour agrandir proportionnellement le pointeur, les traits et les polices.

  // ── Dessin d'une roue ────────────────────────────────────────
  // weights (optionnel) : tableau parallèle à items donnant le poids relatif
  // de chaque segment. Si fourni, la part angulaire de chaque segment est
  // proportionnelle à son poids (roue "honnête" — la surface reflète la
  // vraie probabilité). Sans weights, tous les segments sont égaux.
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

  // Angle de rotation nécessaire pour que le pointeur (fixe, en haut, -π/2)
  // tombe pile au milieu du segment targetIndex, compte tenu des poids
  // (segments non uniformes → même logique que draw() pour rester cohérent
  // entre ce qui est dessiné et ce qui est réellement tiré).
  function _targetBaseAngle(weights, targetIndex) {
    const total = weights.reduce((s, x) => s + x, 0) || 1;
    let cum = 0;
    for (let i = 0; i < targetIndex; i++) cum += (weights[i] / total) * Math.PI * 2;
    const arcSize = (weights[targetIndex] / total) * Math.PI * 2;
    return -Math.PI / 2 - (cum + arcSize / 2);
  }

  // ── Animation de spin ────────────────────────────────────────
  // Retourne une Promise qui résout avec l'index de l'item sélectionné
  function spin({ canvasId, items, colors, startRotation, onFrame }) {
    return new Promise(resolve => {
      const n = items.length;
      const weights = new Array(n).fill(1); // roue générique : segments égaux
      const targetIndex = Math.floor(Math.random() * n);

      const baseAngle = _targetBaseAngle(weights, targetIndex);
      const extraSpins = (6 + Math.floor(Math.random() * 5)) * 2 * Math.PI;
      const finalRotation = baseAngle + extraSpins;

      const duration = 3200 + Math.random() * 1400;
      const t0 = performance.now();

      function ease(t) { return 1 - Math.pow(1 - t, 4); }

      function frame(now) {
        const t = Math.min((now - t0) / duration, 1);
        const cur = startRotation + (finalRotation - startRotation) * ease(t);
        draw(canvasId, items, colors, cur, weights);
        if (onFrame) onFrame(cur);
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

  function _weightedRandomFromWeights(items) {
    const total = items.reduce((s, it) => s + it.weight, 0);
    let r = Math.random() * total;
    for (let i = 0; i < items.length; i++) {
      r -= items[i].weight;
      if (r <= 0) return i;
    }
    return items.length - 1;
  }

  // ── Roue Issue (3 segments, poids dynamiques) ────────────────
  // weights = tableau retourné par Engine.computeIssueWeights()
  // La roue est dessinée à parts égales tant qu'aucun poids concret n'est
  // encore connu (état initial avant le calcul des probabilités du combat).
  function drawIssue(canvasId, rotation) {
    const items  = OUTCOMES.map(o => o.short);
    const colors = OUTCOMES.map(o => o.wheelColor);
    draw(canvasId, items, colors, rotation);
  }

  // weights : [{ short, wheelColor, weight, ... }, ...] depuis Engine.computeIssueWeights()
  // Les parts de la roue sont proportionnelles aux poids réels : une issue
  // à 60% occupe 60% du cercle.
  function spinIssue({ canvasId, startRotation, weights, onFrame }) {
    const items  = weights.map(o => o.short);
    const colors = weights.map(o => o.wheelColor);
    const w      = weights.map(o => o.weight);
    const targetIndex = _weightedRandomFromWeights(weights);
    const baseAngle = _targetBaseAngle(w, targetIndex);
    const finalRotation = baseAngle + (6 + Math.floor(Math.random() * 5)) * 2 * Math.PI;
    const duration = 3200 + Math.random() * 1400;
    const t0 = performance.now();
    function ease(t) { return 1 - Math.pow(1 - t, 4); }

    return new Promise(resolve => {
      function frame(now) {
        const t = Math.min((now - t0) / duration, 1);
        const cur = startRotation + (finalRotation - startRotation) * ease(t);
        draw(canvasId, items, colors, cur, w);
        if (onFrame) onFrame(cur);
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

  // ── Roue Loot ────────────────────────────────────────────────
  // Sélection pondérée par rareté + couleur par type ; les parts dessinées
  // suivent aussi ces poids (les objets rares occupent visiblement moins
  // de place que les communs).
  function getLootWheelData(pool) {
    // pool = sous-ensemble du LOOT_POOL déjà filtré
    return pool.map(item => ({
      label: item.name,
      color: LOOT_WHEEL_COLORS[item.type]
        ? LOOT_WHEEL_COLORS[item.type][Math.floor(Math.random() * 3)]
        : "#444",
      weight: RARITY_WEIGHTS[item.rarity],
    }));
  }

  function drawLoot(canvasId, pool, rotation) {
    const data = getLootWheelData(pool);
    draw(canvasId, data.map(d => d.label), data.map(d => d.color), rotation, data.map(d => d.weight));
    return data;
  }

  function spinLoot({ canvasId, pool, startRotation, onFrame }) {
    const data = getLootWheelData(pool);
    const items  = data.map(d => d.label);
    const colors = data.map(d => d.color);
    const w      = data.map(d => d.weight);
    const targetIndex = _weightedRandomFromWeights(data);
    const baseAngle = _targetBaseAngle(w, targetIndex);
    const finalRotation = baseAngle + (6 + Math.floor(Math.random() * 5)) * 2 * Math.PI;
    const duration = 3000 + Math.random() * 1200;
    const t0 = performance.now();
    function ease(t) { return 1 - Math.pow(1 - t, 4); }

    return new Promise(resolve => {
      function frame(now) {
        const t = Math.min((now - t0) / duration, 1);
        const cur = startRotation + (finalRotation - startRotation) * ease(t);
        draw(canvasId, items, colors, cur, w);
        if (onFrame) onFrame(cur);
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

  // ── Roue générique (village, perso, antagoniste) ─────────────
  // Segments égaux : chaque candidat a la même probabilité, donc la même part.
  function drawGeneric(canvasId, items, paletteIdx, rotation) {
    const pal = WHEEL_PALETTES[paletteIdx] || WHEEL_PALETTES[0];
    const colors = items.map((_, i) => pal[i % pal.length]);
    draw(canvasId, items, colors, rotation);
  }

  function spinGeneric({ canvasId, items, paletteIdx, startRotation, onFrame }) {
    const pal = WHEEL_PALETTES[paletteIdx] || WHEEL_PALETTES[0];
    const colors = items.map((_, i) => pal[i % pal.length]);
    return spin({ canvasId, items, colors, startRotation, onFrame });
  }

  return { draw, drawGeneric, spinGeneric, drawIssue, spinIssue, drawLoot, spinLoot, SZ };
})();
