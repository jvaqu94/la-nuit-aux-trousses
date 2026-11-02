-- La Nuit aux Trousses — périodes classées et historique des highscores.
-- À exécuter après teams.sql, team_rules.sql et team_stats.sql.
-- Prolonger une période conserve ses scores. En lancer une nouvelle archive
-- d'abord le classement complet, puis remet uniquement les highscores à zéro.

create table if not exists public.team_ranked_periods (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  period_number integer not null check (period_number > 0),
  starts_at timestamptz,
  ends_at timestamptz,
  daily_game_limit integer,
  is_current boolean not null default true,
  created_by uuid,
  created_at timestamptz not null default now(),
  archived_at timestamptz,
  constraint team_ranked_periods_period_check
    check (starts_at is null or ends_at is null or ends_at > starts_at),
  constraint team_ranked_periods_daily_limit_check
    check (daily_game_limit is null or daily_game_limit between 1 and 100),
  constraint team_ranked_periods_archive_check
    check ((is_current and archived_at is null) or (not is_current and archived_at is not null)),
  unique (team_id, period_number)
);

create unique index if not exists team_ranked_periods_current_idx
on public.team_ranked_periods(team_id) where is_current;

create table if not exists public.team_ranked_period_scores (
  period_id uuid not null references public.team_ranked_periods(id) on delete cascade,
  user_id uuid not null,
  display_name text not null,
  rank integer not null check (rank > 0),
  score integer not null check (score between 0 and 100000000),
  difficulty text check (difficulty is null or difficulty in ('easy', 'normal', 'hard')),
  stage smallint check (stage is null or stage between 1 and 5),
  wave smallint check (wave is null or wave between 1 and 5),
  updated_at timestamptz,
  primary key (period_id, user_id),
  unique (period_id, rank)
);

alter table public.team_ranked_periods enable row level security;
alter table public.team_ranked_period_scores enable row level security;
revoke all on table public.team_ranked_periods from anon, authenticated;
revoke all on table public.team_ranked_period_scores from anon, authenticated;

-- Les teams existantes obtiennent leur première période sans perdre leurs scores.
insert into public.team_ranked_periods(
  team_id, period_number, starts_at, ends_at, daily_game_limit,
  is_current, created_by, created_at
)
select
  t.id, 1, t.starts_at, t.ends_at, t.daily_game_limit,
  true, t.created_by, t.created_at
from public.teams t
on conflict do nothing;

-- Toute team créée après cette migration reçoit aussi sa période initiale.
create or replace function public.minuit_initialize_team_period()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.team_ranked_periods(
    team_id, period_number, starts_at, ends_at, daily_game_limit,
    is_current, created_by, created_at
  ) values (
    new.id, 1, new.starts_at, new.ends_at, new.daily_game_limit,
    true, new.created_by, new.created_at
  ) on conflict do nothing;
  return new;
end;
$$;

drop trigger if exists teams_initialize_ranked_period on public.teams;
create trigger teams_initialize_ranked_period
after insert on public.teams
for each row execute function public.minuit_initialize_team_period();

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
    'periodNumber', (
      select rp.period_number from public.team_ranked_periods rp
      where rp.team_id = t.id and rp.is_current
    ),
    'archivedPeriods', (
      select count(*) from public.team_ranked_periods rp
      where rp.team_id = t.id and not rp.is_current
    ),
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

-- Prolonger ou modifier les règles ne change ni la période ni ses highscores.
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

  update public.team_ranked_periods rp
  set daily_game_limit = p_daily_game_limit,
      starts_at = p_starts_at,
      ends_at = p_ends_at
  where rp.team_id = v_team_id and rp.is_current;

  return public.minuit_team_state();
end;
$$;

-- Archive le classement courant puis ouvre une période vierge. Les tentatives
-- restent intactes pour les statistiques et le quota quotidien en cours.
create or replace function public.minuit_start_team_period(
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
  v_period_id uuid;
  v_period_number integer;
  v_next_number integer;
  v_starts_at timestamptz;
  v_ends_at timestamptz;
  v_daily_limit integer;
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
  if p_ends_at is not null and p_ends_at <= now() then
    raise exception 'TEAM_PERIOD_END_FUTURE';
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

  select t.id, t.starts_at, t.ends_at, t.daily_game_limit
  into v_team_id, v_starts_at, v_ends_at, v_daily_limit
  from public.teams t where t.id = v_team_id
  for update;
  perform tm.user_id from public.team_members tm
  where tm.team_id = v_team_id
  order by tm.user_id
  for update;

  select rp.id, rp.period_number into v_period_id, v_period_number
  from public.team_ranked_periods rp
  where rp.team_id = v_team_id and rp.is_current
  for update;

  if v_period_id is null then
    select coalesce(max(rp.period_number), 0) + 1 into v_period_number
    from public.team_ranked_periods rp where rp.team_id = v_team_id;
    insert into public.team_ranked_periods(
      team_id, period_number, starts_at, ends_at, daily_game_limit,
      is_current, created_by, archived_at
    ) values (
      v_team_id, v_period_number, v_starts_at, v_ends_at, v_daily_limit,
      false, v_uid, now()
    ) returning id into v_period_id;
  else
    update public.team_ranked_periods rp
    set is_current = false, archived_at = now()
    where rp.id = v_period_id;
  end if;

  insert into public.team_ranked_period_scores(
    period_id, user_id, display_name, rank, score,
    difficulty, stage, wave, updated_at
  )
  select
    v_period_id,
    tm.user_id,
    tm.display_name,
    (row_number() over (
      order by coalesce(ts.score, 0) desc, lower(tm.display_name), tm.display_name, tm.user_id
    ))::integer,
    coalesce(ts.score, 0),
    ts.difficulty,
    ts.stage,
    ts.wave,
    ts.updated_at
  from public.team_members tm
  left join public.team_scores ts
    on ts.team_id = tm.team_id and ts.user_id = tm.user_id and ts.mode = 'ranked'
  where tm.team_id = v_team_id;

  delete from public.team_scores ts where ts.team_id = v_team_id;

  select coalesce(max(rp.period_number), 0) + 1 into v_next_number
  from public.team_ranked_periods rp where rp.team_id = v_team_id;
  insert into public.team_ranked_periods(
    team_id, period_number, starts_at, ends_at, daily_game_limit,
    is_current, created_by
  ) values (
    v_team_id, v_next_number, p_starts_at, p_ends_at, p_daily_game_limit,
    true, v_uid
  );

  update public.teams t
  set daily_game_limit = p_daily_game_limit,
      starts_at = p_starts_at,
      ends_at = p_ends_at,
      rules_configured = true
  where t.id = v_team_id;

  return public.minuit_team_state();
end;
$$;

-- Tous les membres peuvent consulter les périodes archivées, sans accès direct
-- aux tables et sans exposer les identifiants de connexion.
create or replace function public.minuit_team_period_history()
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_team_id uuid;
  v_team_name text;
  v_periods json;
begin
  if v_uid is null then
    raise exception 'AUTH_REQUIRED' using errcode = '42501';
  end if;

  select tm.team_id, t.name into v_team_id, v_team_name
  from public.team_members tm
  join public.teams t on t.id = tm.team_id
  where tm.user_id = v_uid;
  if v_team_id is null then
    raise exception 'NOT_IN_TEAM';
  end if;

  select coalesce(json_agg(row_to_json(period) order by period."periodNumber" desc), '[]'::json)
  into v_periods
  from (
    select
      rp.period_number as "periodNumber",
      rp.starts_at as "startsAt",
      rp.ends_at as "endsAt",
      rp.archived_at as "archivedAt",
      rp.daily_game_limit as "dailyGameLimit",
      (select coalesce(sum(ps.score), 0) from public.team_ranked_period_scores ps where ps.period_id = rp.id) as "totalScore",
      (select count(*) from public.team_ranked_period_scores ps where ps.period_id = rp.id) as "memberCount",
      (
        select coalesce(json_agg(row_to_json(ranked) order by ranked.rank), '[]'::json)
        from (
          select
            ps.rank,
            ps.display_name as "displayName",
            ps.score,
            ps.difficulty,
            ps.stage,
            ps.wave,
            ps.updated_at as "updatedAt",
            (ps.user_id = v_uid) as "isYou"
          from public.team_ranked_period_scores ps
          where ps.period_id = rp.id
          order by ps.rank
        ) ranked
      ) as scores
    from public.team_ranked_periods rp
    where rp.team_id = v_team_id and not rp.is_current
    order by rp.period_number desc
  ) period;

  return json_build_object(
    'team', json_build_object('name', v_team_name),
    'periods', coalesce(v_periods, '[]'::json)
  );
end;
$$;

-- La remise à zéro complète efface aussi l'historique, comme l'indique l'UI.
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

  select t.id into v_team_id from public.teams t
  where t.id = v_team_id
  for update;
  perform tm.user_id from public.team_members tm
  where tm.team_id = v_team_id
  order by tm.user_id
  for update;
  delete from public.team_score_attempts ta where ta.team_id = v_team_id;
  delete from public.team_scores ts where ts.team_id = v_team_id;
  delete from public.team_ranked_periods rp
  where rp.team_id = v_team_id and not rp.is_current;
  update public.team_ranked_periods rp
  set period_number = 1, created_at = now()
  where rp.team_id = v_team_id and rp.is_current;

  return public.minuit_team_state();
end;
$$;

revoke all on function public.minuit_initialize_team_period() from public, anon, authenticated;
revoke all on function public.minuit_team_state() from public, anon, authenticated;
revoke all on function public.minuit_update_team_rules(integer, timestamptz, timestamptz) from public, anon, authenticated;
revoke all on function public.minuit_start_team_period(integer, timestamptz, timestamptz) from public, anon, authenticated;
revoke all on function public.minuit_team_period_history() from public, anon, authenticated;
revoke all on function public.minuit_reset_team_campaign() from public, anon, authenticated;

grant execute on function public.minuit_team_state() to authenticated;
grant execute on function public.minuit_update_team_rules(integer, timestamptz, timestamptz) to authenticated;
grant execute on function public.minuit_start_team_period(integer, timestamptz, timestamptz) to authenticated;
grant execute on function public.minuit_team_period_history() to authenticated;
grant execute on function public.minuit_reset_team_campaign() to authenticated;
