/* Exécution réelle des migrations dans PostgreSQL WASM (PGlite). */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { PGlite } = require('@electric-sql/pglite');

const ROOT = path.resolve(__dirname, '..');
const ALICE = '4b1b47de-40f2-45f4-a62c-0f702d85ba01';
const BOB = '84f2f696-f9f4-4e6f-a25f-62746c598315';
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
      insert into auth.users(id) values ('${ALICE}'), ('${BOB}');
    `);
    for (const name of ['teams.sql', 'team_rules.sql', 'team_stats.sql']) {
      await db.exec(fs.readFileSync(path.join(ROOT, 'supabase', name), 'utf8'));
    }
    await db.exec(`
      insert into public.teams(id, name, join_code, created_by, daily_game_limit, rules_configured)
      values ('${TEAM}', 'Team activité', 'ABCDE23456', '${ALICE}', 3, true);
      insert into public.team_members(team_id, user_id, display_name)
      values ('${TEAM}', '${ALICE}', 'Alice'), ('${TEAM}', '${BOB}', 'Bob');
      select set_config('request.jwt.claim.sub', '${ALICE}', false);
    `);

    const submit = async (score, mode, runId) => {
      const response = await db.query(
        'select public.minuit_submit_team_score($1,$2,$3,$4,$5,$6) as result',
        [score, mode, 'normal', 2, 3, runId],
      );
      return value(response.rows[0].result);
    };

    const firstFree = await submit(1000, 'free', 'free-1');
    assert.equal(firstFree.activityOnly, true);
    assert.equal(firstFree.bestScore, 0);
    assert.equal(firstFree.gamesToday, 0);

    const ranked = await submit(2000, 'ranked', 'ranked-1');
    assert.equal(ranked.activityOnly, false);
    assert.equal(ranked.bestScore, 2000);
    assert.equal(ranked.gamesToday, 1);
    assert.equal(ranked.gamesRemaining, 2);

    const secondFree = await submit(3000, 'free', 'free-2');
    assert.equal(secondFree.bestScore, 2000, 'une classique ne remplace pas le highscore classé');
    assert.equal(secondFree.gamesToday, 1, 'une classique ne consomme pas le quota');

    const duplicate = await submit(1000, 'free', 'free-1');
    assert.equal(duplicate.duplicate, true);
    assert.equal(duplicate.gamesToday, 1);

    // Le quota classé est maintenant plein : la classique reste enregistrable.
    await db.exec(`update public.teams set daily_game_limit = 1 where id = '${TEAM}'`);
    const freeAfterLimit = await submit(1500, 'free', 'free-3');
    assert.equal(freeAfterLimit.activityOnly, true);
    assert.equal(freeAfterLimit.gamesRemaining, 0);
    await assert.rejects(() => submit(4000, 'ranked', 'ranked-2'), /TEAM_DAILY_LIMIT/);

    const scores = await db.query('select score, mode from public.team_scores');
    assert.equal(scores.rows.length, 1);
    assert.equal(scores.rows[0].score, 2000);
    assert.equal(scores.rows[0].mode, 'ranked');
    const attempts = await db.query('select mode, count(*)::integer as count from public.team_score_attempts group by mode order by mode');
    assert.deepEqual(attempts.rows, [{ mode: 'free', count: 3 }, { mode: 'ranked', count: 1 }]);

    const stateResponse = await db.query('select public.minuit_team_state() as state');
    const state = value(stateResponse.rows[0].state);
    assert.equal(state.team.totalScore, 2000);
    assert.equal(state.team.gamesToday, 1);
    assert.equal(state.team.gamesRemaining, 0);
    assert.equal(state.scores[0].score, 2000);

    const statsResponse = await db.query('select public.minuit_team_stats(30) as stats');
    const stats = value(statsResponse.rows[0].stats);
    assert.equal(stats.activityScope, 'classic-and-ranked');
    assert.equal(stats.summary.games, 4);
    assert.equal(stats.summary.points, 7500);
    assert.equal(stats.summary.bestScore, 3000);
    assert.equal(stats.summary.rankedGames, 1);
    assert.equal(stats.summary.rankedPoints, 2000);
    assert.equal(stats.summary.freeGames, 3);
    assert.equal(stats.summary.freePoints, 5500);
    assert.equal(stats.summary.activePlayers, 1);
    assert.equal(stats.highscores.length, 1);
    assert.equal(stats.highscores[0].score, 2000);
    assert.equal(stats.runs.length, 4);
    const alice = stats.members.find(member => member.displayName === 'Alice');
    const bob = stats.members.find(member => member.displayName === 'Bob');
    assert.equal(alice.games, 4);
    assert.equal(alice.rankedGames, 1);
    assert.equal(alice.freeGames, 3);
    assert.equal(alice.rankedPoints, 2000);
    assert.equal(alice.freePoints, 5500);
    assert.equal(bob.games, 0);
    assert.equal(bob.rankedGames, 0);
    assert.equal(bob.freeGames, 0);

    await db.query(`select set_config('request.jwt.claim.sub', '${BOB}', false)`);
    await assert.rejects(() => db.query('select public.minuit_team_stats(30)'), /TEAM_ADMIN_REQUIRED/);

    console.log('OK : SQL exécuté ; classiques suivies sans highscore ni quota, classées inchangées, statistiques complètes et admin vérifié.');
  } finally {
    await db.close();
  }
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
