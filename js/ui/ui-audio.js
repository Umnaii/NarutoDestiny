/**
 * @file ui-audio.js
 * @module ui/audio
 * @description Petits effets sonores synthétisés en direct via l'API Web Audio (aucun
 *              fichier audio à charger — respecte la CSP existante, qui n'autorise aucune
 *              ressource externe) : tic de roue synchronisé sur les changements de
 *              segment sous le pointeur (voir wheel.js → onTick), et courtes notes pour
 *              les événements clés (résultat de combat/examen, butin obtenu, promotion,
 *              victoire, game over). Tous les sons sont volontairement brefs et discrets,
 *              et peuvent être coupés via toggleSoundButton() (voir index.html — bouton
 *              son, sur l'écran village et en jeu).
 *
 * @dependencies
 *   - aucune
 *
 * @exports (fonctions globales)
 *   - playTickSound()
 *   - playResultSound(kind), playLootSound(), playPromotionSound(), playGameOverSound()
 *   - toggleSoundButton(), isSoundMuted()
 *
 * SÉCURITÉ : aucune ressource réseau, aucune donnée utilisateur — synthèse pure en RAM.
 */

let _audioCtx = null;
let _muted    = false;

/**
 * @description Retourne (et crée si besoin) le contexte audio partagé. Les navigateurs
 *              exigent un geste utilisateur pour démarrer l'audio — toutes les fonctions
 *              play*() de ce fichier ne sont appelées que depuis un clic (bouton
 *              "Tourner"/"Fuir"/etc.), ce qui satisfait cette contrainte.
 * @returns {?AudioContext} Le contexte partagé, ou null si l'API n'est pas disponible
 */
function _getAudioCtx() {
  if (!_audioCtx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    _audioCtx = new AC();
  }
  return _audioCtx;
}

/**
 * @description Joue une note synthétisée courte et discrète (enveloppe attaque rapide /
 *              chute exponentielle) — brique de base de tous les effets sonores de ce
 *              fichier. Ne fait rien si le son est coupé (voir toggleSoundButton()) ou si
 *              l'API Web Audio n'est pas disponible.
 *
 * @param {number} freq     - Fréquence de la note, en Hz
 * @param {number} duration - Durée totale de la note, en secondes
 * @param {string} [type="sine"] - Forme d'onde de l'oscillateur
 * @param {number} [peakGain=0.05] - Volume maximal (0-1) — volontairement bas
 * @param {number} [delay=0] - Délai avant de jouer la note, en secondes (pour enchaîner
 *                              plusieurs notes courtes à la suite)
 *
 * @sideEffects
 *   Crée et démarre un oscillateur temporaire sur le contexte audio partagé
 */
function _playTone(freq, duration, type, peakGain, delay) {
  if (_muted) return;
  const ctx = _getAudioCtx();
  if (!ctx) return;
  if (ctx.state === "suspended") ctx.resume();

  const t0   = ctx.currentTime + (delay || 0);
  const osc  = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type || "sine";
  osc.frequency.setValueAtTime(freq, t0);

  const peak = peakGain != null ? peakGain : 0.05;
  gain.gain.setValueAtTime(0, t0);
  gain.gain.linearRampToValueAtTime(peak, t0 + Math.min(0.015, duration / 4));
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);

  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(t0);
  osc.stop(t0 + duration + 0.02);
}

// ── TIC DE ROUE (synchronisé sur les changements de résultat) ─
/**
 * @description Joue un unique tic bref et sec (façon cliquet mécanique classique).
 *              Appelée par ui-round.js via le callback `onTick` de
 *              WheelEngine.spin()/spinIssue()/spinLoot() — une fois exactement à chaque
 *              fois que le résultat sous le pointeur change pendant la rotation, jamais
 *              en continu. Comme elle n'est déclenchée que par ces changements réels, elle
 *              s'arrête d'elle-même dès que la roue cesse de tourner : aucun état à
 *              nettoyer après coup.
 *
 * @sideEffects
 *   Joue une note très courte via _playTone()
 */
function playTickSound() {
  _playTone(1600, 0.03, "square", 0.045, 0);
}

// ── EFFETS SONORES D'ÉVÉNEMENTS ───────────────────────────────
/**
 * @description Joue un très court effet sonore pour le résultat d'un combat ou d'un
 *              examen : deux notes brèves ascendantes pour une réussite, une note neutre
 *              pour un match nul, deux notes brèves descendantes pour une défaite.
 *
 * @param {string} kind - "win" | "draw" | "loss"
 *
 * @sideEffects
 *   Joue 1 ou 2 notes via _playTone()
 */
function playResultSound(kind) {
  if (kind === "win") {
    _playTone(660, 0.12, "triangle", 0.06, 0);
    _playTone(880, 0.14, "triangle", 0.06, 0.1);
  } else if (kind === "loss") {
    _playTone(440, 0.14, "sine", 0.05, 0);
    _playTone(330, 0.18, "sine", 0.05, 0.11);
  } else {
    _playTone(520, 0.14, "sine", 0.045, 0);
  }
}

/**
 * @description Joue un court arpège façon "ramassage d'objet" quand le joueur obtient un
 *              vrai objet de butin (pas l'entrée "Rien cette fois" du mode défense de
 *              Kage — voir ui-round.js → spinCurrent()).
 *
 * @sideEffects
 *   Joue 3 notes brèves via _playTone()
 */
function playLootSound() {
  _playTone(523, 0.09, "triangle", 0.05, 0);
  _playTone(659, 0.09, "triangle", 0.05, 0.07);
  _playTone(784, 0.12, "triangle", 0.05, 0.14);
}

/**
 * @description Joue un court arpège triomphant pour une promotion de rang ou la victoire
 *              finale (rang Kage atteint).
 *
 * @sideEffects
 *   Joue 4 notes brèves via _playTone()
 */
function playPromotionSound() {
  _playTone(523, 0.1, "triangle", 0.06, 0);
  _playTone(659, 0.1, "triangle", 0.06, 0.09);
  _playTone(784, 0.1, "triangle", 0.06, 0.18);
  _playTone(1047,0.16, "triangle", 0.06, 0.27);
}

/**
 * @description Joue un court ton grave et descendant pour le game over.
 *
 * @sideEffects
 *   Joue 2 notes brèves via _playTone()
 */
function playGameOverSound() {
  _playTone(300, 0.22, "sawtooth", 0.05, 0);
  _playTone(180, 0.28, "sawtooth", 0.05, 0.16);
}

// ── COUPURE DU SON ────────────────────────────────────────────
/**
 * @description Indique si le son est actuellement coupé.
 * @returns {boolean} true si le son est coupé
 */
function isSoundMuted() { return _muted; }

/**
 * @description Inverse l'état son activé/coupé, et met à jour le libellé de tous les
 *              boutons son présents dans la page (écran village et sidebar en jeu — voir
 *              index.html).
 *
 * @sideEffects
 *   Modifie l'état interne "coupé", modifie le texte de tout élément
 *   #soundToggleBtnVillage/#soundToggleBtnGame présent dans le DOM
 */
function toggleSoundButton() {
  _muted = !_muted;

  const label = _muted ? "🔇 Son coupé" : "🔊 Son activé";
  ["soundToggleBtnVillage", "soundToggleBtnGame"].forEach(id => {
    const btn = document.getElementById(id);
    if (btn) btn.textContent = label;
  });
}
