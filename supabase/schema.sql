-- La Nuit aux Trousses — sauvegardes privées et avis d’équilibrage.
-- À exécuter dans le SQL Editor du projet Supabase. Aucune clé service_role
-- n’est utilisée par le jeu. Les policies peuvent être rejouées sans doublon.

create table if not exists public.game_saves (
  user_id uuid primary key references auth.users(id) on delete cascade default auth.uid(),
  payload jsonb not null,
  client_updated_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint game_saves_payload_object check (jsonb_typeof(payload) = 'object'),
  constraint game_saves_payload_size check (pg_column_size(payload) <= 2097152)
);

create table if not exists public.game_feedback (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users(id) on delete set null default auth.uid(),
  run_id text not null,
  rating text not null check (rating in ('hard', 'fair', 'easy')),
  comment text not null default '' check (char_length(comment) <= 1000),
  world text not null check (char_length(world) <= 80),
  stage smallint not null check (stage between 1 and 5),
  wave smallint not null check (wave between 1 and 5),
  score integer not null check (score between 0 and 100000000),
  mode text not null check (mode in ('free', 'ranked', 'daily')),
  difficulty text not null check (difficulty in ('easy', 'normal', 'hard')),
  game_version text not null check (char_length(game_version) <= 40),
  created_at timestamptz not null default now(),
  constraint game_feedback_run_id_size check (char_length(run_id) between 1 and 80)
);

create or replace function public.minuit_touch_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists game_saves_touch_updated_at on public.game_saves;
create trigger game_saves_touch_updated_at
before update on public.game_saves
for each row execute function public.minuit_touch_updated_at();

alter table public.game_saves enable row level security;
alter table public.game_feedback enable row level security;

revoke all on table public.game_saves from anon, authenticated;
revoke all on table public.game_feedback from anon, authenticated;
grant select, insert, update on table public.game_saves to authenticated;

-- Les avis sont privés : insertion possible sans compte, aucune lecture via
-- l’API publique. L’user_id est toujours fourni par auth.uid(), jamais par le jeu.
grant insert (run_id, rating, comment, world, stage, wave, score, mode, difficulty, game_version)
on table public.game_feedback to anon, authenticated;

drop policy if exists game_saves_select_own on public.game_saves;
create policy game_saves_select_own on public.game_saves
for select to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists game_saves_insert_own on public.game_saves;
create policy game_saves_insert_own on public.game_saves
for insert to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists game_saves_update_own on public.game_saves;
create policy game_saves_update_own on public.game_saves
for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists game_feedback_insert_private on public.game_feedback;
create policy game_feedback_insert_private on public.game_feedback
for insert to anon, authenticated
with check (
  rating in ('hard', 'fair', 'easy')
  and char_length(comment) <= 1000
  and user_id is not distinct from (select auth.uid())
);

-- Pour l’équilibrage, un administrateur consulte les avis depuis le tableau de
-- bord Supabase ou avec une clé secrète conservée strictement côté serveur.
-- Si le jeu devient public à grande échelle, ajouter une Edge Function avec
-- CAPTCHA et limitation de débit devant game_feedback.
