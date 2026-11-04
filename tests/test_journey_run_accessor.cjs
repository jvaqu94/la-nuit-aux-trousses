'use strict';
/* Régression : le bouton « Duel de la Nuit noire » ne fonctionnait pas.
   night-duel.js (isolateFromCampaign) fait `window.Journey.run = null` en mode
   strict. Or journey.js exposait `run` comme un accesseur en lecture seule
   (getter sans setter) → TypeError « Cannot set property run … which has only
   a getter » → openHub() rejetait sa promesse → le clic ne faisait rien.

   Ce test charge le VRAI journey.js (pas un stub) et rejoue exactement
   l’affectation du duel. Il échoue si le setter de `run` disparaît. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');

function makeContext() {
  const store = new Map();
  const localStorage = {
    getItem: k => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: k => store.delete(k)
  };
  const listeners = new Map();
  const makeEl = () => ({
    onclick: null,
    style: {},
    textContent: '',
    innerHTML: '',
    classList: { add() {}, remove() {}, toggle() {} },
    insertAdjacentHTML() {},
    appendChild() {}
  });
  const sandbox = {
    console,
    localStorage,
    // journey.js emballe des fonctions de game.js au chargement (settings…) et
    // injecte son CSS / ses panneaux. renderPanel() sort tôt si #journeyPanel est
    // absent ; menu() sort tôt si state !== 'league-menu'.
    $: id => (id === 'journeyPanel' ? null : makeEl()),
    settings: () => {},
    safeText: v => String(v ?? ''),
    state: 'loading',
    document: {
      getElementById: id => (id === 'journeyPanel' ? null : makeEl()),
      querySelector: () => makeEl(),
      querySelectorAll: () => [],
      createElement: () => makeEl(),
      head: { appendChild() {} }
    },
    setTimeout,
    clearTimeout,
    addEventListener: (type, fn) => {
      if (!listeners.has(type)) listeners.set(type, []);
      listeners.get(type).push(fn);
    },
    dispatchEvent: () => {}
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  return vm.createContext(sandbox);
}

const ctx = makeContext();
vm.runInContext(fs.readFileSync(path.join(ROOT, 'journey.js'), 'utf8'), ctx, { filename: 'journey.js' });

assert.ok(ctx.Journey, 'window.Journey doit être exposé');

// 1. Le setter accepte une valeur (simule une partie de campagne en cours).
vm.runInContext('"use strict"; window.Journey.run = { id: "campagne-en-cours" };', ctx);
assert.equal(ctx.Journey.run?.id, 'campagne-en-cours', 'le setter de Journey.run doit accepter une valeur');

// 2. L’affectation EXACTE de night-duel.js (isolateFromCampaign) ne doit pas
//    lever et doit bien vider le run. C’est le geste qui plantait avant le fix.
assert.doesNotThrow(() => {
  vm.runInContext('"use strict"; window.Journey.run = null;', ctx);
}, 'window.Journey.run = null ne doit pas lever (getter seul = TypeError)');
assert.equal(ctx.Journey.run, null, 'Journey.run doit être vidé pendant le duel');

// 3. La descriptor reste un accesseur (getter + setter), pas une propriété simple.
const desc = Object.getOwnPropertyDescriptor(ctx.Journey, 'run');
assert.equal(typeof desc.get, 'function', 'run doit rester un accesseur avec getter');
assert.equal(typeof desc.set, 'function', 'run doit avoir un setter (correctif du duel)');

console.log('OK : Journey.run est vidable en mode strict — le bouton Duel de la Nuit noire peut ouvrir le salon (isolateFromCampaign ne lève plus).');
process.exit(0);
