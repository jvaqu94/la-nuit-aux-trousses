-- La Nuit aux Trousses — Duels de la Nuit noire.
-- Profils de duel indépendants de la campagne et des highscores de team,
-- invitations privées par UUID, draft de 3 atouts parmi 10, consensus à deux
-- rapports idempotents, cotes classées (2 duels/jour/paire Europe/Paris),
-- mises d'éclats de lune et halos cosmétiques.

create table if not exists public.duel_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade default auth.uid(),
  rating integer not null default 1000 check (rating between 0 and 100000),
  moon_shards integer not null default 20 check (moon_shards between 0 and 100000),
  wins integer not null default 0 check (wins >= 0),
  losses integer not null default 0 check (losses >= 0),
  unlocked text[] not null default array['halo-violet']::text[],
  equipped text not null default 'halo-violet',
  updated_at timestamptz not null default now()
);

create table if not exists public.duels (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references auth.users(id) on delete cascade,
  opponent_id uuid references auth.users(id) on delete cascade,
  mode text not null check (mode in ('friendly', 'ranked')),
  wager integer not null default 0 check (wager in (0, 10)),
  status text not null default 'waiting' check (status in ('waiting', 'draft', 'active', 'completed', 'cancelled')),
  creator_perks text[] not null default '{}',
  opponent_perks text[] not null default '{}',
  creator_ready boolean not null default false,
  opponent_ready boolean not null default false,
  creator_report uuid,
  opponent_report uuid,
  winner_id uuid,
  rating_delta integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists duels_creator_idx on public.duels(creator_id, created_at desc);
create index if not exists duels_opponent_idx on public.duels(opponent_id, created_at desc);
create index if not exists duels_pair_completed_idx on public.duels(creator_id, opponent_id, completed_at);

alter table public.duel_profiles enable row level security;
alter table public.duels enable row level security;

revoke all on public.duel_profiles from anon, authenticated;
revoke all on public.duels from anon, authenticated;

create or replace function public.minuit_duel_ensure_profile(p_user uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if p_user is null then
    raise exception 'Utilisateur requis';
  end if;
  insert into public.duel_profiles(user_id)
  values (p_user)
  on conflict (user_id) do nothing;
end $$;

create or replace function public.minuit_duel_name(p_user uuid)
returns text
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(
    nullif(trim(raw_user_meta_data->>'display_name'), ''),
    nullif(trim(raw_user_meta_data->>'username'), ''),
    nullif(trim(raw_user_meta_data->>'full_name'), ''),
    nullif(split_part(coalesce(email, ''), '@', 1), ''),
    'Sorcière'
  )
  from auth.users
  where id = p_user
$$;

create or replace function public.minuit_duel_profile_json(p_user uuid)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'id', p.user_id,
    'name', public.minuit_duel_name(p.user_id),
    'rating', p.rating,
    'shards', p.moon_shards,
    'wins', p.wins,
    'losses', p.losses,
    'unlocked', to_jsonb(p.unlocked),
    'equipped', p.equipped
  )
  from public.duel_profiles p
  where p.user_id = p_user
$$;

create or replace function public.minuit_duel_profile()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null then
    raise exception 'Connexion requise';
  end if;
  perform public.minuit_duel_ensure_profile(v_uid);
  return public.minuit_duel_profile_json(v_uid);
end $$;

create or replace function public.minuit_duel_status(p_duel uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := (select auth.uid());
  d public.duels;
begin
  if v_uid is null then
    raise exception 'Connexion requise';
  end if;
  select * into d from public.duels where id = p_duel;
  if not found then
    raise exception 'Duel introuvable';
  end if;
  if v_uid not in (d.creator_id, coalesce(d.opponent_id, '00000000-0000-0000-0000-000000000000'::uuid)) then
    raise exception 'Ce duel est réservé à ses invités';
  end if;
  perform public.minuit_duel_ensure_profile(d.creator_id);
  if d.opponent_id is not null then
    perform public.minuit_duel_ensure_profile(d.opponent_id);
  end if;
  return jsonb_build_object(
    'duel', jsonb_build_object(
      'id', d.id,
      'creatorId', d.creator_id,
      'opponentId', d.opponent_id,
      'mode', d.mode,
      'wager', d.wager,
      'status', d.status,
      'creatorPerks', to_jsonb(d.creator_perks),
      'opponentPerks', to_jsonb(d.opponent_perks),
      'creatorReady', d.creator_ready,
      'opponentReady', d.opponent_ready,
      'creatorReport', d.creator_report,
      'opponentReport', d.opponent_report,
      'winnerId', d.winner_id,
      'ratingDelta', d.rating_delta,
      'createdAt', d.created_at,
      'completedAt', d.completed_at
    ),
    'players', jsonb_build_array(
      public.minuit_duel_profile_json(d.creator_id),
      case
        when d.opponent_id is null then null
        else public.minuit_duel_profile_json(d.opponent_id)
      end
    )
  );
end $$;

create or replace function public.minuit_duel_create(p_mode text, p_wager integer default 0)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := (select auth.uid());
  v_id uuid;
begin
  if v_uid is null then
    raise exception 'Connexion requise';
  end if;
  if p_mode not in ('friendly', 'ranked') then
    raise exception 'Mode de duel invalide';
  end if;
  if p_wager not in (0, 10) then
    raise exception 'Mise invalide';
  end if;
  perform public.minuit_duel_ensure_profile(v_uid);
  insert into public.duels(creator_id, mode, wager)
  values (v_uid, p_mode, p_wager)
  returning id into v_id;
  return public.minuit_duel_status(v_id);
end $$;

create or replace function public.minuit_duel_join(p_duel uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := (select auth.uid());
  d public.duels;
  v_count integer;
begin
  if v_uid is null then
    raise exception 'Connexion requise';
  end if;
  select * into d from public.duels where id = p_duel for update;
  if not found then
    raise exception 'Duel introuvable';
  end if;
  if d.opponent_id = v_uid then
    return public.minuit_duel_status(p_duel);
  end if;
  if d.creator_id = v_uid then
    raise exception 'Tu ne peux pas rejoindre ton propre duel';
  end if;
  if d.opponent_id is not null then
    raise exception 'Ce duel a déjà deux sorcières';
  end if;
  if d.status <> 'waiting' then
    raise exception 'Ce duel n’accepte plus de joueur';
  end if;
  perform public.minuit_duel_ensure_profile(v_uid);
  perform public.minuit_duel_ensure_profile(d.creator_id);
  if d.mode = 'ranked' then
    select count(*) into v_count
    from public.duels h
    where h.status = 'completed'
      and h.mode = 'ranked'
      and ((h.creator_id = d.creator_id and h.opponent_id = v_uid)
        or (h.creator_id = v_uid and h.opponent_id = d.creator_id))
      and (h.completed_at at time zone 'Europe/Paris')::date = (now() at time zone 'Europe/Paris')::date;
    if v_count >= 2 then
      raise exception 'Deux duels classés déjà joués contre cette sorcière aujourd’hui. Choisis un amical.';
    end if;
  end if;
  if d.wager > 0 then
    if (
      select count(*)
      from public.duel_profiles
      where user_id in (d.creator_id, v_uid)
        and moon_shards >= d.wager
    ) <> 2 then
      raise exception 'Éclats insuffisants pour cette mise';
    end if;
    update public.duel_profiles
    set moon_shards = moon_shards - d.wager,
        updated_at = now()
    where user_id in (d.creator_id, v_uid);
  end if;
  update public.duels
  set opponent_id = v_uid,
      status = 'draft',
      updated_at = now()
  where id = p_duel;
  return public.minuit_duel_status(p_duel);
end $$;

create or replace function public.minuit_duel_ready(p_duel uuid, p_perks text[])
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := (select auth.uid());
  d public.duels;
  allowed constant text[] := array[
    'comet-boots',
    'twin-burst',
    'swift-powder',
    'prism-fan',
    'dawn-halo',
    'soft-steps',
    'fleeting-dash',
    'ember-heart',
    'short-lance',
    'wide-wave'
  ];
begin
  if v_uid is null then
    raise exception 'Connexion requise';
  end if;
  if p_perks is null
    or array_length(p_perks, 1) <> 3
    or (select count(distinct value) from unnest(p_perks) value) <> 3
    or (select count(*) from unnest(p_perks) value where value <> all(allowed)) > 0
  then
    raise exception 'Choisis exactement trois atouts différents';
  end if;
  select * into d from public.duels where id = p_duel for update;
  if not found or d.status not in ('draft', 'active') then
    raise exception 'Le draft n’est pas ouvert';
  end if;
  if v_uid = d.creator_id then
    update public.duels
    set creator_perks = p_perks,
        creator_ready = true,
        updated_at = now()
    where id = p_duel;
  elsif v_uid = d.opponent_id then
    update public.duels
    set opponent_perks = p_perks,
        opponent_ready = true,
        updated_at = now()
    where id = p_duel;
  else
    raise exception 'Ce duel est réservé à ses invités';
  end if;
  update public.duels
  set status = 'active',
      updated_at = now()
  where id = p_duel
    and creator_ready
    and opponent_ready;
  return public.minuit_duel_status(p_duel);
end $$;

create or replace function public.minuit_duel_finish(p_duel uuid, p_winner uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := (select auth.uid());
  d public.duels;
  v_creator_report uuid;
  v_opponent_report uuid;
  v_delta integer := 0;
  v_winner_rating integer;
  v_loser_rating integer;
  v_loser uuid;
begin
  if v_uid is null then
    raise exception 'Connexion requise';
  end if;
  select * into d from public.duels where id = p_duel for update;
  if not found then
    raise exception 'Duel introuvable';
  end if;
  if d.status = 'completed' then
    return public.minuit_duel_status(p_duel);
  end if;
  if d.status <> 'active' or d.opponent_id is null then
    raise exception 'Ce duel n’est pas en cours';
  end if;
  if v_uid not in (d.creator_id, d.opponent_id) then
    raise exception 'Ce duel est réservé à ses invités';
  end if;
  if p_winner not in (d.creator_id, d.opponent_id) then
    raise exception 'Vainqueur invalide';
  end if;
  if v_uid = d.creator_id then
    update public.duels
    set creator_report = p_winner,
        updated_at = now()
    where id = p_duel
    returning creator_report, opponent_report into v_creator_report, v_opponent_report;
  else
    update public.duels
    set opponent_report = p_winner,
        updated_at = now()
    where id = p_duel
    returning creator_report, opponent_report into v_creator_report, v_opponent_report;
  end if;
  if v_creator_report is null or v_opponent_report is null or v_creator_report <> v_opponent_report then
    return public.minuit_duel_status(p_duel);
  end if;
  v_loser := case when p_winner = d.creator_id then d.opponent_id else d.creator_id end;
  if d.mode = 'ranked' then
    select rating into v_winner_rating from public.duel_profiles where user_id = p_winner for update;
    select rating into v_loser_rating from public.duel_profiles where user_id = v_loser for update;
    v_delta := case
      when v_winner_rating + 150 <= v_loser_rating then 30
      when v_winner_rating >= v_loser_rating + 150 then 10
      else 20
    end;
    update public.duel_profiles
    set rating = greatest(0, least(100000, rating + case when user_id = p_winner then v_delta else -v_delta end)),
        wins = wins + case when user_id = p_winner then 1 else 0 end,
        losses = losses + case when user_id = p_loser then 1 else 0 end,
        moon_shards = moon_shards + case when user_id = p_winner then 2 else 0 end,
        updated_at = now()
    from (select v_loser as p_loser) sub
    where user_id in (p_winner, v_loser);
  end if;
  if d.wager > 0 then
    update public.duel_profiles
    set moon_shards = least(100000, moon_shards + d.wager * 2),
        updated_at = now()
    where user_id = p_winner;
  end if;
  update public.duels
  set winner_id = p_winner,
      rating_delta = v_delta,
      status = 'completed',
      completed_at = now(),
      updated_at = now()
  where id = p_duel;
  return public.minuit_duel_status(p_duel);
end $$;

create or replace function public.minuit_duel_cancel(p_duel uuid, p_forfeit boolean default false)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := (select auth.uid());
  d public.duels;
  v_winner uuid;
begin
  if v_uid is null then
    raise exception 'Connexion requise';
  end if;
  select * into d from public.duels where id = p_duel for update;
  if not found then
    raise exception 'Duel introuvable';
  end if;
  if v_uid not in (d.creator_id, coalesce(d.opponent_id, '00000000-0000-0000-0000-000000000000'::uuid)) then
    raise exception 'Ce duel est réservé à ses invités';
  end if;
  if d.status in ('completed', 'cancelled') then
    return public.minuit_duel_status(p_duel);
  end if;
  if d.status = 'active' and d.mode = 'ranked' and not p_forfeit then
    raise exception 'Un classé commencé doit être terminé ou abandonné';
  end if;
  if p_forfeit then
    if d.status <> 'active' or d.opponent_id is null then
      raise exception 'Aucun combat à abandonner';
    end if;
    v_winner := case when v_uid = d.creator_id then d.opponent_id else d.creator_id end;
    update public.duels
    set creator_report = v_winner,
        opponent_report = v_winner
    where id = p_duel;
    return public.minuit_duel_finish(p_duel, v_winner);
  end if;
  if d.wager > 0 and d.opponent_id is not null then
    update public.duel_profiles
    set moon_shards = least(100000, moon_shards + d.wager),
        updated_at = now()
    where user_id in (d.creator_id, d.opponent_id);
  end if;
  update public.duels
  set status = 'cancelled',
      updated_at = now()
  where id = p_duel;
  return public.minuit_duel_status(p_duel);
end $$;

create or replace function public.minuit_duel_unlock(p_item text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := (select auth.uid());
  v_cost integer;
begin
  if v_uid is null then
    raise exception 'Connexion requise';
  end if;
  v_cost := case p_item
    when 'halo-aurora' then 30
    when 'halo-solar' then 60
    when 'halo-eclipse' then 100
    else null
  end;
  if v_cost is null then
    raise exception 'Halo inconnu';
  end if;
  perform public.minuit_duel_ensure_profile(v_uid);
  update public.duel_profiles
  set moon_shards = moon_shards - v_cost,
      unlocked = array_append(unlocked, p_item),
      updated_at = now()
  where user_id = v_uid
    and moon_shards >= v_cost
    and not p_item = any(unlocked);
  if not found then
    raise exception 'Halo déjà débloqué ou éclats insuffisants';
  end if;
  return public.minuit_duel_profile();
end $$;

create or replace function public.minuit_duel_equip(p_item text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null then
    raise exception 'Connexion requise';
  end if;
  perform public.minuit_duel_ensure_profile(v_uid);
  update public.duel_profiles
  set equipped = p_item,
      updated_at = now()
  where user_id = v_uid
    and p_item = any(unlocked);
  if not found then
    raise exception 'Débloque ce halo avant de l’équiper';
  end if;
  return public.minuit_duel_profile();
end $$;

revoke all on function public.minuit_duel_ensure_profile(uuid) from public, anon, authenticated;
revoke all on function public.minuit_duel_name(uuid) from public, anon, authenticated;
revoke all on function public.minuit_duel_profile_json(uuid) from public, anon, authenticated;

revoke all on function public.minuit_duel_profile() from public, anon;
revoke all on function public.minuit_duel_status(uuid) from public, anon;
revoke all on function public.minuit_duel_create(text, integer) from public, anon;
revoke all on function public.minuit_duel_join(uuid) from public, anon;
revoke all on function public.minuit_duel_ready(uuid, text[]) from public, anon;
revoke all on function public.minuit_duel_finish(uuid, uuid) from public, anon;
revoke all on function public.minuit_duel_cancel(uuid, boolean) from public, anon;
revoke all on function public.minuit_duel_unlock(text) from public, anon;
revoke all on function public.minuit_duel_equip(text) from public, anon;

grant execute on function public.minuit_duel_profile() to authenticated;
grant execute on function public.minuit_duel_status(uuid) to authenticated;
grant execute on function public.minuit_duel_create(text, integer) to authenticated;
grant execute on function public.minuit_duel_join(uuid) to authenticated;
grant execute on function public.minuit_duel_ready(uuid, text[]) to authenticated;
grant execute on function public.minuit_duel_finish(uuid, uuid) to authenticated;
grant execute on function public.minuit_duel_cancel(uuid, boolean) to authenticated;
grant execute on function public.minuit_duel_unlock(text) to authenticated;
grant execute on function public.minuit_duel_equip(text) to authenticated;
