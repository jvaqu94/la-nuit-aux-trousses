'use strict';
/* Bout de bout : charge les VRAIS journey.js + duel-core.js + night-duel.js et
   rejoue l’action exacte du bouton « Duel de la Nuit noire » (onclick → openHub,
   exposé via window.NightDuel.open). Avant le correctif, isolateFromCampaign()
   faisait `window.Journey.run = null` sur un accesseur en lecture seule →
   TypeError → la promesse d’openHub rejetait → le clic restait sans effet.
   Ici on vérifie que le salon s’ouvre, que la campagne est isolée (run vidé) et
   qu’aucune exception n’est levée. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');

function makeContext() {
  const store = new Map();
  const listeners = new Map();
  const makeEl = () => ({
    onclick: null, style: {}, dataset: {}, textContent: '', innerHTML: '',
    classList: { add() {}, remove() {}, toggle() {} },
    insertAdjacentHTML() {}, appendChild() {}, setAttribute() {}, addEventListener() {}
  });
  let overlayHTML = '';
  const sandbox = {
    console,
    localStorage: {
      getItem: k => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => store.set(k, String(v)),
      removeItem: k => store.delete(k)
    },
    $: id => (id === 'journeyPanel' ? null : makeEl()),
    settings: () => {},
    safeText: v => String(v ?? ''),
    // 'loading' : menu() de journey.js sort tôt au chargement (pas besoin de
    // LocalLeague). L’action du bouton (openHub) ne dépend pas de l’état initial.
    state: 'loading',
    // overlay capture le HTML rendu par le duel.
    overlay: html => { overlayHTML = String(html ?? ''); },
    location: { href: 'http://localhost/' },
    // Pas de compte connecté → le duel doit afficher l’écran « connexion requise ».
    MinuitCloud: { connected: false },
    document: {
      getElementById: id => (id === 'journeyPanel' ? null : makeEl()),
      // journey.js injecte ses panneaux dans .sidebar / .arena au chargement.
      querySelector: sel => (sel === '.sidebar' || sel === '.arena' ? makeEl() : null),
      querySelectorAll: () => [],
      createElement: () => makeEl(),
      head: { appendChild() {} },
      body: { dataset: {}, classList: { add() {}, remove() {}, toggle() {} } }
    },
    setTimeout, clearTimeout, setInterval, clearInterval,
    addEventListener: (type, fn) => {
      if (!listeners.has(type)) listeners.set(type, []);
      listeners.get(type).push(fn);
    },
    dispatchEvent: evt => { (listeners.get(evt.type) || []).forEach(fn => fn(evt)); }
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  const ctx = vm.createContext(sandbox);
  return { ctx, getOverlayHTML: () => overlayHTML };
}

(async () => {
  const { ctx, getOverlayHTML } = makeContext();
  for (const f of ['journey.js', 'duel-core.js', 'night-duel.js']) {
    vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f });
  }

  assert.ok(ctx.NightDuelCore, 'duel-core.js doit exposer NightDuelCore');
  assert.ok(ctx.NightDuel?.open, 'night-duel.js doit exposer NightDuel.open');

  // Simule une partie de campagne en cours : le duel doit l’isoler sans lever.
  vm.runInContext('"use strict"; window.Journey.run = { id: "campagne-en-cours" };', ctx);
  assert.equal(ctx.Journey.run?.id, 'campagne-en-cours');

  // L’action EXACTE du bouton (button.onclick = () => openHub()).
  await assert.doesNotReject(async () => { await ctx.NightDuel.open(); },
    'openHub ne doit pas rejeter (TypeError sur Journey.run avant le correctif)');

  assert.equal(ctx.Journey.run, null, 'la campagne doit être isolée (Journey.run vidé)');
  assert.equal(ctx.SandboxMode, true, 'SandboxMode doit isoler le duel de la campagne');
  assert.equal(ctx.state, 'night-duel', 'l’état de jeu doit passer à night-duel');
  assert.ok(ctx.NightDuel.isOpen, 'le salon du duel doit être ouvert');
  const html = getOverlayHTML();
  assert.ok(html.includes('night-duel-screen'), 'l’écran du duel doit être rendu');
  assert.ok(html.includes('DUEL DE LA NUIT NOIRE'), 'le titre du duel doit être affiché');

  console.log('OK : le bouton Duel de la Nuit noire ouvre bien le salon avec les vrais journey.js + duel-core.js + night-duel.js (campagne isolée, aucune exception).');
  process.exit(0);
})().catch(err => { console.error(err); process.exit(1); });
