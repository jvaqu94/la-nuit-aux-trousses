-- Sprint hebdomadaire : records de team séparés de la campagne.
-- À exécuter après teams.sql et team_rules.sql. Aucun score n'est inséré dans
-- team_scores ni dans les essais quotidiens de la campagne.

create table if not exists public.team_weekly_sprints (
  team_id uuid not null,
  user_id uuid not null,
  week_start date not null,
  run_id text not null check (char_length(run_id) between 1 and 80),
  score integer not null check (score between 0 and 100000000),
  time_seconds integer not null check (time_seconds between 0 and 7200),
  wave smallint not null check (wave between 1 and 3),
  won boolean not null,
  updated_at timestamptz not null default now(),
  primary key (team_id, user_id, week_start),
  foreign key (team_id, user_id)
    references public.team_members(team_id, user_id) on delete cascade
);

create index if not exists team_weekly_sprints_board_idx
on public.team_weekly_sprints(team_id, week_start);

alter table public.team_weekly_sprints enable row level security;
revoke all on table public.team_weekly_sprints from anon, authenticated;

create or replace function public.minuit_weekly_sprint_board(p_week date)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_team_id uuid;
  v_team json;
  v_scores json;
begin
  if v_uid is null then
    raise exception 'AUTH_REQUIRED' using errcode = '42501';
  end if;
  if p_week is null or extract(isodow from p_week) <> 1 then
    raise exception 'WEEK_INVALID';
  end if;

  select tm.team_id into v_team_id
  from public.team_members tm
  where tm.user_id = v_uid;

  if v_team_id is null then
    return json_build_object('team', null, 'scores', json_build_array());
  end if;

  select json_build_object(
    'id', t.id,
    'name', t.name,
    'memberCount', (select count(*) from public.team_members tm where tm.team_id = t.id)
  ) into v_team
  from public.teams t
  where t.id = v_team_id;

  select coalesce(
    json_agg(row_to_json(ranked) order by ranked.rank),
    '[]'::json
  ) into v_scores
  from (
    select
      row_number() over (
        order by coalesce(ws.score, 0) desc,
          coalesce(ws.won, false) desc,
          coalesce(ws.time_seconds, 7200) asc,
          lower(tm.display_name), tm.display_name
      ) as rank,
      tm.display_name as "displayName",
      ws.score,
      ws.time_seconds as "time",
      ws.wave,
      ws.won,
      (ws.user_id is not null) as played,
      ws.updated_at as "updatedAt",
      (tm.user_id = v_uid) as "isYou"
    from public.team_members tm
    left join public.team_weekly_sprints ws
      on ws.team_id = tm.team_id and ws.user_id = tm.user_id
      and ws.week_start = p_week
    where tm.team_id = v_team_id
  ) ranked;

  return json_build_object('team', v_team, 'scores', coalesce(v_scores, '[]'::json));
end;
$$;

create or replace function public.minuit_submit_weekly_sprint(
  p_week date,
  p_run_id text,
  p_score integer,
  p_time_seconds integer,
  p_wave integer,
  p_won boolean
)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_team_id uuid;
  v_today date := (now() at time zone 'Europe/Paris')::date;
  v_current_week date;
  v_previous integer;
  v_previous_time integer;
  v_previous_won boolean;
  v_best integer;
  v_improved boolean;
  v_board json;
begin
  if v_uid is null then
    raise exception 'AUTH_REQUIRED' using errcode = '42501';
  end if;
  v_current_week := v_today - (extract(isodow from v_today)::integer - 1);
  if p_week is null or p_week <> v_current_week then
    raise exception 'WEEK_CLOSED';
  end if;
  if p_run_id is null or char_length(trim(p_run_id)) not between 1 and 80 then
    raise exception 'RUN_INVALID';
  end if;
  if p_score is null or p_score not between 0 and 100000000 then
    raise exception 'SCORE_INVALID';
  end if;
  if p_time_seconds is null or p_time_seconds not between 0 and 7200 then
    raise exception 'TIME_INVALID';
  end if;
  if p_wave is null or p_wave not between 1 and 3 or p_won is null then
    raise exception 'PROGRESS_INVALID';
  end if;

  select tm.team_id into v_team_id
  from public.team_members tm
  where tm.user_id = v_uid;
  if v_team_id is null then
    raise exception 'NOT_IN_TEAM';
  end if;

  select ws.score, ws.time_seconds, ws.won
    into v_previous, v_previous_time, v_previous_won
  from public.team_weekly_sprints ws
  where ws.team_id = v_team_id and ws.user_id = v_uid and ws.week_start = p_week;

  v_improved := v_previous is null or p_score > v_previous or (
    p_score = v_previous and (
      (p_won and not v_previous_won)
      or (p_won = v_previous_won and p_time_seconds < v_previous_time)
    )
  );

  insert into public.team_weekly_sprints(
    team_id, user_id, week_start, run_id, score, time_seconds, wave, won, updated_at
  ) values (
    v_team_id, v_uid, p_week, trim(p_run_id), p_score, p_time_seconds, p_wave, p_won, now()
  )
  on conflict (team_id, user_id, week_start) do update set
    run_id = excluded.run_id,
    score = excluded.score,
    time_seconds = excluded.time_seconds,
    wave = excluded.wave,
    won = excluded.won,
    updated_at = now()
  where excluded.score > public.team_weekly_sprints.score
    or (excluded.score = public.team_weekly_sprints.score and (
      (excluded.won and not public.team_weekly_sprints.won)
      or (excluded.won = public.team_weekly_sprints.won
        and excluded.time_seconds < public.team_weekly_sprints.time_seconds)
    ));

  select ws.score into v_best
  from public.team_weekly_sprints ws
  where ws.team_id = v_team_id and ws.user_id = v_uid and ws.week_start = p_week;

  v_board := public.minuit_weekly_sprint_board(p_week);
  return json_build_object(
    'team', v_board->'team',
    'scores', v_board->'scores',
    'result', json_build_object('bestScore', v_best, 'improved', v_improved)
  );
end;
$$;

revoke all on function public.minuit_weekly_sprint_board(date) from public, anon, authenticated;
revoke all on function public.minuit_submit_weekly_sprint(date, text, integer, integer, integer, boolean) from public, anon, authenticated;
grant execute on function public.minuit_weekly_sprint_board(date) to authenticated;
grant execute on function public.minuit_submit_weekly_sprint(date, text, integer, integer, integer, boolean) to authenticated;

-- Comme pour le classement amical de campagne, le serveur contrôle l'appartenance
-- à la team et les bornes des données, mais ne prouve pas le déroulé du vol dans
-- un navigateur modifiable. Aucune fonction ou table n'est ouverte à l'anonyme.
