/**
 * @file ui-core.js
 * @module ui/core
 * @description Utilitaires DOM de base, protection anti-clickjacking, gestion des écrans.
 *              Extrait de ui.js lors du refactoring Phase 1.
 *
 * @dependencies
 *   - aucune
 *
 * @exports (fonctions globales)
 *   - hashStr(s)
 *   - $(id)
 *   - showScreen(id)
 */

// ── UTILS ────────────────────────────────────────────────────
// Anti-clickjacking : si la page est chargée dans une iframe, on la masque et on
// force la navigation de la fenêtre parente vers l'URL courante.
if (window.self !== window.top) {
  document.documentElement.style.display = "none";
  window.top.location = window.self.location;
}

/**
 * @description Hash déterministe simple (djb2-like) d'une chaîne, utilisé pour dériver
 *              de façon stable une palette et une forme de badge SVG à partir d'un nom
 *              (voir ui-svg.js → makeBadgeSvg()) — un même nom produit toujours le même
 *              badge.
 *
 * @param {string} s - Chaîne à hasher
 *
 * @returns {number} Entier non-signé 32 bits
 */
function hashStr(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

/**
 * @description Raccourci pour `document.getElementById`, utilisé dans tout le code UI.
 * @param {string} id - id de l'élément DOM recherché
 * @returns {?HTMLElement} L'élément trouvé, ou null s'il n'existe pas
 */
function $(id) { return document.getElementById(id); }

// ── SCREENS ──────────────────────────────────────────────────
/**
 * @description Affiche l'écran désigné par `id` en lui ajoutant la classe `.active`,
 *              et masque tous les autres écrans (`.screen`) en la retirant.
 *
 * @param {string} id - id de l'écran à afficher (ex: "screenVillage", "screenGame")
 *
 * @sideEffects
 *   Modifie les classes CSS de tous les éléments `.screen` du document
 */
function showScreen(id) {
  document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
  const el = $(id);
  if (el) el.classList.add("active");
}
