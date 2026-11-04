'use strict';
/* Aide partagée pour les tests du QR d’invitation : rasterise une matrice QR et
   la décode avec jsQR (si installé), et reconstruit une grille depuis le chemin
   SVG réellement rendu. Permet de prouver que le QR affiché est scannable et
   encode exactement le lien d’invitation. */
let jsQR = null;
try { jsQR = require('jsqr'); } catch (_) { /* décodage optionnel */ }

function rasterize(mat, margin = 4, scale = 4) {
  const dim = (mat.size + margin * 2) * scale;
  const data = new Uint8ClampedArray(dim * dim * 4).fill(255);
  for (let r = 0; r < mat.size; r += 1) {
    for (let c = 0; c < mat.size; c += 1) {
      if (!mat.isDark(r, c)) continue;
      for (let y = 0; y < scale; y += 1) {
        for (let x = 0; x < scale; x += 1) {
          const px = ((r + margin) * scale + y) * dim + ((c + margin) * scale + x);
          data[px * 4] = 0; data[px * 4 + 1] = 0; data[px * 4 + 2] = 0; data[px * 4 + 3] = 255;
        }
      }
    }
  }
  return { data, dim };
}

function decodeMatrix(mat, margin = 4, scale = 4) {
  if (!jsQR) return null;
  const { data, dim } = rasterize(mat, margin, scale);
  const res = jsQR(data, dim, dim);
  return res ? res.data : null;
}

// Reconstruit la grille depuis un SVG rendu (chemin M{x} {y}h1v1h-1z, marge 4).
function matrixFromSvg(svgText) {
  const vb = String(svgText).match(/viewBox="0 0 (\d+) (\d+)"/);
  if (!vb) return null;
  const dim = Number(vb[1]);
  const margin = 4;
  const size = dim - margin * 2;
  if (size < 21) return null;
  const grid = Array.from({ length: size }, () => Array(size).fill(false));
  for (const m of String(svgText).matchAll(/M(\d+) (\d+)h1v1h-1z/g)) {
    grid[Number(m[2]) - margin][Number(m[1]) - margin] = true;
  }
  return { size, isDark: (r, c) => grid[r][c] };
}

function hasFinderPatterns(mat) {
  const { size, isDark } = mat;
  for (const [r0, c0] of [[0, 0], [0, size - 7], [size - 7, 0]]) {
    for (let r = 0; r < 7; r += 1) {
      for (let c = 0; c < 7; c += 1) {
        const outer = r === 0 || r === 6 || c === 0 || c === 6;
        const center = r >= 2 && r <= 4 && c >= 2 && c <= 4;
        if (isDark(r0 + r, c0 + c) !== (outer || center)) return false;
      }
    }
  }
  return true;
}

module.exports = {
  hasJsQR: Boolean(jsQR),
  rasterize,
  decodeMatrix,
  matrixFromSvg,
  hasFinderPatterns
};
