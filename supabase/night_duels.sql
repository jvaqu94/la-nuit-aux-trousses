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

-- ---------------------------------------------------------------------------
-- Invitations dans l'application : un joueur invite un pseudo, l'invité reçoit
-- un popup « rejoindre / refuser ». La résolution du pseudo reste côté serveur
-- (même empreinte déterministe que pseudo-auth), sans table publique de
-- correspondance pseudo -> e-mail. Les invitations expirent après 10 minutes et
-- deviennent invalides dès que le duel quitte l'état « waiting ».
-- ---------------------------------------------------------------------------

create table if not exists public.duel_invitations (
  id uuid primary key default gen_random_uuid(),
  duel_id uuid not null references public.duels(id) on delete cascade,
  from_user uuid not null references auth.users(id) on delete cascade,
  to_user uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined', 'cancelled')),
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  expires_at timestamptz not null default now() + interval '10 minutes',
  check (from_user <> to_user)
);

create index if not exists duel_invitations_to_user_idx on public.duel_invitations(to_user, status, created_at desc);
create index if not exists duel_invitations_duel_idx on public.duel_invitations(duel_id, status);
create unique index if not exists duel_invitations_pending_unique on public.duel_invitations(duel_id, to_user) where status = 'pending';

alter table public.duel_invitations enable row level security;
revoke all on public.duel_invitations from anon, authenticated;

create or replace function public.minuit_duel_resolve_player(p_pseudo text)
returns uuid
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_key text := lower(normalize(trim(coalesce(p_pseudo, '')), NFKC));
  v_hex text;
  v_email text;
  v_id uuid;
  v_count integer;
begin
  if char_length(v_key) not between 2 and 24 then
    return null;
  end if;
  v_hex := encode(sha256(convert_to('la-nuit-pseudo-v1:' || v_key, 'UTF8')), 'hex');
  v_email := 'player-' || left(v_hex, 40) || '@players.minuit.invalid';
  select id into v_id from auth.users where email = v_email limit 1;
  if v_id is null then
    select count(*) into v_count
    from auth.users
    where lower(normalize(trim(coalesce(raw_user_meta_data->>'display_name', '')), NFKC)) = v_key;
    if v_count = 1 then
      select id into v_id
      from auth.users
      where lower(normalize(trim(coalesce(raw_user_meta_data->>'display_name', '')), NFKC)) = v_key
      limit 1;
    end if;
  end if;
  return v_id;
end $$;

create or replace function public.minuit_duel_invitation_json(p_invitation public.duel_invitations)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'id', i.id,
    'duelId', i.duel_id,
    'fromUser', i.from_user,
    'toUser', i.to_user,
    'fromName', public.minuit_duel_name(i.from_user),
    'toName', public.minuit_duel_name(i.to_user),
    'mode', d.mode,
    'wager', d.wager,
    'status', i.status,
    'createdAt', i.created_at,
    'expiresAt', i.expires_at,
    'respondedAt', i.responded_at
  )
  from public.duel_invitations i
  join public.duels d on d.id = i.duel_id
  where i.id = p_invitation.id
$$;

create or replace function public.minuit_duel_invite(p_duel uuid, p_pseudo text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := (select auth.uid());
  d public.duels;
  v_target uuid;
  v_inv public.duel_invitations;
begin
  if v_uid is null then
    raise exception 'Connexion requise';
  end if;
  select * into d from public.duels where id = p_duel for update;
  if not found then
    raise exception 'Duel introuvable';
  end if;
  if d.creator_id <> v_uid then
    raise exception 'Seule la créatrice du duel peut inviter';
  end if;
  if d.status <> 'waiting' or d.opponent_id is not null then
    raise exception 'Ce duel a déjà une adversaire';
  end if;
  v_target := public.minuit_duel_resolve_player(p_pseudo);
  if v_target is null then
    raise exception 'Joueur introuvable. Vérifie le pseudo exact.';
  end if;
  if v_target = v_uid then
    raise exception 'Tu ne peux pas t’inviter toi-même';
  end if;
  perform public.minuit_duel_ensure_profile(v_uid);
  perform public.minuit_duel_ensure_profile(v_target);
  insert into public.duel_invitations(duel_id, from_user, to_user, expires_at)
  values (p_duel, v_uid, v_target, now() + interval '10 minutes')
  on conflict (duel_id, to_user) where status = 'pending'
  do update set expires_at = excluded.expires_at
  returning * into v_inv;
  return jsonb_build_object(
    'invitation', public.minuit_duel_invitation_json(v_inv),
    'duel', public.minuit_duel_status(p_duel)
  );
end $$;

create or replace function public.minuit_duel_invitations()
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(
    jsonb_agg(public.minuit_duel_invitation_json(s.i) order by s.created_at desc),
    '[]'::jsonb
  )
  from (
    select i as i, i.created_at as created_at
    from public.duel_invitations i
    join public.duels d on d.id = i.duel_id
    where i.to_user = (select auth.uid())
      and i.status = 'pending'
      and i.expires_at > now()
      and d.status = 'waiting'
      and d.opponent_id is null
      and d.creator_id <> (select auth.uid())
    order by i.created_at desc
    limit 20
  ) s
$$;

create or replace function public.minuit_duel_sent_invitations(p_duel uuid)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(
    jsonb_agg(public.minuit_duel_invitation_json(s.i) order by s.created_at desc),
    '[]'::jsonb
  )
  from (
    select i as i, i.created_at as created_at
    from public.duel_invitations i
    join public.duels d on d.id = i.duel_id
    where i.duel_id = p_duel
      and i.from_user = (select auth.uid())
      and i.status = 'pending'
      and i.expires_at > now()
      and d.status = 'waiting'
      and d.opponent_id is null
    order by i.created_at desc
    limit 20
  ) s
$$;

create or replace function public.minuit_duel_invite_respond(p_invitation uuid, p_accept boolean)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := (select auth.uid());
  v_inv public.duel_invitations;
  d public.duels;
  v_duel_json jsonb;
begin
  if v_uid is null then
    raise exception 'Connexion requise';
  end if;
  select * into v_inv from public.duel_invitations where id = p_invitation for update;
  if not found then
    raise exception 'Invitation introuvable';
  end if;
  if v_inv.to_user <> v_uid then
    raise exception 'Cette invitation ne t’est pas adressée';
  end if;
  if v_inv.status <> 'pending' then
    raise exception 'Invitation déjà traitée';
  end if;
  if v_inv.expires_at <= now() then
    update public.duel_invitations set status = 'cancelled', responded_at = now() where id = p_invitation;
    raise exception 'Invitation expirée';
  end if;
  select * into d from public.duels where id = v_inv.duel_id for update;
  if p_accept then
    if d.status <> 'waiting' or d.opponent_id is not null or d.creator_id = v_uid then
      update public.duel_invitations set status = 'cancelled', responded_at = now() where id = p_invitation;
      raise exception 'Ce duel n’est plus disponible';
    end if;
    v_duel_json := public.minuit_duel_join(d.id);
    update public.duel_invitations
    set status = 'accepted', responded_at = now()
    where id = p_invitation
    returning * into v_inv;
    return jsonb_build_object('invitation', public.minuit_duel_invitation_json(v_inv), 'duel', v_duel_json);
  else
    update public.duel_invitations
    set status = 'declined', responded_at = now()
    where id = p_invitation
    returning * into v_inv;
    return jsonb_build_object('invitation', public.minuit_duel_invitation_json(v_inv));
  end if;
end $$;

create or replace function public.minuit_duel_invite_cancel(p_invitation uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := (select auth.uid());
  v_inv public.duel_invitations;
begin
  if v_uid is null then
    raise exception 'Connexion requise';
  end if;
  select * into v_inv from public.duel_invitations where id = p_invitation for update;
  if not found then
    raise exception 'Invitation introuvable';
  end if;
  if v_inv.from_user <> v_uid then
    raise exception 'Seule l’expéditrice peut annuler cette invitation';
  end if;
  if v_inv.status = 'pending' then
    update public.duel_invitations
    set status = 'cancelled', responded_at = now()
    where id = p_invitation
    returning * into v_inv;
  end if;
  return jsonb_build_object('invitation', public.minuit_duel_invitation_json(v_inv));
end $$;

revoke all on function public.minuit_duel_resolve_player(text) from public, anon, authenticated;
revoke all on function public.minuit_duel_invitation_json(public.duel_invitations) from public, anon, authenticated;
revoke all on function public.minuit_duel_invite(uuid, text) from public, anon;
revoke all on function public.minuit_duel_invitations() from public, anon;
revoke all on function public.minuit_duel_sent_invitations(uuid) from public, anon;
revoke all on function public.minuit_duel_invite_respond(uuid, boolean) from public, anon;
revoke all on function public.minuit_duel_invite_cancel(uuid) from public, anon;

grant execute on function public.minuit_duel_invite(uuid, text) to authenticated;
grant execute on function public.minuit_duel_invitations() to authenticated;
grant execute on function public.minuit_duel_sent_invitations(uuid) to authenticated;
grant execute on function public.minuit_duel_invite_respond(uuid, boolean) to authenticated;
grant execute on function public.minuit_duel_invite_cancel(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Invitations depuis la team : liste des membres de la même team et invitation
-- directe par identifiant de membre. La résolution ne dépend plus du pseudo
-- (évite les homonymes / renommages), mais l'invitation par pseudo reste disponible.
-- Seules les fonctions security definer lisent team_members ; aucun accès direct.
-- ---------------------------------------------------------------------------

create or replace function public.minuit_duel_send_invite_to(p_duel uuid, p_target uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := (select auth.uid());
  d public.duels;
  v_inv public.duel_invitations;
begin
  if v_uid is null then
    raise exception 'Connexion requise';
  end if;
  select * into d from public.duels where id = p_duel for update;
  if not found then
    raise exception 'Duel introuvable';
  end if;
  if d.creator_id <> v_uid then
    raise exception 'Seule la créatrice du duel peut inviter';
  end if;
  if d.status <> 'waiting' or d.opponent_id is not null then
    raise exception 'Ce duel a déjà une adversaire';
  end if;
  if p_target is null then
    raise exception 'Joueur introuvable. Vérifie le pseudo exact.';
  end if;
  if p_target = v_uid then
    raise exception 'Tu ne peux pas t’inviter toi-même';
  end if;
  perform public.minuit_duel_ensure_profile(v_uid);
  perform public.minuit_duel_ensure_profile(p_target);
  insert into public.duel_invitations(duel_id, from_user, to_user, expires_at)
  values (p_duel, v_uid, p_target, now() + interval '10 minutes')
  on conflict (duel_id, to_user) where status = 'pending'
  do update set expires_at = excluded.expires_at
  returning * into v_inv;
  return jsonb_build_object(
    'invitation', public.minuit_duel_invitation_json(v_inv),
    'duel', public.minuit_duel_status(p_duel)
  );
end $$;

create or replace function public.minuit_duel_team_players(p_duel uuid default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := (select auth.uid());
  v_team_id uuid;
  v_team_name text;
  v_member_count integer;
  d public.duels;
  v_duel_id uuid := null;
  v_mode text := null;
  v_opponent uuid := null;
  v_players jsonb;
begin
  if v_uid is null then
    raise exception 'Connexion requise';
  end if;
  select tm.team_id into v_team_id
  from public.team_members tm
  where tm.user_id = v_uid;
  if v_team_id is null then
    return jsonb_build_object('team', null, 'players', '[]'::jsonb);
  end if;
  select t.name into v_team_name from public.teams t where t.id = v_team_id;
  select count(*) into v_member_count from public.team_members tm where tm.team_id = v_team_id;

  if p_duel is not null then
    select * into d from public.duels where id = p_duel;
    if found then
      if d.creator_id <> v_uid then
        raise exception 'Seule la créatrice du duel peut inviter';
      end if;
      if d.status = 'waiting' and d.opponent_id is null then
        v_duel_id := d.id;
        v_mode := d.mode;
        v_opponent := d.opponent_id;
      end if;
    end if;
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', s.user_id,
        'displayName', s.display_name,
        'duelName', s.duel_name,
        'isYou', s.is_you,
        'invitationStatus', s.invitation_status,
        'availability', s.availability,
        'canInvite', s.can_invite
      )
      order by lower(s.display_name), s.display_name
    ),
    '[]'::jsonb
  ) into v_players
  from (
    select
      tm.user_id,
      tm.display_name,
      public.minuit_duel_name(tm.user_id) as duel_name,
      (tm.user_id = v_uid) as is_you,
      case
        when v_duel_id is not null and exists (
          select 1 from public.duel_invitations i
          where i.duel_id = v_duel_id and i.to_user = tm.user_id
            and i.status = 'pending' and i.expires_at > now()
        ) then 'pending'
        else null
      end as invitation_status,
      exists (
        select 1 from public.duels b
        where b.status in ('draft', 'active')
          and (b.creator_id = tm.user_id or b.opponent_id = tm.user_id)
      ) as busy,
      case
        when v_mode = 'ranked' then (
          select count(*) from public.duels h
          where h.status = 'completed' and h.mode = 'ranked'
            and ((h.creator_id = v_uid and h.opponent_id = tm.user_id)
              or (h.creator_id = tm.user_id and h.opponent_id = v_uid))
            and (h.completed_at at time zone 'Europe/Paris')::date = (now() at time zone 'Europe/Paris')::date
        ) >= 2
        else false
      end as quota_reached,
      (tm.user_id <> v_uid)
        and not exists (
          select 1 from public.duels b
          where b.status in ('draft', 'active')
            and (b.creator_id = tm.user_id or b.opponent_id = tm.user_id)
        )
        and (
          v_duel_id is null
          or (
            not exists (
              select 1 from public.duel_invitations i
              where i.duel_id = v_duel_id and i.to_user = tm.user_id
                and i.status = 'pending' and i.expires_at > now()
            )
            and tm.user_id <> coalesce(v_opponent, '00000000-0000-0000-0000-000000000000'::uuid)
            and not (
              v_mode = 'ranked' and (
                select count(*) from public.duels h
                where h.status = 'completed' and h.mode = 'ranked'
                  and ((h.creator_id = v_uid and h.opponent_id = tm.user_id)
                    or (h.creator_id = tm.user_id and h.opponent_id = v_uid))
                  and (h.completed_at at time zone 'Europe/Paris')::date = (now() at time zone 'Europe/Paris')::date
              ) >= 2
            )
          )
        ) as can_invite,
      case
        when tm.user_id = v_uid then 'Toi'
        when exists (
          select 1 from public.duels b
          where b.status in ('draft', 'active')
            and (b.creator_id = tm.user_id or b.opponent_id = tm.user_id)
        ) then 'En duel'
        when v_duel_id is not null and exists (
          select 1 from public.duel_invitations i
          where i.duel_id = v_duel_id and i.to_user = tm.user_id
            and i.status = 'pending' and i.expires_at > now()
        ) then 'Invitation envoyée'
        when v_duel_id is not null and tm.user_id = v_opponent then 'Adversaire'
        when v_mode = 'ranked' and (
          select count(*) from public.duels h
          where h.status = 'completed' and h.mode = 'ranked'
            and ((h.creator_id = v_uid and h.opponent_id = tm.user_id)
              or (h.creator_id = tm.user_id and h.opponent_id = v_uid))
            and (h.completed_at at time zone 'Europe/Paris')::date = (now() at time zone 'Europe/Paris')::date
        ) >= 2 then 'Quota classé atteint'
        else 'Disponible'
      end as availability
    from public.team_members tm
    where tm.team_id = v_team_id
  ) s;

  return jsonb_build_object(
    'team', jsonb_build_object('id', v_team_id, 'name', v_team_name, 'memberCount', v_member_count),
    'players', coalesce(v_players, '[]'::jsonb)
  );
end $$;

create or replace function public.minuit_duel_invite_member(p_duel uuid, p_member uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := (select auth.uid());
  v_team_id uuid;
  v_member_team uuid;
begin
  if v_uid is null then
    raise exception 'Connexion requise';
  end if;
  select tm.team_id into v_team_id from public.team_members tm where tm.user_id = v_uid;
  if v_team_id is null then
    raise exception 'Tu n’es pas encore dans une team';
  end if;
  select tm.team_id into v_member_team from public.team_members tm where tm.user_id = p_member;
  if v_member_team is null or v_member_team <> v_team_id then
    raise exception 'Cette joueuse ne fait pas partie de ta team';
  end if;
  return public.minuit_duel_send_invite_to(p_duel, p_member);
end $$;

revoke all on function public.minuit_duel_send_invite_to(uuid, uuid) from public, anon, authenticated;
revoke all on function public.minuit_duel_team_players(uuid) from public, anon;
revoke all on function public.minuit_duel_invite_member(uuid, uuid) from public, anon;

grant execute on function public.minuit_duel_team_players(uuid) to authenticated;
grant execute on function public.minuit_duel_invite_member(uuid, uuid) to authenticated;
