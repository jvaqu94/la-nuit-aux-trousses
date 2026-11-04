'use strict';
/* QR code d’invitation au Duel de la Nuit noire.
   Vérifie que le QR généré 100 % localement encode EXACTEMENT le lien
   d’invitation et qu’il est réellement décodable (round-trip avec jsQR).
   - La matrice est rasterisée puis décodée.
   - Le chemin SVG est reconstruit en grille puis décodé : preuve que le SVG
     affiché dans l’écran d’attente est bien scannable.
   Si jsQR n’est pas installé, on retombe sur une validation structurelle
   (motifs de recherche / taille) et on le signale, sans faire échouer le test. */
const assert = require('node:assert/strict');
const QR = require('../duel-qr.js');
const Core = require('../duel-core.js');
const H = require('./qr-harness.cjs');

const DUEL_ID = '7d7e7382-1648-4e34-a6a2-f6d616bd4f75';

assert.ok(QR.available(), 'le générateur QR doit être disponible (qrcode.js embarqué)');

const cases = [
  Core.buildInviteUrl('http://localhost:3000/', DUEL_ID),
  Core.buildInviteUrl('https://3000-sandbox.e2b.app/', DUEL_ID),
  Core.buildInviteUrl('https://la-nuit-aux-trousses.example.com/jeu/', DUEL_ID)
];

for (const url of cases) {
  assert.ok(Core.extractDuelId(url), `lien d’invitation valide : ${url}`);

  // 1. Matrice → décodage.
  const mat = QR.matrix(url);
  assert.ok(mat.size >= 21 && (mat.size - 21) % 4 === 0, 'taille de version QR valide');
  assert.ok(H.hasFinderPatterns(mat), 'motifs de recherche présents');
  if (H.hasJsQR) assert.equal(H.decodeMatrix(mat), url, `la matrice QR doit encoder exactement ${url}`);

  // 2. SVG → grille → décodage (le SVG affiché est scannable).
  const svgText = QR.svg(url, { title: 'QR d’invitation' });
  assert.ok(svgText.startsWith('<svg') && svgText.includes('crispEdges'), 'SVG net rendu');
  assert.ok(svgText.includes('<title>QR d’invitation</title>'), 'titre accessible présent');
  const svgMat = H.matrixFromSvg(svgText);
  assert.ok(svgMat, 'grille reconstructible depuis le SVG');
  assert.equal(svgMat.size, mat.size, 'le SVG a la même taille que la matrice');
  if (H.hasJsQR) assert.equal(H.decodeMatrix(svgMat), url, `le SVG QR doit encoder exactement ${url}`);
}

// 3. Contenu distinct → matrices distinctes (comparaison déterministe complète).
const a = QR.matrix(cases[0]);
const b = QR.matrix(cases[1]);
let differs = a.size !== b.size;
if (!differs) {
  outer: for (let r = 0; r < a.size; r += 1) {
    for (let c = 0; c < a.size; c += 1) {
      if (a.isDark(r, c) !== b.isDark(r, c)) { differs = true; break outer; }
    }
  }
}
assert.ok(differs, 'deux invitations différentes produisent des QR différents');

// 4. PNG indisponible côté Node (pas de canvas) → null sans lever.
assert.equal(QR.pngDataUrl(cases[0]), null, 'pngDataUrl renvoie null hors navigateur');

// 5. Entrée vide → erreur propre.
assert.throws(() => QR.matrix(''), /vide/, 'lien vide refusé proprement');

console.log(H.hasJsQR
  ? 'OK : QR d’invitation duel — matrice et SVG décodés vers le lien exact (round-trip jsQR), 100 % local.'
  : 'OK : QR d’invitation duel — structure valide (jsQR absent : décodage round-trip ignoré, installer jsqr pour le vérifier).');
process.exit(0);
