/* Périodes classées : prolongation, inscription continue et archives réelles. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { PGlite } = require('@electric-sql/pglite');

const ROOT = path.resolve(__dirname, '..');
const ALICE = '4b1b47de-40f2-45f4-a62c-0f702d85ba01';
const BOB = '84f2f696-f9f4-4e6f-a25f-62746c598315';
const CHARLIE = 'f0d8a2d4-64ca-4b35-9712-4977a701a22e';
const TEAM = '7d7e7382-1648-4e34-a6a2-f6d616bd4f75';
const value = input => typeof input === 'string' ? JSON.parse(input) : input;

(async () => {
  const db = new PGlite();
  try {
    await db.exec(`
      create schema auth;
      create table auth.users(id uuid primary key);
      create role anon nologin;
      create role authenticated nologin;
      create function auth.uid() returns uuid language sql stable as $$
        select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
      $$;
      insert into auth.users(id) values ('${ALICE}'), ('${BOB}'), ('${CHARLIE}');
    `);
    for (const name of ['teams.sql', 'team_rules.sql', 'team_stats.sql', 'team_periods.sql']) {
      await db.exec(fs.readFileSync(path.join(ROOT, 'supabase', name), 'utf8'));
    }
    await db.exec(`
      insert into public.teams(id, name, join_code, created_by, daily_game_limit, starts_at, ends_at, rules_configured)
      values ('${TEAM}', 'Team périodes', 'ABCDE23456', '${ALICE}', 3, now() - interval '2 days', now() + interval '2 days', true);
      insert into public.team_members(team_id, user_id, display_name)
      values ('${TEAM}', '${ALICE}', 'Alice'), ('${TEAM}', '${BOB}', 'Bob');
    `);

    const user = async id => { await db.query(`select set_config('request.jwt.claim.sub', '${id}', false)`); };
    const call = async (name, params = []) => {
      const placeholders = params.map((_, index) => `$${index + 1}`).join(',');
      const response = await db.query(`select public.${name}(${placeholders}) as result`, params);
      return value(response.rows[0].result);
    };
    const state = () => call('minuit_team_state');
    const submit = (score, mode, runId) => call('minuit_submit_team_score', [score, mode, 'normal', 2, 3, runId]);
    const history = () => call('minuit_team_period_history');

    await user(ALICE);
    let current = await state();
    assert.equal(current.team.periodNumber, 1, 'le trigger initialise la première période');
    assert.equal(current.team.archivedPeriods, 0);

    await user(ALICE);
    await submit(3000, 'ranked', 'ranked-a1');
    await user(BOB);
    await submit(2000, 'ranked', 'ranked-b1');

    // Une team reste joignable lorsque sa période est terminée.
    await user(ALICE);
    current = await call('minuit_update_team_rules', [3, null, new Date(Date.now() - 3600000).toISOString()]);
    assert.equal(current.team.periodNumber, 1);
    await user(CHARLIE);
    current = await call('minuit_join_team', ['ABCDE23456', 'Charlie']);
    assert.equal(current.team.memberCount, 3);
    await assert.rejects(() => submit(1000, 'ranked', 'ranked-c-refuse'), /TEAM_PERIOD_ENDED/);
    const free = await submit(9000, 'free', 'free-c1');
    assert.equal(free.activityOnly, true);

    // Prolonger la même période conserve les scores et ne crée aucune archive.
    await user(ALICE);
    current = await call('minuit_update_team_rules', [3, null, new Date(Date.now() + 4 * 86400000).toISOString()]);
    assert.equal(current.team.periodNumber, 1);
    assert.equal(current.team.totalScore, 5000);
    assert.equal(current.team.archivedPeriods, 0);
    await user(CHARLIE);
    await submit(1000, 'ranked', 'ranked-c1');
    current = await state();
    assert.equal(current.team.totalScore, 6000);
    assert.equal(current.scores.find(row => row.displayName === 'Charlie').score, 1000);
    assert(!current.scores.some(row => row.score === 9000), 'la classique ne devient jamais un highscore');
    assert.deepEqual((await history()).periods, []);

    await user(BOB);
    await assert.rejects(
      () => call('minuit_start_team_period', [3, null, new Date(Date.now() + 7 * 86400000).toISOString()]),
      /TEAM_ADMIN_REQUIRED/,
    );

    // Nouvelle période : date future obligatoire, puis archive complète.
    await user(ALICE);
    await assert.rejects(
      () => call('minuit_start_team_period', [3, null, new Date(Date.now() - 3600000).toISOString()]),
      /TEAM_PERIOD_END_FUTURE/,
    );
    current = await state();
    assert.equal(current.team.archivedPeriods, 0);
    assert.equal(current.team.totalScore, 6000);
    current = await call('minuit_start_team_period', [3, null, new Date(Date.now() + 7 * 86400000).toISOString()]);
    assert.equal(current.team.periodNumber, 2);
    assert.equal(current.team.archivedPeriods, 1);
    assert.equal(current.team.totalScore, 0);
    assert.equal(current.scores.length, 3);
    assert(current.scores.every(row => row.score === 0));
    const attempts = await db.query('select count(*)::integer as count from public.team_score_attempts');
    assert.equal(attempts.rows[0].count, 4, 'les statistiques et le quota du jour ne sont pas effacés');

    await user(CHARLIE);
    let archive = await history();
    assert.equal(archive.periods.length, 1, 'un membre non-admin lit aussi l’historique');
    assert.equal(archive.periods[0].periodNumber, 1);
    assert.equal(archive.periods[0].totalScore, 6000);
    assert.deepEqual(archive.periods[0].scores.map(row => [row.rank, row.displayName, row.score]), [
      [1, 'Alice', 3000], [2, 'Bob', 2000], [3, 'Charlie', 1000],
    ]);
    assert.equal(archive.periods[0].scores[2].isYou, true);

    await user(ALICE);
    await submit(500, 'ranked', 'ranked-a2');
    current = await call('minuit_update_team_rules', [3, null, new Date(Date.now() + 10 * 86400000).toISOString()]);
    assert.equal(current.team.periodNumber, 2);
    assert.equal(current.team.totalScore, 500);
    assert.equal(current.team.archivedPeriods, 1);

    current = await call('minuit_start_team_period', [3, null, new Date(Date.now() + 14 * 86400000).toISOString()]);
    assert.equal(current.team.periodNumber, 3);
    archive = await history();
    assert.equal(archive.periods.length, 2);
    assert.equal(archive.periods[0].periodNumber, 2);
    assert.equal(archive.periods[0].totalScore, 500);
    assert.equal(archive.periods[1].totalScore, 6000, 'les anciennes archives sont immuables');

    // La remise à zéro complète existante efface aussi les archives, pas la team.
    current = await call('minuit_reset_team_campaign');
    assert.equal(current.team.memberCount, 3);
    assert.equal(current.team.totalScore, 0);
    assert.equal(current.team.periodNumber, 1);
    assert.equal(current.team.archivedPeriods, 0);
    assert.deepEqual((await history()).periods, []);
    const remainingAttempts = await db.query('select count(*)::integer as count from public.team_score_attempts');
    assert.equal(remainingAttempts.rows[0].count, 0);

    const privileges = await db.query(`
      select
        has_table_privilege('authenticated', 'public.team_ranked_periods', 'select') as direct_periods,
        has_table_privilege('authenticated', 'public.team_ranked_period_scores', 'select') as direct_scores,
        has_function_privilege('authenticated', 'public.minuit_start_team_period(integer,timestamptz,timestamptz)', 'execute') as start_period,
        has_function_privilege('authenticated', 'public.minuit_team_period_history()', 'execute') as read_history,
        has_function_privilege('anon', 'public.minuit_team_period_history()', 'execute') as anon_history
    `);
    assert.deepEqual(privileges.rows[0], {
      direct_periods: false, direct_scores: false, start_period: true, read_history: true, anon_history: false,
    });

    console.log('OK : inscription continue, prolongation sans archive, podium et historique préservés, nouvelle période et reset vérifiés.');
  } finally {
    await db.close();
  }
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
