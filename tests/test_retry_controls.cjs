'use strict';
// Garde-fou de non-régression : après « Rejouer avec ce build », l'overlay de
// bilan est masqué mais son HTML peut rester dans le DOM. Les règles plein
// écran du bilan/grimoire ne doivent donc viser que l'overlay AFFICHÉ, sinon
// la touchbar (sort spécial, esquive, pause) reste cachée pendant la partie.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const viewport = fs.readFileSync(path.join(root, 'viewport.js'), 'utf8');
const game = fs.readFileSync(path.join(root, 'game.js'), 'utf8');
const replay = fs.readFileSync(path.join(root, 'replay.js'), 'utf8');

for (const screen of ['journey-result-screen', 'grimoire-screen']) {
  assert.equal(
    viewport.includes(`body:has(.${screen}) .touchbar`), false,
    `la touchbar ne doit pas être cachée par un .${screen} simplement présent dans le DOM`,
  );
  assert.equal(
    viewport.includes(`body:has(.${screen}) .sidebar`), false,
    `la sidebar ne doit pas être cachée par un .${screen} simplement présent dans le DOM`,
  );
  assert.ok(
    viewport.includes(`body:has(.overlay:not(.hidden) .${screen}) .touchbar`),
    `le plein écran .${screen} doit rester actif quand le bilan est affiché`,
  );
  assert.ok(
    viewport.includes(`body:has(.overlay:not(.hidden) .${screen}) .sidebar`),
    `la sidebar doit rester masquée quand le bilan .${screen} est affiché`,
  );
}

// Le démarrage d'un vol restaure explicitement la barre de combat et masque
// l'overlay ; le bouton de replay relance bien une partie locale.
assert.ok(game.includes("$('pause').closest('.touchbar').style.display='flex'"));
assert.ok(game.includes('hideOverlay()'));
assert.ok(replay.includes('Rejouer avec ce build'));
assert.ok(replay.includes('LocalLeague.play()'));

console.log('OK : le bilan masqué ne cache plus Sort spécial, Esquive et Pause après replay.');
