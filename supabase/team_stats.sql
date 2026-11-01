-- La Nuit aux Trousses — suivi privé de l’activité par le créateur de team.
-- À exécuter après teams.sql et team_rules.sql.
-- Les statistiques réunissent les vols classiques et classés transmis, avec une
-- répartition par mode. Seules les classées alimentent highscores, score total
-- et quotas de la team. Aucun e-mail ni identifiant de connexion n’est renvoyé.

create index if not exists team_score_attempts_team_daily_idx
on public.team_score_attempts(team_id, played_on);

create or replace function public.minuit_team_stats(p_days integer default 30)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_team_id uuid;
  v_team_name text;
  v_until date := (now() at time zone 'Europe/Paris')::date;
  v_since date;
  v_summary json;
  v_daily json;
  v_members json;
  v_runs json;
  v_highscores json;
begin
  if v_uid is null then
    raise exception 'AUTH_REQUIRED' using errcode = '42501';
  end if;
  if p_days is null or p_days not between 1 and 365 then
    raise exception 'STATS_PERIOD_INVALID';
  end if;

  select tm.team_id into v_team_id
  from public.team_members tm
  where tm.user_id = v_uid;

  if v_team_id is null then
    raise exception 'NOT_IN_TEAM';
  end if;

  -- Le contrôle est serveur : masquer le bouton dans le jeu ne suffit pas.
  select t.name into v_team_name
  from public.teams t
  where t.id = v_team_id and t.created_by = v_uid;
  if v_team_name is null then
    raise exception 'TEAM_ADMIN_REQUIRED';
  end if;

  v_since := v_until - (p_days - 1);

  -- Activité complète : les deux modes sont additionnés pour le suivi, puis
  -- détaillés séparément pour repérer les joueurs qui oublient la classée.
  select json_build_object(
    'games', count(*),
    'points', coalesce(sum(ta.score), 0),
    'bestScore', coalesce(max(ta.score), 0),
    'bestProgress', coalesce(max(ta.stage::integer * 10 + ta.wave), 0),
    'activePlayers', count(distinct ta.user_id),
    'rankedGames', count(*) filter (where ta.mode = 'ranked'),
    'rankedPoints', coalesce(sum(ta.score) filter (where ta.mode = 'ranked'), 0),
    'rankedBestScore', coalesce(max(ta.score) filter (where ta.mode = 'ranked'), 0),
    'freeGames', count(*) filter (where ta.mode = 'free'),
    'freePoints', coalesce(sum(ta.score) filter (where ta.mode = 'free'), 0),
    'freeBestScore', coalesce(max(ta.score) filter (where ta.mode = 'free'), 0)
  ) into v_summary
  from public.team_score_attempts ta
  where ta.team_id = v_team_id
    and ta.mode in ('ranked', 'free')
    and ta.played_on between v_since and v_until;

  select coalesce(
    json_agg(row_to_json(daily) order by daily."playedOn" desc),
    '[]'::json
  ) into v_daily
  from (
    select
      ta.played_on as "playedOn",
      count(*) as games,
      sum(ta.score) as points,
      max(ta.score) as "bestScore",
      max(ta.stage::integer * 10 + ta.wave) as "bestProgress",
      count(*) filter (where ta.mode = 'ranked') as "rankedGames",
      count(*) filter (where ta.mode = 'free') as "freeGames",
      coalesce(sum(ta.score) filter (where ta.mode = 'ranked'), 0) as "rankedPoints",
      coalesce(sum(ta.score) filter (where ta.mode = 'free'), 0) as "freePoints"
    from public.team_score_attempts ta
    where ta.team_id = v_team_id
      and ta.mode in ('ranked', 'free')
      and ta.played_on between v_since and v_until
    group by ta.played_on
  ) daily;

  -- Les membres sans vol restent visibles avec des compteurs à zéro.
  select coalesce(
    json_agg(
      row_to_json(member_stats)
      order by member_stats.points desc, lower(member_stats."displayName"), member_stats."displayName"
    ),
    '[]'::json
  ) into v_members
  from (
    select
      tm.display_name as "displayName",
      count(ta.run_id) as games,
      coalesce(sum(ta.score), 0) as points,
      coalesce(max(ta.score), 0) as "bestScore",
      coalesce(max(ta.stage::integer * 10 + ta.wave), 0) as "bestProgress",
      max(ta.created_at) as "lastPlayedAt",
      count(ta.run_id) filter (where ta.mode = 'ranked') as "rankedGames",
      count(ta.run_id) filter (where ta.mode = 'free') as "freeGames",
      coalesce(sum(ta.score) filter (where ta.mode = 'ranked'), 0) as "rankedPoints",
      coalesce(sum(ta.score) filter (where ta.mode = 'free'), 0) as "freePoints",
      max(ta.created_at) filter (where ta.mode = 'ranked') as "lastRankedAt",
      max(ta.created_at) filter (where ta.mode = 'free') as "lastFreeAt",
      (tm.user_id = t.created_by) as "isAdmin",
      (tm.user_id = v_uid) as "isYou"
    from public.team_members tm
    join public.teams t on t.id = tm.team_id
    left join public.team_score_attempts ta
      on ta.team_id = tm.team_id
      and ta.user_id = tm.user_id
      and ta.mode in ('ranked', 'free')
      and ta.played_on between v_since and v_until
    where tm.team_id = v_team_id
    group by tm.user_id, tm.display_name, t.created_by
  ) member_stats;

  select coalesce(json_agg(row_to_json(recent)), '[]'::json) into v_runs
  from (
    select
      ta.created_at as "playedAt",
      ta.played_on as "playedOn",
      tm.display_name as "displayName",
      ta.score,
      ta.stage,
      ta.wave,
      ta.mode,
      ta.difficulty,
      (ta.user_id = v_uid) as "isYou"
    from public.team_score_attempts ta
    join public.team_members tm
      on tm.team_id = ta.team_id and tm.user_id = ta.user_id
    where ta.team_id = v_team_id
      and ta.mode in ('ranked', 'free')
      and ta.played_on between v_since and v_until
    order by ta.created_at desc, ta.run_id desc
    limit 50
  ) recent;

  -- Les highscores restent strictement classés et ne sont pas transformés en
  -- parties ou en points lorsqu'aucune tentative détaillée n'existe.
  select coalesce(
    json_agg(row_to_json(highscore) order by highscore.score desc, lower(highscore."displayName"), highscore."displayName"),
    '[]'::json
  ) into v_highscores
  from (
    select
      tm.display_name as "displayName",
      ts.score,
      ts.stage,
      ts.wave,
      ts.mode,
      ts.difficulty,
      ts.updated_at as "updatedAt",
      (tm.user_id = t.created_by) as "isAdmin",
      (tm.user_id = v_uid) as "isYou"
    from public.team_scores ts
    join public.team_members tm
      on tm.team_id = ts.team_id and tm.user_id = ts.user_id
    join public.teams t on t.id = ts.team_id
    where ts.team_id = v_team_id
      and ts.mode = 'ranked'
  ) highscore;

  return json_build_object(
    'team', json_build_object('name', v_team_name),
    'period', json_build_object('days', p_days, 'since', v_since, 'until', v_until),
    'activityScope', 'classic-and-ranked',
    'summary', v_summary,
    'daily', coalesce(v_daily, '[]'::json),
    'members', coalesce(v_members, '[]'::json),
    'runs', coalesce(v_runs, '[]'::json),
    'highscores', coalesce(v_highscores, '[]'::json)
  );
end;
$$;

revoke all on function public.minuit_team_stats(integer) from public, anon, authenticated;
grant execute on function public.minuit_team_stats(integer) to authenticated;
