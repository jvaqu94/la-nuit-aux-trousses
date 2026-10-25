-- La Nuit aux Trousses — teams privées et highscores partagés.
-- Une team par joueur. Les tables ne sont pas exposées directement à l’API :
-- seules les fonctions ci-dessous sont exécutables par les comptes connectés.

create table if not exists public.teams (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 40),
  join_code text not null unique check (join_code ~ '^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{10}$'),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.team_members (
  team_id uuid not null references public.teams(id) on delete cascade,
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (
    char_length(display_name) between 2 and 24
    and display_name !~ '[[:cntrl:]]'
  ),
  joined_at timestamptz not null default now(),
  unique (team_id, user_id)
);

create table if not exists public.team_scores (
  team_id uuid not null,
  user_id uuid not null,
  score integer not null check (score between 0 and 100000000),
  mode text not null check (mode in ('free', 'ranked', 'daily')),
  difficulty text not null check (difficulty in ('easy', 'normal', 'hard')),
  stage smallint not null check (stage between 1 and 5),
  wave smallint not null check (wave between 1 and 5),
  updated_at timestamptz not null default now(),
  primary key (team_id, user_id),
  foreign key (team_id, user_id)
    references public.team_members(team_id, user_id) on delete cascade
);

alter table public.teams enable row level security;
alter table public.team_members enable row level security;
alter table public.team_scores enable row level security;

revoke all on table public.teams from anon, authenticated;
revoke all on table public.team_members from anon, authenticated;
revoke all on table public.team_scores from anon, authenticated;

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
    'totalScore', (select coalesce(sum(ts.score), 0) from public.team_scores ts where ts.team_id = t.id)
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
      (tm.user_id = v_uid) as "isYou"
    from public.team_members tm
    left join public.team_scores ts
      on ts.team_id = tm.team_id and ts.user_id = tm.user_id
    where tm.team_id = v_team_id
  ) ranked;

  return json_build_object('team', v_team, 'scores', coalesce(v_scores, '[]'::json));
end;
$$;

create or replace function public.minuit_create_team(p_name text, p_display_name text)
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
  if exists (select 1 from public.team_members tm where tm.user_id = v_uid) then
    raise exception 'ALREADY_IN_TEAM';
  end if;

  -- Dix caractères parmi 32, sans I/O ni 0/1 pour éviter les confusions.
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
      insert into public.teams(name, join_code, created_by)
      values (v_name, v_code, v_uid)
      returning id into v_team_id;
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

create or replace function public.minuit_join_team(p_code text, p_display_name text)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_display_name text := trim(coalesce(p_display_name, ''));
  v_code text := upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g'));
  v_team_id uuid;
begin
  if v_uid is null then
    raise exception 'AUTH_REQUIRED' using errcode = '42501';
  end if;
  if char_length(v_display_name) not between 2 and 24 or v_display_name ~ '[[:cntrl:]]' then
    raise exception 'DISPLAY_NAME_INVALID';
  end if;
  if exists (select 1 from public.team_members tm where tm.user_id = v_uid) then
    raise exception 'ALREADY_IN_TEAM';
  end if;

  select t.id into v_team_id
  from public.teams t
  where t.join_code = v_code;
  if v_team_id is null then
    raise exception 'TEAM_NOT_FOUND';
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

  -- Une team vide et ses codes ne restent pas indéfiniment en base.
  if not exists (select 1 from public.team_members tm where tm.team_id = v_team_id) then
    delete from public.teams t where t.id = v_team_id;
  end if;

  return json_build_object('team', null, 'scores', json_build_array());
end;
$$;

create or replace function public.minuit_submit_team_score(
  p_score integer,
  p_mode text,
  p_difficulty text,
  p_stage integer,
  p_wave integer
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
begin
  if v_uid is null then
    raise exception 'AUTH_REQUIRED' using errcode = '42501';
  end if;
  if p_score is null or p_score not between 0 and 100000000 then
    raise exception 'SCORE_INVALID';
  end if;
  if p_mode is null or p_mode not in ('free', 'ranked', 'daily') then
    raise exception 'MODE_INVALID';
  end if;
  if p_difficulty is null or p_difficulty not in ('easy', 'normal', 'hard') then
    raise exception 'DIFFICULTY_INVALID';
  end if;
  if p_stage is null or p_stage not between 1 and 5 or p_wave is null or p_wave not between 1 and 5 then
    raise exception 'PROGRESS_INVALID';
  end if;

  select tm.team_id into v_team_id
  from public.team_members tm
  where tm.user_id = v_uid;
  if v_team_id is null then
    raise exception 'NOT_IN_TEAM';
  end if;

  select ts.score into v_previous
  from public.team_scores ts
  where ts.team_id = v_team_id and ts.user_id = v_uid;

  insert into public.team_scores(team_id, user_id, score, mode, difficulty, stage, wave, updated_at)
  values (v_team_id, v_uid, p_score, p_mode, p_difficulty, p_stage, p_wave, now())
  on conflict (team_id, user_id) do update set
    score = greatest(public.team_scores.score, excluded.score),
    mode = case when excluded.score > public.team_scores.score then excluded.mode else public.team_scores.mode end,
    difficulty = case when excluded.score > public.team_scores.score then excluded.difficulty else public.team_scores.difficulty end,
    stage = case when excluded.score > public.team_scores.score then excluded.stage else public.team_scores.stage end,
    wave = case when excluded.score > public.team_scores.score then excluded.wave else public.team_scores.wave end,
    updated_at = case when excluded.score > public.team_scores.score then now() else public.team_scores.updated_at end
  returning score into v_best;

  return json_build_object(
    'bestScore', v_best,
    'improved', v_previous is null or p_score > v_previous
  );
end;
$$;

-- Les fonctions ne sont ni anonymes ni publiques. Leur propriétaire applique
-- les contrôles auth.uid() ci-dessus, sans accès direct aux tables par l’API.
revoke all on function public.minuit_team_state() from public, anon, authenticated;
revoke all on function public.minuit_create_team(text, text) from public, anon, authenticated;
revoke all on function public.minuit_join_team(text, text) from public, anon, authenticated;
revoke all on function public.minuit_leave_team() from public, anon, authenticated;
revoke all on function public.minuit_submit_team_score(integer, text, text, integer, integer) from public, anon, authenticated;

grant execute on function public.minuit_team_state() to authenticated;
grant execute on function public.minuit_create_team(text, text) to authenticated;
grant execute on function public.minuit_join_team(text, text) to authenticated;
grant execute on function public.minuit_leave_team() to authenticated;
grant execute on function public.minuit_submit_team_score(integer, text, text, integer, integer) to authenticated;

-- Classement amical : ces fonctions authentifient le membre et conservent son
-- meilleur score, mais ne prouvent pas le déroulé d’une partie jouée dans un
-- navigateur modifiable. Une compétition anti-triche exige une validation
-- serveur des parties ou un service de rejeu signé.
