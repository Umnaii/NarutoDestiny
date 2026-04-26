/* ============================================================
   NARUTO DESTINY WHEEL — wheel.js
   Moteur de dessin et d'animation des roues canvas.
   SÉCURITÉ : ne manipule que des données constantes de DATA.
              Aucune valeur utilisateur dans les canvas.
   ============================================================ */

const WheelEngine = (() => {
  const SZ = 280; // taille logique canvas (px)

  // ── Dessin d'une roue ────────────────────────────────────────
  function draw(canvasId, items, colors, rotation) {
    const cv = document.getElementById(canvasId);
    if (!cv) return;
    const ctx = cv.getContext("2d");
    const n = items.length;
    if (!n) return;

    const cx = SZ / 2, cy = SZ / 2, r = SZ / 2 - 4;
    const arc = (2 * Math.PI) / n;

    ctx.clearRect(0, 0, SZ, SZ);

    for (let i = 0; i < n; i++) {
      const sa = rotation + i * arc;
      const ea = sa + arc;

      // Segment
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, r, sa, ea);
      ctx.closePath();
      ctx.fillStyle = colors[i % colors.length];
      ctx.fill();
      ctx.strokeStyle = "rgba(0,0,0,.4)";
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Texte
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(sa + arc / 2);
      ctx.textAlign = "right";
      ctx.fillStyle = "#fff";
      ctx.shadowColor = "rgba(0,0,0,.85)";
      ctx.shadowBlur = 4;

      const fs = n <= 4 ? 14 : n <= 7 ? 12 : 10;
      ctx.font = `700 ${fs}px Rajdhani, sans-serif`;

      const maxW = r - 26;
      let lbl = items[i];
      // Tronquer si trop long
      while (ctx.measureText(lbl).width > maxW && lbl.length > 3) {
        lbl = lbl.slice(0, -1);
      }
      if (lbl !== items[i]) lbl += "…";

      ctx.fillText(lbl, r - 12, fs / 3);
      ctx.restore();
    }

    // Anneau extérieur
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(232,82,26,.52)";
    ctx.lineWidth = 3;
    ctx.stroke();
  }

  // ── Animation de spin ────────────────────────────────────────
  // Retourne une Promise qui résout avec l'index de l'item sélectionné
  function spin({ canvasId, items, colors, startRotation, onFrame }) {
    return new Promise(resolve => {
      const n = items.length;
      const targetIndex = _weightedRandom(items);
      const arc = (2 * Math.PI) / n;

      // Angle final : le pointeur (haut, -π/2) doit pointer sur targetIndex
      const baseAngle = -Math.PI / 2 - arc / 2 - targetIndex * arc;
      const extraSpins = (6 + Math.floor(Math.random() * 5)) * 2 * Math.PI;
      const finalRotation = baseAngle + extraSpins;

      const duration = 3200 + Math.random() * 1400;
      const t0 = performance.now();

      function ease(t) { return 1 - Math.pow(1 - t, 4); }

      function frame(now) {
        const t = Math.min((now - t0) / duration, 1);
        const cur = startRotation + (finalRotation - startRotation) * ease(t);
        draw(canvasId, items, colors, cur);
        if (onFrame) onFrame(cur);
        if (t < 1) {
          requestAnimationFrame(frame);
        } else {
          draw(canvasId, items, colors, finalRotation);
          if (onFrame) onFrame(finalRotation);
          resolve({ targetIndex, finalRotation });
        }
      }
      requestAnimationFrame(frame);
    });
  }

  // Roue Issue : poids pondérés (défaite moins fréquente que victoire)
  // Roue loot : tous items équiprobables → override possible via items.weight
  function _weightedRandom(items) {
    // Si les items ont une propriété weight, on l'utilise
    const hasWeights = items.length > 0 && items[0] && typeof items[0] === "object" && "weight" in items[0];
    if (!hasWeights) return Math.floor(Math.random() * items.length);

    const total = items.reduce((s, it) => s + it.weight, 0);
    let r = Math.random() * total;
    for (let i = 0; i < items.length; i++) {
      r -= items[i].weight;
      if (r <= 0) return i;
    }
    return items.length - 1;
  }

  // ── Roue Issue (pondérée) ────────────────────────────────────
  // Items attendus : tableau d'objets { short, wheelColor, weight }
  function drawIssue(canvasId, rotation) {
    const items  = OUTCOMES.map(o => o.short);
    const colors = OUTCOMES.map(o => o.wheelColor);
    draw(canvasId, items, colors, rotation);
  }

  function spinIssue({ canvasId, startRotation, onFrame }) {
    // Poids : victoire éclatante=35, victoire difficile=30, match nul=20, défaite=15
    const weighted = OUTCOMES.map((o, i) => {
      const weights = [35, 30, 20, 15];
      return { ...o, weight: weights[i] };
    });
    const items  = weighted.map(o => o.short);
    const colors = weighted.map(o => o.wheelColor);
    const n = items.length;
    const targetIndex = _weightedRandomFromWeights(weighted);
    const arc = (2 * Math.PI) / n;
    const baseAngle = -Math.PI / 2 - arc / 2 - targetIndex * arc;
    const finalRotation = baseAngle + (6 + Math.floor(Math.random() * 5)) * 2 * Math.PI;
    const duration = 3200 + Math.random() * 1400;
    const t0 = performance.now();
    function ease(t) { return 1 - Math.pow(1 - t, 4); }

    return new Promise(resolve => {
      function frame(now) {
        const t = Math.min((now - t0) / duration, 1);
        const cur = startRotation + (finalRotation - startRotation) * ease(t);
        draw(canvasId, items, colors, cur);
        if (onFrame) onFrame(cur);
        if (t < 1) { requestAnimationFrame(frame); }
        else {
          draw(canvasId, items, colors, finalRotation);
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

  // ── Roue Loot ────────────────────────────────────────────────
  // Sélection pondérée par rareté + couleur par type
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
    draw(canvasId, data.map(d => d.label), data.map(d => d.color), rotation);
    return data;
  }

  function spinLoot({ canvasId, pool, startRotation, onFrame }) {
    const data = getLootWheelData(pool);
    const items  = data.map(d => d.label);
    const colors = data.map(d => d.color);
    const n = items.length;
    const targetIndex = _weightedRandomFromWeights(data);
    const arc = (2 * Math.PI) / n;
    const baseAngle = -Math.PI / 2 - arc / 2 - targetIndex * arc;
    const finalRotation = baseAngle + (6 + Math.floor(Math.random() * 5)) * 2 * Math.PI;
    const duration = 3000 + Math.random() * 1200;
    const t0 = performance.now();
    function ease(t) { return 1 - Math.pow(1 - t, 4); }

    return new Promise(resolve => {
      function frame(now) {
        const t = Math.min((now - t0) / duration, 1);
        const cur = startRotation + (finalRotation - startRotation) * ease(t);
        draw(canvasId, items, colors, cur);
        if (onFrame) onFrame(cur);
        if (t < 1) { requestAnimationFrame(frame); }
        else {
          draw(canvasId, items, colors, finalRotation);
          if (onFrame) onFrame(finalRotation);
          resolve({ targetIndex, finalRotation, lootItem: pool[targetIndex] });
        }
      }
      requestAnimationFrame(frame);
    });
  }

  // ── Roue générique (village, perso, antagoniste) ─────────────
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
