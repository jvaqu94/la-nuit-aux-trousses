'use strict';
/* Régression : l'entraînement obligatoire ne doit pas être redemandé à un profil
   qui a déjà commencé/terminé un vol normal ou terminé l'entraînement, y compris
   après restauration cloud sur un autre ordinateur. Une journée vide créée par le
   menu ne doit pas faire croire à une progression locale sur un appareil neuf. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');
const KEY = 'minuit-journey-v1';

function makeStorage(initial = {}) {
  const map = new Map(Object.entries(initial));
  return {
    getItem: k => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: k => map.delete(k),
    _map: map,
  };
}

function makeEl(id = '') {
  return {
    id,
    onclick: null,
    innerHTML: '',
    textContent: '',
    style: {},
    dataset: {},
    disabled: false,
    classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
    insertAdjacentHTML() {},
    appendChild() {},
    setAttribute() {},
    addEventListener() {},
    querySelector: () => null,
    querySelectorAll: () => [],
    focus() {},
    click() {},
  };
}

function loadJourney(initial = {}) {
  const localStorage = makeStorage(initial);
  const elements = new Map();
  const listeners = new Map();
  const events = [];
  let reloads = 0;
  const el = id => {
    if (!elements.has(id)) elements.set(id, makeEl(id));
    return elements.get(id);
  };
  const documentStub = {
    getElementById: el,
    createElement: tag => makeEl(tag),
    head: { appendChild() {} },
    body: { classList: { add() {}, remove() {}, toggle() {} } },
    querySelector: sel => (sel === '.sidebar' || sel === '.arena' ? makeEl(sel) : null),
    querySelectorAll: () => [],
    addEventListener() {},
  };
  const parse = (key, fallback) => {
    try { return JSON.parse(localStorage.getItem(key) || 'null') ?? fallback; } catch { return fallback; }
  };
  const sandbox = {
    console,
    localStorage,
    document: documentStub,
    $: el,
    overlay: () => {},
    settings: () => {},
    safeText: v => String(v ?? ''),
    state: 'loading',
    dateKey: () => '2026-11-04',
    getHighScore: () => 0,
    saveHighScores: () => {},
    highScores: parse('minuit-highscores', {}),
    records: parse('minuit-v2-scores', []),
    prefs: parse('minuit-settings', {}),
    recordDirty: false,
    gameTime: 0,
    score: 0,
    LocalLeague: {
      flush() {},
      total: () => 0,
      dayState: () => ({ bonus: 0 }),
      data: parse('minuit-local-league-v1', { days: {}, runs: {} }),
      current: null,
    },
    location: { href: 'https://game.example/', reload() { reloads += 1; } },
    confirm: () => true,
    setTimeout, clearTimeout, setInterval, clearInterval,
    addEventListener: (type, fn) => { (listeners.get(type) || listeners.set(type, []).get(type)).push(fn); },
    dispatchEvent: ev => { events.push(ev); (listeners.get(ev.type) || []).forEach(fn => fn(ev)); return true; },
    CustomEvent: class CustomEvent { constructor(type, init = {}) { this.type = type; this.detail = init.detail; } },
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  const ctx = vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'journey.js'), 'utf8'), ctx, { filename: 'journey.js' });
  return { ctx, localStorage, events, reloads: () => reloads };
}

const journeySave = over => ({
  version: 1, xp: 0, selected: {}, lifetime: {}, days: {}, seen: {}, achievements: [],
  activeDates: [], streak: 0, lastActive: '', weeks: [], tutorialDone: false,
  trainingDone: false, dodgeGuideDone: false, giftedCosmetics: [], dailyRewards: {},
  mastery: { selected: 'base', done: [], unlocked: [], best: {} }, recent: [], ...over,
});
const bundle = (journeyOver, saves = {}) => ({
  format: 'MinuitProgression', version: 1, exportedAt: new Date().toISOString(),
  saves: {
    [KEY]: journeySave(journeyOver),
    'minuit-highscores': {},
    'minuit-v2-scores': [],
    'minuit-local-league-v1': { days: {}, runs: {} },
    'minuit-settings': { keys: {}, difficulty: 'normal', name: '' },
    'minuit-checkpoint': null,
    'minuit-campaign-v1': null,
    ...saves,
  },
});

(async () => {
  // 1. Profil vraiment neuf : l'entraînement reste obligatoire.
  {
    const { ctx } = loadJourney();
    assert.equal(ctx.Journey.trainingRequired(), true);
    assert.equal(ctx.Journey.hasPlayed(), false);
  }

  // 2. Appareil neuf : le menu a créé une journée vide, mais aucun vol n'a eu lieu.
  //    Cela ne doit pas bloquer la restauration automatique du cloud.
  {
    const emptyDay = { days: { '2026-11-04': { best: 0, bonus: 0, rankedUsed: 0, dailyUsed: 0, stats: { kills: 0 }, claimed: [] } }, runs: {} };
    const { ctx } = loadJourney({ 'minuit-local-league-v1': JSON.stringify(emptyDay) });
    assert.equal(ctx.Journey.hasPlayed(), false, 'une journée vide ne compte pas comme une partie');
    assert.equal(ctx.Journey.trainingRequired(), true);
  }

  // 3. Ancien profil : trainingDone=false mais un vol existe déjà dans le journal.
  {
    const save = journeySave({ trainingDone: false, recent: [{ id: 'r1', day: '2026-11-01', world: 'Forêt', cause: 'Fin', stats: {}, score: 0 }] });
    const { ctx } = loadJourney({ [KEY]: JSON.stringify(save) });
    assert.equal(ctx.Journey.trainingRequired(), false, 'un vol déjà joué débloque l’entraînement');
    assert.equal(ctx.Journey.state.trainingDone, true);
    const exported = ctx.Journey.bundle();
    assert.equal(exported.saves[KEY].trainingDone, true, 'la sauvegarde envoyée au cloud conserve le déblocage');
  }

  // 4. Ancien profil : seulement un highscore / checkpoint / essai local.
  for (const [label, initial] of [
    ['highscore', { [KEY]: JSON.stringify(journeySave({})), 'minuit-highscores': JSON.stringify({ normal: 1200 }) }],
    ['checkpoint', { [KEY]: JSON.stringify(journeySave({})), 'minuit-checkpoint': JSON.stringify({ version: 8 }) }],
    ['essai local', { [KEY]: JSON.stringify(journeySave({})), 'minuit-local-league-v1': JSON.stringify({ days: {}, runs: { r1: { id: 'r1' } } }) }],
  ]) {
    const { ctx } = loadJourney(initial);
    assert.equal(ctx.Journey.trainingRequired(), false, label + ' doit compter comme première partie');
  }

  // 5. Entraînement déjà terminé : aucun vol normal n'est nécessaire.
  {
    const { ctx } = loadJourney({ [KEY]: JSON.stringify(journeySave({ trainingDone: true })) });
    assert.equal(ctx.Journey.trainingRequired(), false);
    assert.equal(ctx.Journey.hasPlayed(), true);
  }

  // 6. Le premier vol normal est marqué explicitement ; le transient/sandbox non.
  {
    const { ctx, localStorage } = loadJourney();
    ctx.window.SandboxMode = true;
    ctx.Journey.begin({ mode: 'free', transient: true });
    assert.equal(ctx.Journey.state.trainingDone, false, 'un vol transient ne débloque pas l’entraînement');
    ctx.Journey.run = null;
    ctx.window.SandboxMode = false;
    ctx.Journey.begin({ mode: 'free', id: 'normal-1' });
    assert.equal(ctx.Journey.state.trainingDone, true);
    assert.ok(ctx.Journey.state.firstGameAt, 'le premier vol normal est daté');
    const persisted = JSON.parse(localStorage.getItem(KEY));
    assert.equal(persisted.trainingDone, true);
    assert.ok(persisted.firstGameAt);
  }

  // 7. Restauration cloud d'un ancien profil incomplet : normalisation avant écriture.
  {
    const legacy = bundle({ trainingDone: false, tutorialDone: undefined, recent: [{ id: 'old', day: '2026-10-01', world: 'Forêt', cause: 'Fin', stats: {}, score: 10 }] });
    delete legacy.saves[KEY].tutorialDone;
    const { ctx, localStorage, reloads, events } = loadJourney();
    const file = { size: JSON.stringify(legacy).length, text: async () => JSON.stringify(legacy) };
    const status = { textContent: '' };
    const ok = await ctx.Journey.importSave(file, status, { skipConfirm: true });
    assert.equal(ok, true, 'la restauration doit réussir : ' + status.textContent);
    assert.equal(reloads(), 1);
    assert.ok(events.some(e => e.type === 'minuit:progress-restored'));
    const persisted = JSON.parse(localStorage.getItem(KEY));
    assert.equal(persisted.trainingDone, true);
    assert.equal(persisted.tutorialDone, false);
    // Un rechargement sur le même stockage ne redemande pas l'entraînement.
    const after = loadJourney(Object.fromEntries(localStorage._map));
    assert.equal(after.ctx.Journey.trainingRequired(), false);
  }

  console.log('OK : entraînement obligatoire uniquement pour les vrais nouveaux profils ; premier vol, traces anciennes et restauration cloud débloquent correctement.');
  process.exit(0);
})().catch(err => { console.error(err); process.exit(1); });
