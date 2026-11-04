/* Régression : synchronisation cloud multi-appareils et envoi fiable des scores
 * de team. Exécute le vrai client supabase.js contre le vrai SQL (PGlite).
 *   node tests/test_cloud_sync.cjs
 */
const assert = require('node:assert/strict');
const { makeDb, makeDevice } = require('./cloud-sync-harness.cjs');

const ALICE = '4b1b47de-40f2-45f4-a62c-0f702d85ba01';
const BOB = '84f2f696-f9f4-4e6f-a25f-62746c598315';
const TEAM = '7d7e7382-1648-4e34-a6a2-f6d616bd4f75';

const journeySave = over => ({ version: 1, xp: 0, trainingDone: false, tutorialDone: false, recent: [], activeDates: [], seen: {}, selected: {}, achievements: [], days: {}, weeks: [], streak: 0, lifetime: {}, mastery: { selected: 'base', done: [], unlocked: [], best: {} }, giftedCosmetics: [], dailyRewards: {}, ...over });
const bundle = (journeyOver, high = {}, leagueDays = {}) => ({
  format: 'MinuitProgression', version: 1, exportedAt: new Date().toISOString(),
  saves: {
    'minuit-journey-v1': journeySave(journeyOver),
    'minuit-highscores': high,
    'minuit-v2-scores': [],
    'minuit-local-league-v1': { days: leagueDays, runs: {} },
    'minuit-settings': { keys: {}, difficulty: 'normal', name: '' },
    'minuit-checkpoint': null,
    'minuit-campaign-v1': null,
  },
});
const pcBundle = () => bundle({ xp: 4200, trainingDone: true, tutorialDone: true, recent: [{ id: 'r1' }], activeDates: ['2026-11-01'], seen: { r1: { stats: {}, paid: 10, done: true } } }, { ranked: 18500, normal: 9000 }, { '2026-11-01': { best: 18500, bonus: 0, rankedUsed: 1, dailyUsed: 0, stats: {}, claimed: [] } });
const freshBundle = () => bundle({}, {}, {});

/* Each device keeps a mutable bundle; importSave replaces it (simulating the
 * page reload that follows a real restore). */
function makeJourney(initial) {
  let current = initial();
  return {
    bundle: () => current,
    validate: b => b,
    importSave: async (file, status, options) => { current = JSON.parse(await file.text()); return true; },
    get state() { return current.saves['minuit-journey-v1']; },
    get run() { return null; },
    _current: () => current,
  };
}

async function login(device, pseudo) {
  device.cloud.renderPanel({ isConnected: true, innerHTML: '' });
  device.el('cloudPseudo').value = pseudo;
  device.el('cloudPseudoPassword').value = 'password123';
  await device.el('cloudPseudoLogin').onclick();
}

(async () => {
  const db = await makeDb();
  const tokens = new Map();
  const users = { Alice: ALICE, Bob: BOB };
  await db.exec(`
    insert into auth.users(id) values ('${ALICE}'), ('${BOB}');
    insert into public.teams(id, name, join_code, created_by, daily_game_limit, rules_configured)
    values ('${TEAM}', 'Les Balais', 'ABCDE23456', '${ALICE}', 3, true);
    insert into public.team_members(team_id, user_id, display_name)
    values ('${TEAM}', '${ALICE}', 'Alice'), ('${TEAM}', '${BOB}', 'Bob');
  `);
  const cloudHigh = async uid => {
    const r = await db.query("select payload->'saves'->'minuit-highscores' as hs, payload->'saves'->'minuit-journey-v1'->>'trainingDone' as training from public.game_saves where user_id=$1", [uid]);
    return r.rows[0] || null;
  };

  // === 1. PC creates the account and syncs its progress ===
  const pcJourney = makeJourney(pcBundle);
  const pc = await makeDevice(db, 'pc', { tokens, users, journey: pcJourney });
  await login(pc, 'Alice');
  assert.equal(pc.cloud.connected, true, 'PC connecté');
  // Login reconcile already pushed the PC progress (no cloud save existed yet).
  let row = await cloudHigh(ALICE);
  assert.equal(row.hs.ranked, 18500, 'la connexion crée la sauvegarde cloud avec les scores du PC');
  assert.equal(row.training, 'true', 'l’entraînement terminé est dans la sauvegarde cloud');

  // === 2. Fresh phone logs in with the same account -> auto-restore ===
  const phoneJourney = makeJourney(freshBundle);
  const phone = await makeDevice(db, 'phone', { tokens, users, journey: phoneJourney });
  await login(phone, 'Alice');
  assert.equal(phone.cloud.connected, true, 'téléphone connecté');
  assert.equal(phoneJourney.state.trainingDone, true, 'BUG 1 corrigé : l’entraînement est récupéré automatiquement sur le téléphone');
  assert.equal(phoneJourney._current().saves['minuit-highscores'].ranked, 18500, 'BUG 1 corrigé : les scores sont récupérés automatiquement');

  // === 3. The phone (now aligned) does not clobber the cloud with empty data ===
  await phone.cloud.sync();
  row = await cloudHigh(ALICE);
  assert.equal(row.hs.ranked, 18500, 'le téléphone aligné ne réécrase pas le cloud avec des données vides');
  assert.equal(row.training, 'true', 'l’entraînement reste terminé dans le cloud');

  // === 4. Overwrite protection: automatic sync must not clobber a diverged cloud ===
  // A fresh device logs in -> auto-restores (aligned with cloud).
  const staleJourney = makeJourney(freshBundle);
  const stale = await makeDevice(db, 'stale', { tokens, users, journey: staleJourney });
  await login(stale, 'Alice');
  assert.equal(staleJourney.state.trainingDone, true, 'appareil aligné via la récupération auto');
  // It then makes local offline changes (touch advances past the last sync).
  stale.localStorage.setItem('minuit-cloud-touched-v1', String(Date.now() + 60000));
  // Another device pushes a newer cloud save (simulated directly in the DB).
  await db.query("update public.game_saves set payload=jsonb_set(payload,'{saves,minuit-highscores,ranked}','50000'), updated_at=now(), client_updated_at=now() where user_id=$1", [ALICE]);
  row = await cloudHigh(ALICE);
  assert.equal(row.hs.ranked, 50000, 'un autre appareil a poussé un cloud plus récent');
  // Automatic sync on the stale device must defer, not overwrite.
  const outcome = await stale.cloud.reconcile({ automatic: true });
  assert.equal(outcome, 'deferred', 'la synchro auto diffère la décision au lieu d’écraser');
  row = await cloudHigh(ALICE);
  assert.equal(row.hs.ranked, 50000, 'BUG 1b corrigé : la synchro auto n’écrase pas une sauvegarde cloud divergente plus récente');

  // === 5. Ranked team score: happy path ===
  const bobJourney = makeJourney(freshBundle);
  const bob = await makeDevice(db, 'bob', { tokens, users, journey: bobJourney });
  await login(bob, 'Bob');
  const res = await bob.cloud.finishTeamScore({ id: 'run-1', score: 5000, mode: 'ranked', difficulty: 'normal', stage: 2, wave: 3 });
  assert.equal(res.result.bestScore, 5000, 'score classé compté');
  assert.equal(res.scores.find(s => s.isYou).score, 5000, 'score classé affiché dans le tableau de team');

  // === 6. Ranked team score: transient failure is queued, then retried ===
  let failSubmit = true;
  const bob2Journey = makeJourney(freshBundle);
  const bob2 = await makeDevice(db, 'bob2', {
    tokens, users, journey: bob2Journey,
    failRpc: (body, u) => failSubmit && u.pathname.includes('minuit_submit_team_score'),
  });
  await login(bob2, 'Bob');
  await assert.rejects(
    () => bob2.cloud.finishTeamScore({ id: 'run-2', score: 99999, mode: 'ranked', difficulty: 'normal', stage: 3, wave: 1 }),
    /réseau|network|indisponible|mock/i,
    'l’envoi échoue (réseau)',
  );
  assert.equal(bob2.cloud.pendingTeamScores, 1, 'le vol classé échoué est conservé en file d’attente');
  let best = await db.query("select score from public.team_scores where user_id=$1 and mode='ranked'", [BOB]);
  assert.equal(best.rows[0].score, 5000, 'le score n’est pas encore compté pendant la panne');
  // Network is back; the pending score is retried automatically.
  failSubmit = false;
  const sent = await bob2.cloud.retryTeamScores();
  assert.equal(sent, 1, 'le vol en attente est renvoyé');
  assert.equal(bob2.cloud.pendingTeamScores, 0, 'la file est vidée');
  best = await db.query("select score from public.team_scores where user_id=$1 and mode='ranked'", [BOB]);
  assert.equal(best.rows[0].score, 99999, 'BUG 2 corrigé : le score classé échoué est finalement compté');
  const attempts = await db.query('select run_id from public.team_score_attempts where user_id=$1 order by run_id', [BOB]);
  assert.deepEqual(attempts.rows.map(r => r.run_id), ['run-1', 'run-2'], 'pas de double comptage (run_id unique)');

  // === 7. Team-state load failure must not silently skip a ranked score ===
  let failState = true;
  const bob3Journey = makeJourney(freshBundle);
  const bob3 = await makeDevice(db, 'bob3', {
    tokens, users, journey: bob3Journey,
    failRpc: (body, u) => failState && u.pathname.includes('minuit_team_state'),
  });
  await login(bob3, 'Bob');
  failState = false; // team state still fails during this submit if we re-enable; keep it failing for loadTeam only
  failState = true;
  const res3 = await bob3.cloud.finishTeamScore({ id: 'run-3', score: 7777, mode: 'ranked', difficulty: 'normal', stage: 1, wave: 2 });
  // loadTeam fails -> teamLoaded stays false -> the RPC is still attempted and succeeds.
  assert.equal(res3.skipped, false, 'BUG 2b corrigé : un échec de chargement de la team ne saute pas silencieusement le score');
  assert.equal(res3.result.bestScore, 99999, 'le highscore reste le meilleur (7777 < 99999)');
  const attempt3 = await db.query("select run_id from public.team_score_attempts where user_id=$1 and run_id='run-3'", [BOB]);
  assert.equal(attempt3.rows.length, 1, 'le vol run-3 a bien été transmis malgré l’échec de chargement de la team');

  await db.close();
  console.log('OK : cloud multi-appareils (récupération auto, protection contre l’écrasement) et scores de team fiables (file d’attente, pas de saut silencieux).');
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
