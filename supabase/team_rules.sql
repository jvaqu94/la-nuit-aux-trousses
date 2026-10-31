-- La Nuit aux Trousses — administration et règles des teams.
-- À exécuter après teams.sql. Le créateur est administrateur ; les limites
-- concernent les scores de team, jamais la possibilité de jouer localement.

alter table public.teams add column if not exists daily_game_limit integer;
alter table public.teams add column if not exists starts_at timestamptz;
alter table public.teams add column if not exists ends_at timestamptz;
alter table public.teams add column if not exists rules_configured boolean not null default false;
alter table public.teams alter column daily_game_limit set default 3;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'teams_daily_game_limit_check'
      and conrelid = 'public.teams'::regclass
  ) then
    alter table public.teams add constraint teams_daily_game_limit_check
      check (daily_game_limit is null or daily_game_limit between 1 and 100);
  end if;
  if not exists (
    select 1 from pg_constraint
    where conname = 'teams_period_check'
      and conrelid = 'public.teams'::regclass
  ) then
    alter table public.teams add constraint teams_period_check
      check (starts_at is null or ends_at is null or ends_at > starts_at);
  end if;
end;
$$;

-- Chaque vol ne peut être compté qu’une fois, même si le client réessaie.
create table if not exists public.team_score_attempts (
  team_id uuid not null,
  user_id uuid not null,
  run_id text not null check (char_length(run_id) between 1 and 80),
  played_on date not null,
  score integer not null check (score between 0 and 100000000),
  mode text not null check (mode in ('free', 'ranked', 'daily')),
  difficulty text not null check (difficulty in ('easy', 'normal', 'hard')),
  stage smallint not null check (stage between 1 and 5),
  wave smallint not null check (wave between 1 and 5),
  created_at timestamptz not null default now(),
  primary key (team_id, user_id, run_id),
  foreign key (team_id, user_id)
    references public.team_members(team_id, user_id) on delete cascade
);

create index if not exists team_score_attempts_daily_idx
on public.team_score_attempts(team_id, user_id, played_on);

alter table public.team_score_attempts enable row level security;
revoke all on table public.team_score_attempts from anon, authenticated;

create or replace function public.minuit_team_state()
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

  select tm.team_id into v_team_id
  from public.team_members tm
  where tm.user_id = v_uid;

  if v_team_id is null then
    return json_build_object('team', null, 'scores', json_build_array());
  end if;

  select json_build_object(
    'id', t.id,
    'name', t.name,
    'code', t.join_code,
    'memberCount', (select count(*) from public.team_members tm where tm.team_id = t.id),
    'totalScore', (select coalesce(sum(ts.score), 0) from public.team_scores ts where ts.team_id = t.id and ts.mode = 'ranked'),
    'isAdmin', (t.created_by = v_uid),
    'rulesConfigured', t.rules_configured,
    'dailyGameLimit', t.daily_game_limit,
    'startsAt', t.starts_at,
    'endsAt', t.ends_at,
    'gamesToday', (
      select count(*) from public.team_score_attempts ta
      where ta.team_id = t.id and ta.user_id = v_uid
        and ta.played_on = (now() at time zone 'Europe/Paris')::date
        and ta.mode = 'ranked'
    ),
    'gamesRemaining', case
      when t.daily_game_limit is null then null
      else greatest(t.daily_game_limit - (
        select count(*) from public.team_score_attempts ta
        where ta.team_id = t.id and ta.user_id = v_uid
          and ta.played_on = (now() at time zone 'Europe/Paris')::date
          and ta.mode = 'ranked'
      ), 0)
    end
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
        order by coalesce(ts.score, 0) desc, lower(tm.display_name), tm.display_name
      ) as rank,
      tm.display_name as "displayName",
      coalesce(ts.score, 0) as score,
      ts.mode,
      ts.difficulty,
      ts.stage,
      ts.wave,
      ts.updated_at as "updatedAt",
      (tm.user_id = v_uid) as "isYou",
      (tm.user_id = t.created_by) as "isAdmin"
    from public.team_members tm
    join public.teams t on t.id = tm.team_id
    left join public.team_scores ts
      on ts.team_id = tm.team_id and ts.user_id = tm.user_id and ts.mode = 'ranked'
    where tm.team_id = v_team_id
  ) ranked;

  return json_build_object('team', v_team, 'scores', coalesce(v_scores, '[]'::json));
end;
$$;

drop function if exists public.minuit_create_team(text, text);
create or replace function public.minuit_create_team(
  p_name text,
  p_display_name text,
  p_daily_game_limit integer,
  p_starts_at timestamptz,
  p_ends_at timestamptz
)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_name text := trim(coalesce(p_name, ''));
  v_display_name text := trim(coalesce(p_display_name, ''));
  v_alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_code text;
  v_team_id uuid;
  v_attempt integer;
  v_index integer;
begin
  if v_uid is null then
    raise exception 'AUTH_REQUIRED' using errcode = '42501';
  end if;
  if char_length(v_name) not between 2 and 40 then
    raise exception 'TEAM_NAME_INVALID';
  end if;
  if char_length(v_display_name) not between 2 and 24 or v_display_name ~ '[[:cntrl:]]' then
    raise exception 'DISPLAY_NAME_INVALID';
  end if;
  if p_daily_game_limit is not null and p_daily_game_limit not between 1 and 100 then
    raise exception 'DAILY_LIMIT_INVALID';
  end if;
  if p_starts_at is not null and p_ends_at is not null and p_ends_at <= p_starts_at then
    raise exception 'PERIOD_INVALID';
  end if;
  if exists (select 1 from public.team_members tm where tm.user_id = v_uid) then
    raise exception 'ALREADY_IN_TEAM';
  end if;

  for v_attempt in 1..12 loop
    v_code := '';
    for v_index in 1..10 loop
      v_code := v_code || substr(
        v_alphabet,
        1 + floor(random() * char_length(v_alphabet))::integer,
        1
      );
    end loop;
    begin
      insert into public.teams(
        name, join_code, created_by, daily_game_limit, starts_at, ends_at, rules_configured
      ) values (
        v_name, v_code, v_uid, p_daily_game_limit, p_starts_at, p_ends_at, true
      ) returning id into v_team_id;
    exception when unique_violation then
      v_team_id := null;
    end;
    exit when v_team_id is not null;
  end loop;

  if v_team_id is null then
    raise exception 'TEAM_CODE_UNAVAILABLE';
  end if;

  begin
    insert into public.team_members(team_id, user_id, display_name)
    values (v_team_id, v_uid, v_display_name);
  exception when unique_violation then
    raise exception 'ALREADY_IN_TEAM';
  end;

  return public.minuit_team_state();
end;
$$;

create or replace function public.minuit_update_team_rules(
  p_daily_game_limit integer,
  p_starts_at timestamptz,
  p_ends_at timestamptz
)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_team_id uuid;
begin
  if v_uid is null then
    raise exception 'AUTH_REQUIRED' using errcode = '42501';
  end if;
  if p_daily_game_limit is not null and p_daily_game_limit not between 1 and 100 then
    raise exception 'DAILY_LIMIT_INVALID';
  end if;
  if p_starts_at is not null and p_ends_at is not null and p_ends_at <= p_starts_at then
    raise exception 'PERIOD_INVALID';
  end if;

  update public.teams t
  set daily_game_limit = p_daily_game_limit,
      starts_at = p_starts_at,
      ends_at = p_ends_at,
      rules_configured = true
  where t.id = (select tm.team_id from public.team_members tm where tm.user_id = v_uid)
    and t.created_by = v_uid
  returning t.id into v_team_id;

  if v_team_id is null then
    raise exception 'TEAM_ADMIN_REQUIRED';
  end if;
  return public.minuit_team_state();
end;
$$;

create or replace function public.minuit_leave_team()
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_team_id uuid;
begin
  if v_uid is null then
    raise exception 'AUTH_REQUIRED' using errcode = '42501';
  end if;

  select tm.team_id into v_team_id
  from public.team_members tm
  where tm.user_id = v_uid;
  if v_team_id is null then
    raise exception 'NOT_IN_TEAM';
  end if;

  delete from public.team_members tm
  where tm.user_id = v_uid and tm.team_id = v_team_id;

  if not exists (select 1 from public.team_members tm where tm.team_id = v_team_id) then
    delete from public.teams t where t.id = v_team_id;
  elsif exists (select 1 from public.teams t where t.id = v_team_id and t.created_by = v_uid) then
    -- Le membre le plus ancien reprend l’administration.
    update public.teams t
    set created_by = (
      select tm.user_id from public.team_members tm
      where tm.team_id = v_team_id
      order by tm.joined_at, tm.user_id
      limit 1
    )
    where t.id = v_team_id;
  end if;

  return json_build_object('team', null, 'scores', json_build_array());
end;
$$;

drop function if exists public.minuit_submit_team_score(integer, text, text, integer, integer);
create or replace function public.minuit_submit_team_score(
  p_score integer,
  p_mode text,
  p_difficulty text,
  p_stage integer,
  p_wave integer,
  p_run_id text
)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_team_id uuid;
  v_previous integer;
  v_best integer;
  v_daily_limit integer;
  v_rules_configured boolean;
  v_starts_at timestamptz;
  v_ends_at timestamptz;
  v_today date := (now() at time zone 'Europe/Paris')::date;
  v_games_today integer;
  v_run_id text := trim(coalesce(p_run_id, ''));
  v_existing_run text;
begin
  if v_uid is null then
    raise exception 'AUTH_REQUIRED' using errcode = '42501';
  end if;
  if p_score is null or p_score not between 0 and 100000000 then
    raise exception 'SCORE_INVALID';
  end if;
  if p_mode is null or p_mode <> 'ranked' then
    raise exception 'MODE_INVALID';
  end if;
  if p_difficulty is null or p_difficulty not in ('easy', 'normal', 'hard') then
    raise exception 'DIFFICULTY_INVALID';
  end if;
  if p_stage is null or p_stage not between 1 and 5 or p_wave is null or p_wave not between 1 and 5 then
    raise exception 'PROGRESS_INVALID';
  end if;
  if char_length(v_run_id) not between 1 and 80 then
    raise exception 'RUN_ID_INVALID';
  end if;

  -- Le verrou du membre rend le comptage quotidien fiable en cas d’envois simultanés.
  select tm.team_id into v_team_id
  from public.team_members tm
  where tm.user_id = v_uid
  for update;
  if v_team_id is null then
    raise exception 'NOT_IN_TEAM';
  end if;

  select t.daily_game_limit, t.rules_configured, t.starts_at, t.ends_at
  into v_daily_limit, v_rules_configured, v_starts_at, v_ends_at
  from public.teams t
  where t.id = v_team_id;

  select count(*) into v_games_today
  from public.team_score_attempts ta
  where ta.team_id = v_team_id and ta.user_id = v_uid and ta.played_on = v_today and ta.mode = 'ranked';

  select ta.run_id into v_existing_run
  from public.team_score_attempts ta
  where ta.team_id = v_team_id and ta.user_id = v_uid and ta.run_id = v_run_id;
  if v_existing_run is not null then
    select ts.score into v_best
    from public.team_scores ts
    where ts.team_id = v_team_id and ts.user_id = v_uid and ts.mode = 'ranked';
    return json_build_object(
      'bestScore', coalesce(v_best, 0),
      'improved', false,
      'duplicate', true,
      'gamesToday', v_games_today,
      'gamesRemaining', case when v_daily_limit is null then null else greatest(v_daily_limit - v_games_today, 0) end
    );
  end if;

  if not v_rules_configured then
    raise exception 'TEAM_RULES_REQUIRED';
  end if;
  if v_starts_at is not null and now() < v_starts_at then
    raise exception 'TEAM_PERIOD_NOT_STARTED';
  end if;
  if v_ends_at is not null and now() >= v_ends_at then
    raise exception 'TEAM_PERIOD_ENDED';
  end if;
  if v_daily_limit is not null and v_games_today >= v_daily_limit then
    raise exception 'TEAM_DAILY_LIMIT';
  end if;

  select ts.score into v_previous
  from public.team_scores ts
  where ts.team_id = v_team_id and ts.user_id = v_uid and ts.mode = 'ranked';

  insert into public.team_score_attempts(
    team_id, user_id, run_id, played_on, score, mode, difficulty, stage, wave
  ) values (
    v_team_id, v_uid, v_run_id, v_today, p_score, p_mode, p_difficulty, p_stage, p_wave
  );

  insert into public.team_scores(team_id, user_id, score, mode, difficulty, stage, wave, updated_at)
  values (v_team_id, v_uid, p_score, p_mode, p_difficulty, p_stage, p_wave, now())
  on conflict (team_id, user_id) do update set
    score = case when public.team_scores.mode <> 'ranked' then excluded.score else greatest(public.team_scores.score, excluded.score) end,
    mode = case when public.team_scores.mode <> 'ranked' or excluded.score > public.team_scores.score then excluded.mode else public.team_scores.mode end,
    difficulty = case when public.team_scores.mode <> 'ranked' or excluded.score > public.team_scores.score then excluded.difficulty else public.team_scores.difficulty end,
    stage = case when public.team_scores.mode <> 'ranked' or excluded.score > public.team_scores.score then excluded.stage else public.team_scores.stage end,
    wave = case when public.team_scores.mode <> 'ranked' or excluded.score > public.team_scores.score then excluded.wave else public.team_scores.wave end,
    updated_at = case when public.team_scores.mode <> 'ranked' or excluded.score > public.team_scores.score then now() else public.team_scores.updated_at end
  returning score into v_best;

  return json_build_object(
    'bestScore', v_best,
    'improved', v_previous is null or p_score > v_previous,
    'duplicate', false,
    'gamesToday', v_games_today + 1,
    'gamesRemaining', case when v_daily_limit is null then null else greatest(v_daily_limit - v_games_today - 1, 0) end
  );
end;
$$;

-- Réinitialisation complète de la campagne par le créateur de la team.
-- Les membres, le code d'invitation et les règles sont conservés.
create or replace function public.minuit_reset_team_campaign()
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_team_id uuid;
begin
  if v_uid is null then
    raise exception 'AUTH_REQUIRED' using errcode = '42501';
  end if;

  select tm.team_id into v_team_id
  from public.team_members tm
  where tm.user_id = v_uid;
  if v_team_id is null then
    raise exception 'NOT_IN_TEAM';
  end if;
  if not exists (
    select 1 from public.teams t
    where t.id = v_team_id and t.created_by = v_uid
  ) then
    raise exception 'TEAM_ADMIN_REQUIRED' using errcode = '42501';
  end if;

  -- Une partie terminée après cette remise à zéro pourra être comptée normalement.
  select t.id into v_team_id from public.teams t
  where t.id = v_team_id
  for update;
  -- Chaque envoi de score verrouille déjà son membre : les fins de vol et la
  -- réinitialisation sont ainsi cohérentes, même si elles sont simultanées.
  perform tm.user_id from public.team_members tm
  where tm.team_id = v_team_id
  order by tm.user_id
  for update;
  delete from public.team_score_attempts ta where ta.team_id = v_team_id;
  delete from public.team_scores ts where ts.team_id = v_team_id;

  return public.minuit_team_state();
end;
$$;

create or replace function public.minuit_delete_team()
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_team_id uuid;
  v_deleted uuid;
begin
  if v_uid is null then
    raise exception 'AUTH_REQUIRED' using errcode = '42501';
  end if;
  select tm.team_id into v_team_id
  from public.team_members tm
  where tm.user_id = v_uid;
  if v_team_id is null then
    raise exception 'NOT_IN_TEAM';
  end if;

  delete from public.teams t
  where t.id = v_team_id and t.created_by = v_uid
  returning t.id into v_deleted;
  if v_deleted is null then
    raise exception 'TEAM_ADMIN_REQUIRED';
  end if;
  -- Les membres, scores et tentatives sont supprimés par les cascades.
  return json_build_object('team', null, 'scores', json_build_array(), 'deleted', true);
end;
$$;

revoke all on function public.minuit_create_team(text, text, integer, timestamptz, timestamptz) from public, anon, authenticated;
revoke all on function public.minuit_update_team_rules(integer, timestamptz, timestamptz) from public, anon, authenticated;
revoke all on function public.minuit_submit_team_score(integer, text, text, integer, integer, text) from public, anon, authenticated;
revoke all on function public.minuit_team_state() from public, anon, authenticated;
revoke all on function public.minuit_leave_team() from public, anon, authenticated;
revoke all on function public.minuit_reset_team_campaign() from public, anon, authenticated;
revoke all on function public.minuit_delete_team() from public, anon, authenticated;

grant execute on function public.minuit_create_team(text, text, integer, timestamptz, timestamptz) to authenticated;
grant execute on function public.minuit_update_team_rules(integer, timestamptz, timestamptz) to authenticated;
grant execute on function public.minuit_submit_team_score(integer, text, text, integer, integer, text) to authenticated;
grant execute on function public.minuit_team_state() to authenticated;
grant execute on function public.minuit_leave_team() to authenticated;
grant execute on function public.minuit_reset_team_campaign() to authenticated;
grant execute on function public.minuit_delete_team() to authenticated;
